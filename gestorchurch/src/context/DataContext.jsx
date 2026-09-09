import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { loadData, saveData } from '../lib/storage'
import { generateId } from '../lib/id'
import { isRunningInsideArtifact } from '../lib/artifactEnv'
import { describeDbError, getDb, replaceCollection, snapshotToArray } from '../lib/dbStore'

const DataContext = createContext(null)

const DEFAULT_BRANDING = {
  churchName: 'Minha Igreja',
  logoDataUrl: '',
  primaryColor: '#17222b',
  accentColor: '#b8934a',
}

const COLLECTIONS = ['members', 'financeEntries', 'assets', 'congregations']

function emptyState() {
  return {
    members: [],
    financeEntries: [],
    assets: [],
    congregations: [],
    branding: DEFAULT_BRANDING,
  }
}

function mergeWithDefaults(data) {
  const base = emptyState()
  if (!data) return base
  return {
    members: Array.isArray(data.members) ? data.members : base.members,
    financeEntries: Array.isArray(data.financeEntries) ? data.financeEntries : base.financeEntries,
    assets: Array.isArray(data.assets) ? data.assets : base.assets,
    congregations: Array.isArray(data.congregations) ? data.congregations : base.congregations,
    branding: { ...base.branding, ...(data.branding || {}) },
  }
}

const insideArtifact = isRunningInsideArtifact()

