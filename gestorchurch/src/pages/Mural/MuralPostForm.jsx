import { useState } from 'react'
import { Modal } from '../../components/common/ui.jsx'

function initialForm(post) {
  return {
    title: post?.title || '',
    eventDate: post?.eventDate || '',
    body: post?.body || '',
  }
}

export default function MuralPostForm({ post, onSave, onClose }) {
  const [form, setForm] = useState(() => initialForm(post))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const isEditing = Boolean(post)

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Dê um título ao aviso/evento.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setError(err.message || 'Não foi possível salvar.')
      setSaving(false)
    }
  }

  return (
    <Modal title={isEditing ? 'Editar aviso' : 'Novo aviso no mural'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="muralTitle">Título</label>
          <input
            id="muralTitle"
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            autoFocus
          />
        </div>

        <div className="field">
          <label htmlFor="muralEventDate">Data do evento (opcional)</label>
          <input
            id="muralEventDate"
            type="date"
            value={form.eventDate}
            onChange={(e) => setField('eventDate', e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="muralBody">Detalhes</label>
          <textarea
            id="muralBody"
            rows={5}
            value={form.body}
            onChange={(e) => setField('body', e.target.value)}
            placeholder="Do que se trata, horário, local…"
          />
        </div>

        {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Publicar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
