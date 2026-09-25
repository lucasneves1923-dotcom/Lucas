import { useEffect, useState } from 'react'
import { Search, Shield, Trash2 } from 'lucide-react'
import { Card, EmptyState } from '../../components/common/ui.jsx'
import { useRole } from '../../context/RoleContext.jsx'
import { ACCESS_ROLES, ACCESS_ROLE_LABELS, DEFAULT_ROLE } from '../../lib/roles'
import { assignRole, listRoleAssignments, removeRoleAssignment, resolveProfiles, searchPeople } from '../../lib/roleAdmin'
import { isRunningInsideArtifact } from '../../lib/artifactEnv'

function RoleBadge({ role }) {
  const tone = role === 'admin' ? 'badge-success' : role === 'tesoureiro' ? 'badge-warning' : ''
  return <span className={`badge ${tone}`}>{ACCESS_ROLE_LABELS[role] || role}</span>
}

export default function UsersSettings() {
  const { myId, canManageUsers, isOwner } = useRole()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [pendingRole, setPendingRole] = useState({})
  const [assignments, setAssignments] = useState([])
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function refreshAssignments() {
    setLoading(true)
    const rows = await listRoleAssignments()
    setAssignments(rows)
    const resolved = await resolveProfiles(rows.map((r) => r.id))
    setProfiles((prev) => ({ ...prev, ...resolved }))
    setLoading(false)
  }

  useEffect(() => {
    if (isRunningInsideArtifact()) refreshAssignments()
    else setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSearch(value) {
    setQuery(value)
    setError('')
    const hits = await searchPeople(value)
    setResults(hits.filter((hit) => hit.id !== myId))
  }

  async function handleAssign(personId, role) {
    setError('')
    setMessage('')
    try {
      await assignRole(personId, role)
      setMessage('Acesso atualizado.')
      await refreshAssignments()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRemove(personId) {
    setError('')
    setMessage('')
    try {
      await removeRoleAssignment(personId)
      setMessage(`Acesso removido — volta a ser "${ACCESS_ROLE_LABELS[DEFAULT_ROLE]}" por padrão.`)
      await refreshAssignments()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!isRunningInsideArtifact()) {
    return (
      <Card title="Usuários">
        <EmptyState
          title="Disponível apenas no app publicado"
          description="Níveis de acesso dependem de identificar quem está logado na Claude — só funciona na versão publicada como Artifact."
        />
      </Card>
    )
  }

  return (
    <div>
      <Card title="Conceder acesso">
        <p className="text-muted">
          Por padrão, qualquer pessoa que abrir o link vê apenas o Painel e o Mural (nível "Membro"). Busque pelo
          nome de alguém da sua organização na Claude para dar acesso de Tesoureiro ou Administrador.
        </p>

        {!canManageUsers && (
          <p style={{ color: 'var(--color-warning)' }}>
            Você não tem permissão de edição deste Artifact, então não pode buscar nem atribuir acessos por aqui —
            isso é uma permissão do próprio Claude (separada dos níveis de acesso do app), dada pelo dono no menu de
            compartilhamento da página. Você ainda pode conferir a lista abaixo.
          </p>
        )}

        {canManageUsers && (
          <>
            <div className="field" style={{ position: 'relative' }}>
              <label htmlFor="userSearch">Buscar pessoa</label>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--color-text-muted)' }} />
                <input
                  id="userSearch"
                  className="search-input"
                  style={{ paddingLeft: 32, width: '100%' }}
                  placeholder="Nome da pessoa…"
                  value={query}
                  onFocus={() => handleSearch(query)}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            </div>

            {results.length > 0 && (
              <div className="table-wrap">
                <table className="data-table">
                  <tbody>
                    {results.map((person) => (
                      <tr key={person.id}>
                        <td>{person.name || 'Alguém'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <select
                            value={pendingRole[person.id] || 'tesoureiro'}
                            onChange={(e) => setPendingRole((prev) => ({ ...prev, [person.id]: e.target.value }))}
                            style={{ marginRight: 8 }}
                          >
                            {ACCESS_ROLES.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleAssign(person.id, pendingRole[person.id] || 'tesoureiro')}
                          >
                            Conceder
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {message && <p style={{ color: 'var(--color-success)', marginTop: 12 }}>{message}</p>}
        {error && <p style={{ color: 'var(--color-danger)', marginTop: 12 }}>{error}</p>}
      </Card>

      <Card title="Acessos concedidos">
        {isOwner && (
          <p className="text-muted" style={{ marginTop: -8 }}>
            <Shield size={14} style={{ verticalAlign: -2 }} /> Você é o dono do Artifact — sempre tem acesso total,
            mesmo sem aparecer na lista abaixo.
          </p>
        )}
        {loading ? (
          <p className="text-muted">Carregando…</p>
        ) : assignments.length === 0 ? (
          <EmptyState title="Ninguém com acesso especial ainda" description="Todo mundo além de você está no nível Membro." />
        ) : (
          <div className="table-wrap">
            <table className="data-table stack-on-mobile">
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Acesso</th>
                  {canManageUsers && <th aria-label="Ações" />}
                </tr>
              </thead>
              <tbody>
                {assignments.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Pessoa">{profiles[row.id]?.name || 'Alguém'}</td>
                    <td data-label="Acesso">
                      <RoleBadge role={row.role} />
                    </td>
                    {canManageUsers && (
                      <td data-label="Ações">
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRemove(row.id)}
                          aria-label={`Remover acesso de ${profiles[row.id]?.name || 'pessoa'}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
