import { useState } from 'react'
import { Modal } from '../../components/common/ui.jsx'
import { useChurchData } from '../../context/DataContext.jsx'
import { MEMBER_ROLES, MEMBER_STATUSES } from '../../lib/constants'

function initialForm(member) {
  return {
    fullName: member?.fullName || '',
    phone: member?.phone || '',
    email: member?.email || '',
    address: member?.address || '',
    birthDate: member?.birthDate || '',
    memberSince: member?.memberSince || '',
    status: member?.status || 'Ativo',
    role: member?.role || 'Membro',
    congregationId: member?.congregationId || '',
    notes: member?.notes || '',
  }
}

export default function MemberForm({ member, onClose }) {
  const { congregations, addMember, updateMember } = useChurchData()
  const [form, setForm] = useState(() => initialForm(member))
  const [error, setError] = useState('')
  const isEditing = Boolean(member)

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.fullName.trim()) {
      setError('Nome completo é obrigatório.')
      return
    }
    if (isEditing) {
      updateMember(member.id, form)
    } else {
      addMember(form)
    }
    onClose()
  }

  return (
    <Modal title={isEditing ? 'Editar membro' : 'Novo membro'} onClose={onClose} wide>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="fullName">Nome completo *</label>
          <input
            id="fullName"
            value={form.fullName}
            onChange={(e) => setField('fullName', e.target.value)}
            autoFocus
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="phone">Telefone</label>
            <input id="phone" value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="address">Endereço</label>
          <input id="address" value={form.address} onChange={(e) => setField('address', e.target.value)} />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="birthDate">Data de nascimento</label>
            <input
              id="birthDate"
              type="date"
              value={form.birthDate}
              onChange={(e) => setField('birthDate', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="memberSince">Membro desde</label>
            <input
              id="memberSince"
              type="date"
              value={form.memberSince}
              onChange={(e) => setField('memberSince', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" value={form.status} onChange={(e) => setField('status', e.target.value)}>
              {MEMBER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="role">Função/Cargo</label>
            <select id="role" value={form.role} onChange={(e) => setField('role', e.target.value)}>
              {MEMBER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="congregationId">Congrega em</label>
            <select
              id="congregationId"
              value={form.congregationId}
              onChange={(e) => setField('congregationId', e.target.value)}
            >
              <option value="">— Não definida —</option>
              {congregations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="notes">Observações</label>
          <textarea id="notes" rows={3} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
        </div>

        {error && (
          <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>{error}</p>
        )}

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
