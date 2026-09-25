import { useState } from 'react'
import { Modal } from '../../components/common/ui.jsx'
import { useChurchData } from '../../context/DataContext.jsx'
import { ASSET_CATEGORIES, ASSET_STATUSES, defaultUsefulLife } from '../../lib/constants'
import { todayIso } from '../../lib/format'

function initialForm(asset) {
  return {
    description: asset?.description || '',
    category: asset?.category || ASSET_CATEGORIES[0].name,
    brand: asset?.brand || '',
    model: asset?.model || '',
    quantity: asset?.quantity ?? 1,
    unitValue: asset?.unitValue ?? '',
    residualValue: asset?.residualValue ?? 0,
    acquisitionDate: asset?.acquisitionDate || todayIso(),
    usefulLifeYears: asset?.usefulLifeYears ?? defaultUsefulLife(asset?.category || ASSET_CATEGORIES[0].name),
    status: asset?.status || 'em_uso',
    location: asset?.location || '',
    notes: asset?.notes || '',
  }
}

export default function AssetForm({ asset, onClose }) {
  const { addAsset, updateAsset } = useChurchData()
  const [form, setForm] = useState(() => initialForm(asset))
  const [error, setError] = useState('')
  const isEditing = Boolean(asset)

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleCategoryChange(category) {
    setForm((prev) => ({ ...prev, category, usefulLifeYears: defaultUsefulLife(category) }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.description.trim()) {
      setError('Descrição é obrigatória.')
      return
    }
    if (!form.unitValue || Number(form.unitValue) < 0) {
      setError('Informe um valor unitário válido.')
      return
    }
    const payload = {
      ...form,
      quantity: Number(form.quantity) || 1,
      unitValue: Number(form.unitValue),
      residualValue: Number(form.residualValue) || 0,
      usefulLifeYears: Number(form.usefulLifeYears) || 1,
    }
    if (isEditing) {
      updateAsset(asset.id, payload)
    } else {
      addAsset(payload)
    }
    onClose()
  }

  return (
    <Modal title={isEditing ? 'Editar bem' : 'Novo bem'} onClose={onClose} wide>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="description">Descrição *</label>
          <input
            id="description"
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            autoFocus
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="category">Categoria</label>
            <select id="category" value={form.category} onChange={(e) => handleCategoryChange(e.target.value)}>
              {ASSET_CATEGORIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="brand">Marca</label>
            <input id="brand" value={form.brand} onChange={(e) => setField('brand', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="model">Modelo</label>
            <input id="model" value={form.model} onChange={(e) => setField('model', e.target.value)} />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="quantity">Quantidade</label>
            <input
              id="quantity"
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) => setField('quantity', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="unitValue">Valor unitário (R$)</label>
            <input
              id="unitValue"
              type="number"
              step="0.01"
              min="0"
              value={form.unitValue}
              onChange={(e) => setField('unitValue', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="residualValue">Valor residual unit. (R$)</label>
            <input
              id="residualValue"
              type="number"
              step="0.01"
              min="0"
              value={form.residualValue}
              onChange={(e) => setField('residualValue', e.target.value)}
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="acquisitionDate">Data de aquisição</label>
            <input
              id="acquisitionDate"
              type="date"
              value={form.acquisitionDate}
              onChange={(e) => setField('acquisitionDate', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="usefulLifeYears">Vida útil (anos)</label>
            <input
              id="usefulLifeYears"
              type="number"
              min="1"
              value={form.usefulLifeYears}
              onChange={(e) => setField('usefulLifeYears', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" value={form.status} onChange={(e) => setField('status', e.target.value)}>
              {ASSET_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="location">Localização</label>
          <input id="location" value={form.location} onChange={(e) => setField('location', e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="notes">Observações</label>
          <textarea id="notes" rows={3} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
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
