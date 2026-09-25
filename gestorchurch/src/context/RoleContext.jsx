import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useChurchData } from './DataContext.jsx'
import { getUserCapability } from '../lib/userStore'
import { getDb } from '../lib/dbStore'
import { isRunningInsideArtifact } from '../lib/artifactEnv'
import { canAccessPage, DEFAULT_ROLE, pagesForRole } from '../lib/roles'

const RoleContext = createContext(null)
const insideArtifact = isRunningInsideArtifact()

// Fora do Artifact (ou quando o banco compartilhado não está disponível nesta
// visualização) não há como saber "quem é quem" nem onde guardar papéis —
// mantém o app totalmente aberto, como sempre foi.
const FULL_ACCESS = { loading: false, role: 'admin', myId: null, canManageUsers: false, gatingActive: false }

export function RoleProvider({ children }) {
  const { storageMode } = useChurchData()
  const [state, setState] = useState(() => (insideArtifact ? { ...FULL_ACCESS, loading: true } : FULL_ACCESS))

  useEffect(() => {
    if (!insideArtifact) return undefined
    if (storageMode === 'pending') return undefined
    if (storageMode !== 'db') {
      setState(FULL_ACCESS)
      return undefined
    }

    let cancelled = false
    let unsubscribe = null

    async function setup() {
      const user = await getUserCapability()
      if (cancelled) return
      if (!user) {
        setState({ loading: false, role: DEFAULT_ROLE, myId: null, canManageUsers: false, gatingActive: true })
        return
      }

      const [owner, canEdit, myId] = await Promise.all([user.isOwner(), user.canEdit(), user.id()])
      if (cancelled) return

      if (owner) {
        setState({ loading: false, role: 'admin', myId, canManageUsers: true, gatingActive: true, isOwner: true })
        return
      }

      const db = await getDb()
      if (cancelled) return
      if (!db || !myId) {
        setState({ loading: false, role: DEFAULT_ROLE, myId, canManageUsers: canEdit, gatingActive: true })
        return
      }

      unsubscribe = db.doc(`roles/${myId}`).onSnapshot(
        (snap) => {
          if (cancelled) return
          const assignedRole = snap.exists ? snap.data().role : DEFAULT_ROLE
          setState({
            loading: false,
            role: assignedRole || DEFAULT_ROLE,
            myId,
            canManageUsers: canEdit,
            gatingActive: true,
          })
        },
        () => {
          if (!cancelled) {
            setState({ loading: false, role: DEFAULT_ROLE, myId, canManageUsers: canEdit, gatingActive: true })
          }
        },
      )
    }

    setup()
    return () => {
      cancelled = true
      if (unsubscribe) unsubscribe()
    }
  }, [storageMode])

  const value = useMemo(
    () => ({
      ...state,
      allowedPages: pagesForRole(state.role),
      canAccess: (page) => canAccessPage(state.role, page),
    }),
    [state],
  )

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole() {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error('useRole deve ser usado dentro de <RoleProvider>')
  return ctx
}
