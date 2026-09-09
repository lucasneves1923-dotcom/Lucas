import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useChurchData } from '../../context/DataContext.jsx'
import { Card, ConfirmDialog, EmptyState } from '../../components/common/ui.jsx'
import { formatCurrency, formatDate } from '../../lib/format'
import { calculateDepreciation } from '../../lib/depreciation'
import { ASSET_STATUSES } from '../../lib/constants'
import AssetForm from './AssetForm.jsx'

const STATUS_LABELS = Object.fromEntries(ASSET_STATUSES.map((s) => [s.value, s.label]))
const STATUS_BADGE = { em_uso: 'badge-success', manutencao: 'badge-warning', baixado: 'badge-danger' }

export default function AssetsPage() {
  const { assets, removeAsset } = useChurchData()
  const [editingAsset, setEditingAsset] = useState(undefined)
  const [pendingDelete, setPendingDelete] = useState(null)

  const rows = useMemo(
    () => assets.map((asset) => ({ asset, depreciation: calculateDepreciation(asset) })),
    [assets],
  )

  const netTotal = rows.reduce((sum, r) => sum + r.depreciation.bookValue, 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Patrimônio</h1>
          <p className="page-subtitle">
            {assets.length} bem(ns) cadastrado(s) · Valor contábil líquido: {formatCurrency(netTotal)}
          </p>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-spacer" />
        <button type="button" className="btn btn-primary" onClick={() => setEditingAsset(null)}>
          <Plus size={16} /> Novo bem
        </button>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="Nenhum bem cadastrado" description="Cadastre móveis, equipamentos, veículos e imóveis da igreja." />
        ) : (
          <div className="table-wrap">
            <table className="data-table stack-on-mobile">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Aquisição</th>
                  <th>Valor total</th>
                  <th>Depr. acumulada</th>
                  <th>Valor contábil</th>
                  <th>Status</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ asset, depreciation }) => (
                  <tr key={asset.id}>
                    <td data-label="Descrição">
                      {asset.description}
                      {asset.quantity > 1 ? ` (x${asset.quantity})` : ''}
                    </td>
                    <td data-label="Categoria">{asset.category}</td>
                    <td data-label="Aquisição">{formatDate(asset.acquisitionDate)}</td>
                    <td data-label="Valor total" className="amount">{formatCurrency(depreciation.totalValue)}</td>
                    <td data-label="Depr. acumulada" className="amount">
                      {formatCurrency(depreciation.accumulatedDepreciation)}
                    </td>
                    <td data-label="Valor contábil" className="amount">{formatCurrency(depreciation.bookValue)}</td>
                    <td data-label="Status">
                      <span className={`badge ${STATUS_BADGE[asset.status] || ''}`}>
                        {STATUS_LABELS[asset.status] || asset.status}
                      </span>
                    </td>
                    <td data-label="Ações">
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setEditingAsset(asset)}
                          aria-label={`Editar ${asset.description}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => setPendingDelete(asset)}
                          aria-label={`Excluir ${asset.description}`}
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

      {editingAsset !== undefined && <AssetForm asset={editingAsset} onClose={() => setEditingAsset(undefined)} />}

      {pendingDelete && (
        <ConfirmDialog
          title="Excluir bem"
          message={`Tem certeza que deseja excluir "${pendingDelete.description}"?`}
          confirmLabel="Excluir"
          onConfirm={() => {
            removeAsset(pendingDelete.id)
            setPendingDelete(null)
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
