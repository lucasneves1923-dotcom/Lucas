import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Card, ConfirmDialog, EmptyState, Modal } from '../../components/common/ui.jsx'
import { useChurchData } from '../../context/DataContext.jsx'

function CongregationForm({ congregation, onClose }) {
  const { addCongregation, updateCongregation } = useChurchData()
  const [name, setName] = useState(congregation?.name || '')
  const [address, setAddress] = useState(congregation?.address || '')
  const [error, setError] = useState('')
  const isEditing = Boolean(congregation)

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Nome é obrigatório.')
      return
    }
    if (isEditing) {
      updateCongregation(congregation.id, { name, address })
    } else {
      addCongregation({ name, address })
    }
    onClose()
  }

  return (
    <Modal title={isEditing ? 'Editar congregação' : 'Nova congregação'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="congName">Nome</label>
          <input id="congName" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="congAddress">Endereço</label>
          <input id="congAddress" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function CongregationsSettings() {
  const { congregations, removeCongregation } = useChurchData()
  const [editing, setEditing] = useState(undefined)
  const [pendingDelete, setPendingDelete] = useState(null)

  return (
    <Card
      title="Congregações"
      action={
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(null)}>
          <Plus size={14} /> Nova congregação
        </button>
      }
    >
      <p className="text-muted">
        Usadas no campo "Congrega em" do cadastro de membros — útil para igrejas com mais de uma filial.
      </p>

      {congregations.length === 0 ? (
        <EmptyState title="Nenhuma congregação cadastrada" />
      ) : (
        <div className="table-wrap">
          <table className="data-table stack-on-mobile">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Endereço</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {congregations.map((congregation) => (
                <tr key={congregation.id}>
                  <td data-label="Nome">{congregation.name}</td>
                  <td data-label="Endereço">{congregation.address || '—'}</td>
                  <td data-label="Ações">
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(congregation)}>
                        <Pencil size={14} />
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => setPendingDelete(congregation)}>
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

      {editing !== undefined && <CongregationForm congregation={editing} onClose={() => setEditing(undefined)} />}

      {pendingDelete && (
        <ConfirmDialog
          title="Excluir congregação"
          message={`Excluir "${pendingDelete.name}"? Membros vinculados a ela ficarão sem congregação definida.`}
          confirmLabel="Excluir"
          onConfirm={() => {
            removeCongregation(pendingDelete.id)
            setPendingDelete(null)
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </Card>
  )
}
