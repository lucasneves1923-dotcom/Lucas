import { useMemo, useState } from 'react'
import { Plus, Upload, Pencil, Trash2, Search } from 'lucide-react'
import { useChurchData } from '../../context/DataContext.jsx'
import { Card, EmptyState, ConfirmDialog } from '../../components/common/ui.jsx'
import { formatDate } from '../../lib/format'
import MemberForm from './MemberForm.jsx'
import MemberImport from './MemberImport.jsx'

export default function MembersPage() {
  const { members, congregations, removeMember } = useChurchData()
  const [search, setSearch] = useState('')
  const [editingMember, setEditingMember] = useState(undefined)
  const [showImport, setShowImport] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)

  const congregationName = (id) => congregations.find((c) => c.id === id)?.name || '—'

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return members
    return members.filter((m) => m.fullName?.toLowerCase().includes(term))
  }, [members, search])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Membros</h1>
          <p className="page-subtitle">{members.length} cadastrado(s)</p>
        </div>
      </div>

      <div className="toolbar">
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--color-text-muted)' }} />
          <input
            className="search-input"
            style={{ paddingLeft: 32 }}
            placeholder="Buscar por nome…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="toolbar-spacer" />
        <button type="button" className="btn btn-secondary" onClick={() => setShowImport(true)}>
          <Upload size={16} /> Importar em massa
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setEditingMember(null)}>
          <Plus size={16} /> Novo membro
        </button>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            title={members.length === 0 ? 'Nenhum membro cadastrado' : 'Nenhum resultado para a busca'}
            description={members.length === 0 ? 'Cadastre o primeiro membro ou importe uma planilha.' : undefined}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table stack-on-mobile">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Cargo</th>
                  <th>Congrega em</th>
                  <th>Status</th>
                  <th>Membro desde</th>
                  <th>Contato</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((member) => (
                  <tr key={member.id}>
                    <td data-label="Nome">{member.fullName}</td>
                    <td data-label="Cargo">{member.role || 'Membro'}</td>
                    <td data-label="Congrega em">{congregationName(member.congregationId)}</td>
                    <td data-label="Status">
                      <span className={`badge ${member.status === 'Ativo' ? 'badge-success' : ''}`}>
                        {member.status || 'Ativo'}
                      </span>
                    </td>
                    <td data-label="Membro desde">{formatDate(member.memberSince)}</td>
                    <td data-label="Contato">
                      {member.phone || member.email || '—'}
                    </td>
                    <td data-label="Ações">
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setEditingMember(member)}
                          aria-label={`Editar ${member.fullName}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => setPendingDelete(member)}
                          aria-label={`Excluir ${member.fullName}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editingMember !== undefined && (
        <MemberForm member={editingMember} onClose={() => setEditingMember(undefined)} />
      )}

      {showImport && <MemberImport onClose={() => setShowImport(false)} />}

      {pendingDelete && (
        <ConfirmDialog
          title="Excluir membro"
          message={`Tem certeza que deseja excluir "${pendingDelete.fullName}"? Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          onConfirm={() => {
            removeMember(pendingDelete.id)
            setPendingDelete(null)
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
