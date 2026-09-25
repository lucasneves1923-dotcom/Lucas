import { useMemo, useState } from 'react'
import { Camera, Pencil, Plus, Trash2 } from 'lucide-react'
import { useChurchData } from '../../context/DataContext.jsx'
import { Card, ConfirmDialog, EmptyState } from '../../components/common/ui.jsx'
import { formatCurrency, formatDate } from '../../lib/format'
import FinanceForm from './FinanceForm.jsx'
import ReceiptImport from './ReceiptImport.jsx'

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'entrada', label: 'Entradas' },
  { key: 'saida', label: 'Saídas' },
]

export default function FinancePage() {
  const { financeEntries, members, removeFinanceEntry } = useChurchData()
  const [filter, setFilter] = useState('all')
  const [editingEntry, setEditingEntry] = useState(undefined)
  const [showReceiptImport, setShowReceiptImport] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)

  const memberName = (id) => members.find((m) => m.id === id)?.fullName

  const filtered = useMemo(() => {
    const sorted = [...financeEntries].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    if (filter === 'all') return sorted
    return sorted.filter((entry) => entry.type === filter)
  }, [financeEntries, filter])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Financeiro</h1>
          <p className="page-subtitle">{financeEntries.length} lançamento(s)</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="tabs" style={{ borderBottom: 'none', marginBottom: 0 }}>
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`tab-btn ${filter === key ? 'is-active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="toolbar-spacer" />
        <button type="button" className="btn btn-secondary" onClick={() => setShowReceiptImport(true)}>
          <Camera size={16} /> Importar comprovante por IA
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setEditingEntry(null)}>
          <Plus size={16} /> Novo lançamento
        </button>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState title="Nenhum lançamento encontrado" />
        ) : (
          <div className="table-wrap">
            <table className="data-table stack-on-mobile">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Categoria</th>
                  <th>Descrição</th>
                  <th>Membro</th>
                  <th>Método</th>
                  <th>Valor</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="Data">{formatDate(entry.date)}</td>
                    <td data-label="Tipo">
                      <span className={`badge ${entry.type === 'entrada' ? 'badge-success' : 'badge-danger'}`}>
                        {entry.type === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td data-label="Categoria">{entry.category}</td>
                    <td data-label="Descrição">{entry.description || '—'}</td>
                    <td data-label="Membro">{memberName(entry.memberId) || '—'}</td>
                    <td data-label="Método">{entry.method}</td>
                    <td data-label="Valor" className="amount">{formatCurrency(entry.amount)}</td>
                    <td data-label="Ações">
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setEditingEntry(entry)}
                          aria-label="Editar lançamento"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => setPendingDelete(entry)}
                          aria-label="Excluir lançamento"
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

      {editingEntry !== undefined && <FinanceForm entry={editingEntry} onClose={() => setEditingEntry(undefined)} />}
      {showReceiptImport && <ReceiptImport onClose={() => setShowReceiptImport(false)} />}

      {pendingDelete && (
        <ConfirmDialog
          title="Excluir lançamento"
          message="Tem certeza que deseja excluir este lançamento financeiro?"
          confirmLabel="Excluir"
          onConfirm={() => {
            removeFinanceEntry(pendingDelete.id)
            setPendingDelete(null)
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
