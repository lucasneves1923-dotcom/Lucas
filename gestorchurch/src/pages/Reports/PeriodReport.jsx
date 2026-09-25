import { useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { useChurchData } from '../../context/DataContext.jsx'
import { Card, EmptyState } from '../../components/common/ui.jsx'
import { formatCurrency, formatDate, todayIso } from '../../lib/format'

function firstDayOfMonth() {
  return `${todayIso().slice(0, 7)}-01`
}

export default function PeriodReport() {
  const { financeEntries, branding } = useChurchData()
  const [startDate, setStartDate] = useState(firstDayOfMonth())
  const [endDate, setEndDate] = useState(todayIso())

  const entriesInRange = useMemo(
    () =>
      financeEntries
        .filter((e) => e.date >= startDate && e.date <= endDate)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [financeEntries, startDate, endDate],
  )

  const totals = useMemo(() => {
    const income = entriesInRange.filter((e) => e.type === 'entrada')
    const expense = entriesInRange.filter((e) => e.type === 'saida')
    const sum = (list) => list.reduce((total, e) => total + Number(e.amount), 0)
    return {
      income: sum(income),
      expense: sum(expense),
      balance: sum(income) - sum(expense),
    }
  }, [entriesInRange])

  const byCategory = useMemo(() => {
    const build = (type) => {
      const totalsMap = new Map()
      entriesInRange
        .filter((e) => e.type === type)
        .forEach((e) => totalsMap.set(e.category, (totalsMap.get(e.category) || 0) + Number(e.amount)))
      return Array.from(totalsMap.entries()).sort((a, b) => b[1] - a[1])
    }
    return { income: build('entrada'), expense: build('saida') }
  }, [entriesInRange])

  return (
    <div>
      <Card>
        <div className="field-row no-print" style={{ alignItems: 'flex-end' }}>
          <div className="field">
            <label htmlFor="startDate">De</label>
            <input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="endDate">Até</label>
            <input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 14 }}>
            <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
              <Printer size={16} /> Imprimir
            </button>
          </div>
        </div>

        <h2 style={{ marginTop: 0 }}>{branding.churchName}</h2>
        <p className="text-muted">
          Relatório financeiro de {formatDate(startDate)} até {formatDate(endDate)}
        </p>

        <div className="grid grid-stats" style={{ margin: '16px 0' }}>
          <div className="stat-card">
            <div className="stat-label">Entradas</div>
            <div className="stat-value" style={{ color: 'var(--color-success)' }}>{formatCurrency(totals.income)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Saídas</div>
            <div className="stat-value" style={{ color: 'var(--color-danger)' }}>{formatCurrency(totals.expense)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Saldo do período</div>
            <div className="stat-value">{formatCurrency(totals.balance)}</div>
          </div>
        </div>

        {entriesInRange.length === 0 ? (
          <EmptyState title="Nenhum lançamento no período selecionado" />
        ) : (
          <>
            <div className="grid grid-2" style={{ marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: '0.95rem' }}>Entradas por categoria</h3>
                <CategoryTable rows={byCategory.income} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.95rem' }}>Saídas por categoria</h3>
                <CategoryTable rows={byCategory.expense} />
              </div>
            </div>

            <h3 style={{ fontSize: '0.95rem' }}>Detalhamento</h3>
            <div className="table-wrap">
              <table className="data-table stack-on-mobile">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Categoria</th>
                    <th>Descrição</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {entriesInRange.map((entry) => (
                    <tr key={entry.id}>
                      <td data-label="Data">{formatDate(entry.date)}</td>
                      <td data-label="Tipo">{entry.type === 'entrada' ? 'Entrada' : 'Saída'}</td>
                      <td data-label="Categoria">{entry.category}</td>
                      <td data-label="Descrição">{entry.description || '—'}</td>
                      <td data-label="Valor" className="amount">{formatCurrency(entry.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

function CategoryTable({ rows }) {
  if (rows.length === 0) return <p className="text-muted">Sem lançamentos.</p>
  return (
    <table className="data-table">
      <tbody>
        {rows.map(([category, total]) => (
          <tr key={category}>
            <td>{category}</td>
            <td className="amount" style={{ textAlign: 'right' }}>{formatCurrency(total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
