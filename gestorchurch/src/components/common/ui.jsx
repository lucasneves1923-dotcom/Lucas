import { Check, AlertTriangle, Loader2, X } from 'lucide-react'
import { formatCurrency } from '../../lib/format'

export function Card({ title, action, children }) {
  return (
    <section className="card">
      {(title || action) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          {title && <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function StatCard({ label, value, isCurrency = true, tone }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={tone ? { color: tone } : undefined}>
        {isCurrency ? formatCurrency(value) : value}
      </div>
    </div>
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <h3 style={{ fontSize: '1rem' }}>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}

export function SaveIndicator({ saveStatus }) {
  if (saveStatus.status === 'idle') return null

  if (saveStatus.status === 'saving') {
    return (
      <span className="save-indicator">
        <Loader2 size={14} className="spin" /> Salvando…
      </span>
    )
  }

  if (saveStatus.status === 'error') {
    return (
      <span className="save-indicator is-error" title={saveStatus.reason || ''}>
        <AlertTriangle size={14} /> Falha ao salvar{saveStatus.reason ? `: ${saveStatus.reason}` : ''}
      </span>
    )
  }

  const modeLabel = saveStatus.mode === 'individual' ? 'salvo localmente (modo individual)' : 'Salvo'
  return (
    <span className="save-indicator is-saved">
      <Check size={14} /> {modeLabel}
    </span>
  )
}

export function Modal({ title, onClose, children, wide = false }) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-panel" style={wide ? { maxWidth: 880 } : undefined}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirmar', onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p>{message}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
