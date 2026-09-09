import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { loadData, saveData } from '../lib/storage'
import { generateId } from '../lib/id'

const DataContext = createContext(null)

const DEFAULT_BRANDING = {
  churchName: 'Minha Igreja',
  logoDataUrl: '',
  primaryColor: '#17222b',
  accentColor: '#b8934a',
}

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

export function DataProvider({ children }) {
  const [state, setState] = useState(() => {
    const { data, mode } = loadData()
    return { ...mergeWithDefaults(data), __loadMode: mode }
  })
  const [saveStatus, setSaveStatus] = useState({ status: 'idle', mode: null, reason: null })
  const debounceRef = useRef(null)
  const isFirstRun = useRef(true)
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const performSave = useCallback(() => {
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
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
    setSaveStatus((prev) => ({ ...prev, status: 'saving' }))
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(performSave, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [state, performSave])

  // Se a aba for fechada/minimizada com uma alteração ainda "no forno" (dentro
  // da janela de debounce de 400ms), salva na hora em vez de perder a mudança.
  useEffect(() => {
    function flushIfPending() {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        performSave()
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
  }, [performSave])

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

  const actions = useMemo(
    () => ({
      addMember: (member) =>
        setState((s) => ({ ...s, members: [...s.members, { id: generateId(), ...member }] })),
      updateMember: (id, patch) =>
        setState((s) => ({
          ...s,
          members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        })),
      removeMember: (id) =>
        setState((s) => ({ ...s, members: s.members.filter((m) => m.id !== id) })),
      importMembers: (members) =>
        setState((s) => ({
          ...s,
          members: [...s.members, ...members.map((m) => ({ id: generateId(), ...m }))],
        })),

      addFinanceEntry: (entry) =>
        setState((s) => ({
          ...s,
          financeEntries: [...s.financeEntries, { id: generateId(), ...entry }],
        })),
      updateFinanceEntry: (id, patch) =>
        setState((s) => ({
          ...s,
          financeEntries: s.financeEntries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),
      removeFinanceEntry: (id) =>
        setState((s) => ({ ...s, financeEntries: s.financeEntries.filter((e) => e.id !== id) })),

      addAsset: (asset) =>
        setState((s) => ({ ...s, assets: [...s.assets, { id: generateId(), ...asset }] })),
      updateAsset: (id, patch) =>
        setState((s) => ({
          ...s,
          assets: s.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      removeAsset: (id) => setState((s) => ({ ...s, assets: s.assets.filter((a) => a.id !== id) })),

      addCongregation: (congregation) =>
        setState((s) => ({
          ...s,
          congregations: [...s.congregations, { id: generateId(), ...congregation }],
        })),
      updateCongregation: (id, patch) =>
        setState((s) => ({
          ...s,
          congregations: s.congregations.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      removeCongregation: (id) =>
        setState((s) => ({ ...s, congregations: s.congregations.filter((c) => c.id !== id) })),

      updateBranding: (patch) =>
        setState((s) => ({ ...s, branding: { ...s.branding, ...patch } })),

      restoreFromBackup: (data) => setState({ ...mergeWithDefaults(data), __loadMode: state.__loadMode }),
    }),
    [state.__loadMode],
  )

  const value = useMemo(
    () => ({ ...state, saveStatus, ...actions }),
    [state, saveStatus, actions],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useChurchData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useChurchData deve ser usado dentro de <DataProvider>')
  return ctx
}
