import { useMemo, useState } from 'react'
import { Modal } from '../../components/common/ui.jsx'
import { useChurchData } from '../../context/DataContext.jsx'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from '../../lib/constants'
import { todayIso } from '../../lib/format'

function initialForm(entry) {
  return {
    type: entry?.type || 'entrada',
    category: entry?.category || INCOME_CATEGORIES[0],
    amount: entry?.amount ?? '',
    date: entry?.date || todayIso(),
    method: entry?.method || 'Pix',
    description: entry?.description || '',
    memberId: entry?.memberId || '',
  }
}

export default function FinanceForm({ entry, initialValues, title, reviewNotice, onClose }) {
  const { members, addFinanceEntry, updateFinanceEntry } = useChurchData()
  const [form, setForm] = useState(() => initialForm(entry || initialValues))
  const [error, setError] = useState('')
  const isEditing = Boolean(entry)

  const categories = form.type === 'entrada' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR')),
    [members],
  )

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleTypeChange(type) {
    const nextCategories = type === 'entrada' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
    setForm((prev) => ({ ...prev, type, category: nextCategories[0] }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const amount = Number(form.amount)
    if (!amount || amount <= 0) {
      setError('Informe um valor válido maior que zero.')
      return
    }
    if (!form.date) {
      setError('Informe a data do lançamento.')
      return
    }
    const payload = { ...form, amount }
    if (isEditing) {
      updateFinanceEntry(entry.id, payload)
    } else {
      addFinanceEntry(payload)
    }
    onClose()
  }

  return (
    <Modal title={title || (isEditing ? 'Editar lançamento' : 'Novo lançamento')} onClose={onClose}>
      {reviewNotice && (
        <p className="text-muted" style={{ marginTop: -4 }}>
          {reviewNotice}
        </p>
      )}
      <form onSubmit={handleSubmit}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="type">Tipo</label>
            <select id="type" value={form.type} onChange={(e) => handleTypeChange(e.target.value)}>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="category">Categoria</label>
            <select id="category" value={form.category} onChange={(e) => setField('category', e.target.value)}>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="amount">Valor (R$)</label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setField('amount', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="date">Data</label>
            <input id="date" type="date" value={form.date} onChange={(e) => setField('date', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="method">Método</label>
            <select id="method" value={form.method} onChange={(e) => setField('method', e.target.value)}>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="memberId">Membro (opcional)</label>
          <select id="memberId" value={form.memberId} onChange={(e) => setField('memberId', e.target.value)}>
            <option value="">— Não vinculado —</option>
            {sortedMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="description">Descrição</label>
          <input id="description" value={form.description} onChange={(e) => setField('description', e.target.value)} />
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
