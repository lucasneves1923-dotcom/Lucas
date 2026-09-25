import { useMemo } from 'react'
import { Printer } from 'lucide-react'
import { useChurchData } from '../../context/DataContext.jsx'
import { Card, EmptyState } from '../../components/common/ui.jsx'
import { formatCurrency, formatDate, todayIso } from '../../lib/format'
import { calculateDepreciation } from '../../lib/depreciation'

export default function AssetsReport() {
  const { assets, branding } = useChurchData()

  const rows = useMemo(
    () => assets.map((asset) => ({ asset, depreciation: calculateDepreciation(asset) })),
    [assets],
  )

  const totals = rows.reduce(
    (acc, { depreciation }) => ({
      totalValue: acc.totalValue + depreciation.totalValue,
      accumulatedDepreciation: acc.accumulatedDepreciation + depreciation.accumulatedDepreciation,
      bookValue: acc.bookValue + depreciation.bookValue,
    }),
    { totalValue: 0, accumulatedDepreciation: 0, bookValue: 0 },
  )

  const byCategory = useMemo(() => {
    const map = new Map()
    rows.forEach(({ asset, depreciation }) => {
      const current = map.get(asset.category) || { totalValue: 0, bookValue: 0 }
      map.set(asset.category, {
        totalValue: current.totalValue + depreciation.totalValue,
        bookValue: current.bookValue + depreciation.bookValue,
      })
    })
    return Array.from(map.entries())
  }, [rows])

  return (
    <Card>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
          <Printer size={16} /> Imprimir
        </button>
      </div>

      <h2 style={{ marginTop: 0 }}>{branding.churchName}</h2>
      <p className="text-muted">Relatório de patrimônio — gerado em {formatDate(todayIso())}</p>

      <div className="grid grid-stats" style={{ margin: '16px 0' }}>
        <div className="stat-card">
          <div className="stat-label">Valor total de aquisição</div>
          <div className="stat-value">{formatCurrency(totals.totalValue)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Depreciação acumulada</div>
          <div className="stat-value">{formatCurrency(totals.accumulatedDepreciation)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Valor contábil líquido</div>
          <div className="stat-value">{formatCurrency(totals.bookValue)}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nenhum bem cadastrado" />
      ) : (
        <>
          <h3 style={{ fontSize: '0.95rem' }}>Por categoria</h3>
          <table className="data-table" style={{ marginBottom: 20 }}>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Valor de aquisição</th>
                <th>Valor contábil</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map(([category, values]) => (
                <tr key={category}>
                  <td>{category}</td>
                  <td className="amount">{formatCurrency(values.totalValue)}</td>
                  <td className="amount">{formatCurrency(values.bookValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ fontSize: '0.95rem' }}>Lista completa</h3>
          <div className="table-wrap">
            <table className="data-table stack-on-mobile">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Aquisição</th>
                  <th>Valor aquisição</th>
                  <th>Depr. acumulada</th>
                  <th>Valor contábil</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ asset, depreciation }) => (
                  <tr key={asset.id}>
                    <td data-label="Descrição">{asset.description}</td>
                    <td data-label="Categoria">{asset.category}</td>
                    <td data-label="Aquisição">{formatDate(asset.acquisitionDate)}</td>
                    <td data-label="Valor aquisição" className="amount">{formatCurrency(depreciation.totalValue)}</td>
                    <td data-label="Depr. acumulada" className="amount">
                      {formatCurrency(depreciation.accumulatedDepreciation)}
                    </td>
                    <td data-label="Valor contábil" className="amount">{formatCurrency(depreciation.bookValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  )
}