export function DataProvider({ children }) {
  const [state, setState] = useState(() => {
    if (insideArtifact) return emptyState()
    const { data, mode } = loadData()
    return { ...mergeWithDefaults(data), __loadMode: mode }
  })
  const [saveStatus, setSaveStatus] = useState({ status: 'idle', mode: null, reason: null })
  const [isLoading, setIsLoading] = useState(insideArtifact)
  const [storageMode, setStorageMode] = useState(insideArtifact ? 'pending' : 'local')
  const debounceRef = useRef(null)
  const isFirstRun = useRef(true)
  const stateRef = useRef(state)
  const dbRef = useRef(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  // --- Modo "db" (Artifact): assina as coleções e reflete cada mudança (própria ou de outro viewer) ---
  useEffect(() => {
    if (!insideArtifact) return undefined
    let cancelled = false
    const unsubscribers = []
    const loaded = { members: false, financeEntries: false, assets: false, congregations: false, branding: false }

    function maybeFinishLoading() {
      if (!cancelled && Object.values(loaded).every(Boolean)) setIsLoading(false)
    }

    getDb().then((db) => {
      if (cancelled) return
      if (!db) {
        // Sem acesso ao banco compartilhado nesta visualização: cai para o modo local.
        const { data, mode } = loadData()
        setState({ ...mergeWithDefaults(data), __loadMode: mode })
        setStorageMode('local')
        setIsLoading(false)
        return
      }

      dbRef.current = db
      setStorageMode('db')

      COLLECTIONS.forEach((name) => {
        const unsub = db.collection(name).onSnapshot(
          (snap) => {
            setState((s) => ({ ...s, [name]: snapshotToArray(snap) }))
            loaded[name] = true
            maybeFinishLoading()
          },
          (error) => {
            setSaveStatus({ status: 'error', mode: 'db', reason: describeDbError(error) })
            loaded[name] = true
            maybeFinishLoading()
          },
        )
        unsubscribers.push(unsub)
      })

      const unsubBranding = db.doc('settings/branding').onSnapshot(
        (snap) => {
          setState((s) => ({ ...s, branding: { ...DEFAULT_BRANDING, ...(snap.data() || {}) } }))
          loaded.branding = true
          maybeFinishLoading()
        },
        (error) => {
          setSaveStatus({ status: 'error', mode: 'db', reason: describeDbError(error) })
          loaded.branding = true
          maybeFinishLoading()
        },
      )
      unsubscribers.push(unsubBranding)
    })

    return () => {
      cancelled = true
      unsubscribers.forEach((unsub) => unsub())
    }
  }, [])

  // --- Modo "local" (fora do Artifact, ou Artifact sem acesso ao db): localStorage com debounce ---
  const performLocalSave = useCallback(() => {
    debounceRef.current = null
    const { __loadMode, ...persistable } = stateRef.current
    const result = saveData(persistable)
    setSaveStatus({
      status: result.ok ? 'saved' : 'error',
      mode: result.mode,
      reason: result.reason || null,
      savedAt: new Date().toISOString(),
    })
  }, [])

  useEffect(() => {
    if (storageMode !== 'local') return undefined
    if (isFirstRun.current) {
      isFirstRun.current = false
      return undefined
    }
    setSaveStatus((prev) => ({ ...prev, status: 'saving' }))
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(performLocalSave, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [state, storageMode, performLocalSave])

  // Se a aba for fechada/minimizada com uma alteração ainda "no forno" (dentro
  // da janela de debounce), salva na hora em vez de perder a mudança.
  useEffect(() => {
    if (storageMode !== 'local') return undefined
    function flushIfPending() {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        performLocalSave()
      }
    }
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') flushIfPending()
    }
    window.addEventListener('pagehide', flushIfPending)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', flushIfPending)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [storageMode, performLocalSave])

  const applyBrandingCssVars = useCallback((branding) => {
    const root = document.documentElement
    if (branding.primaryColor) root.style.setProperty('--color-ink', branding.primaryColor)
    if (branding.accentColor) {
      root.style.setProperty('--color-accent', branding.accentColor)
      root.style.setProperty('--color-accent-soft', `${branding.accentColor}33`)
    }
  }, [])

  useEffect(() => {
    applyBrandingCssVars(state.branding)
  }, [state.branding, applyBrandingCssVars])

  // --- Ações: em modo db, escrevem direto no banco (a assinatura acima reflete o resultado);
  // em modo local, atualizam o estado em memória (o efeito de debounce acima persiste). ---
  const actions = useMemo(() => {
    function localMutate(updater) {
      setState((s) => updater(s))
    }

    async function dbWrite(fn) {
      setSaveStatus((prev) => ({ ...prev, status: 'saving' }))
      try {
        await fn(dbRef.current)
        setSaveStatus({ status: 'saved', mode: 'db', reason: null, savedAt: new Date().toISOString() })
      } catch (error) {
        setSaveStatus({ status: 'error', mode: 'db', reason: describeDbError(error) })
      }
    }

    function makeCrud(collectionName, stateKey) {
      return {
        add: (item) => {
          const id = generateId()
          if (storageMode === 'db') {
            return dbWrite((db) => db.collection(collectionName).doc(id).set(item))
          }
          return localMutate((s) => ({ ...s, [stateKey]: [...s[stateKey], { id, ...item }] }))
        },
        update: (id, patch) => {
          if (storageMode === 'db') {
            return dbWrite((db) => db.collection(collectionName).doc(id).update(patch))
          }
          return localMutate((s) => ({
            ...s,
            [stateKey]: s[stateKey].map((item) => (item.id === id ? { ...item, ...patch } : item)),
          }))
        },
        remove: (id) => {
          if (storageMode === 'db') {
            return dbWrite((db) => db.collection(collectionName).doc(id).delete())
          }
          return localMutate((s) => ({ ...s, [stateKey]: s[stateKey].filter((item) => item.id !== id) }))
        },
      }
    }

    const membersCrud = makeCrud('members', 'members')
    const financeCrud = makeCrud('financeEntries', 'financeEntries')
    const assetsCrud = makeCrud('assets', 'assets')
    const congregationsCrud = makeCrud('congregations', 'congregations')

    return {
      addMember: membersCrud.add,
      updateMember: membersCrud.update,
      removeMember: membersCrud.remove,
      importMembers: (members) => {
        if (storageMode === 'db') {
          return dbWrite((db) =>
            Promise.all(members.map((m) => db.collection('members').doc(generateId()).set(m))),
          )
        }
        return localMutate((s) => ({
          ...s,
          members: [...s.members, ...members.map((m) => ({ id: generateId(), ...m }))],
        }))
      },

      addFinanceEntry: financeCrud.add,
      updateFinanceEntry: financeCrud.update,
      removeFinanceEntry: financeCrud.remove,

      addAsset: assetsCrud.add,
      updateAsset: assetsCrud.update,
      removeAsset: assetsCrud.remove,

      addCongregation: congregationsCrud.add,
      updateCongregation: congregationsCrud.update,
      removeCongregation: congregationsCrud.remove,

      updateBranding: (patch) => {
        const nextBranding = { ...stateRef.current.branding, ...patch }
        if (storageMode === 'db') {
          return dbWrite((db) => db.doc('settings/branding').set(nextBranding))
        }
        return localMutate((s) => ({ ...s, branding: nextBranding }))
      },

      restoreFromBackup: (data) => {
        const merged = mergeWithDefaults(data)
        if (storageMode === 'db') {
          return dbWrite(async (db) => {
            await Promise.all([
              replaceCollection(db, 'members', merged.members),
              replaceCollection(db, 'financeEntries', merged.financeEntries),
              replaceCollection(db, 'assets', merged.assets),
              replaceCollection(db, 'congregations', merged.congregations),
              db.doc('settings/branding').set(merged.branding),
            ])
          })
        }
        return setState((s) => ({ ...merged, __loadMode: s.__loadMode }))
      },
    }
  }, [storageMode])

  const value = useMemo(
    () => ({ ...state, saveStatus, isLoading, storageMode, ...actions }),
    [state, saveStatus, isLoading, storageMode, actions],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useChurchData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useChurchData deve ser usado dentro de <DataProvider>')
  return ctx
}
