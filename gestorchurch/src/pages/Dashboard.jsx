import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useChurchData } from '../context/DataContext.jsx'
import { Card, StatCard, EmptyState } from '../components/common/ui.jsx'
import { formatCurrency, formatDate, formatMonthLabel, monthKey, todayIso } from '../lib/format'
import { calculateDepreciation } from '../lib/depreciation'

const CHART_COLORS = ['#b8934a', '#17222b', '#7d9d8c', '#c46b4f', '#5b6773', '#e4cfa0', '#8a6a2e']

function lastSixMonthKeys() {
  const keys = []
  const now = new Date()
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

export default function Dashboard() {
  const { members, financeEntries, assets } = useChurchData()

  const currentMonth = monthKey(todayIso())

  const cashBalance = useMemo(
    () =>
      financeEntries.reduce(
        (sum, e) => sum + (e.type === 'entrada' ? Number(e.amount) : -Number(e.amount)),
        0,
      ),
    [financeEntries],
  )

  const monthIncome = useMemo(
    () =>
      financeEntries
        .filter((e) => e.type === 'entrada' && monthKey(e.date) === currentMonth)
        .reduce((sum, e) => sum + Number(e.amount), 0),
    [financeEntries, currentMonth],
  )

  const monthExpense = useMemo(
    () =>
      financeEntries
        .filter((e) => e.type === 'saida' && monthKey(e.date) === currentMonth)
        .reduce((sum, e) => sum + Number(e.amount), 0),
    [financeEntries, currentMonth],
  )

  const activeMembers = useMemo(() => members.filter((m) => m.status === 'Ativo').length, [members])

  const netAssets = useMemo(
    () => assets.reduce((sum, asset) => sum + calculateDepreciation(asset).bookValue, 0),
    [assets],
  )

  const monthlySeries = useMemo(() => {
    const keys = lastSixMonthKeys()
    return keys.map((key) => {
      const entriesInMonth = financeEntries.filter((e) => monthKey(e.date) === key)
      return {
        month: formatMonthLabel(`${key}-01`),
        entradas: entriesInMonth
          .filter((e) => e.type === 'entrada')
          .reduce((sum, e) => sum + Number(e.amount), 0),
        saidas: entriesInMonth
          .filter((e) => e.type === 'saida')
          .reduce((sum, e) => sum + Number(e.amount), 0),
      }
    })
  }, [financeEntries])

  const expenseByCategory = useMemo(() => {
    const totals = new Map()
    financeEntries
      .filter((e) => e.type === 'saida' && monthKey(e.date) === currentMonth)
      .forEach((e) => {
        totals.set(e.category, (totals.get(e.category) || 0) + Number(e.amount))
      })
    return Array.from(totals.entries()).map(([name, value]) => ({ name, value }))
  }, [financeEntries, currentMonth])

  const latestEntries = useMemo(
    () =>
      [...financeEntries]
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .slice(0, 8),
    [financeEntries],
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Painel</h1>
          <p className="page-subtitle">Visão geral financeira e administrativa</p>
        </div>
      </div>

      <div className="grid grid-stats" style={{ marginBottom: 16 }}>
        <StatCard label="Saldo em caixa" value={cashBalance} tone={cashBalance < 0 ? 'var(--color-danger)' : undefined} />
        <StatCard label="Entradas do mês" value={monthIncome} tone="var(--color-success)" />
        <StatCard label="Saídas do mês" value={monthExpense} tone="var(--color-danger)" />
        <StatCard label="Membros ativos" value={activeMembers} isCurrency={false} />
        <StatCard label="Patrimônio líquido" value={netAssets} />
      </div>

      <div className="grid grid-2">
        <Card title="Entradas x Saídas (últimos 6 meses)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dde2db" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(v).replace(/ /g, ' ')} width={90} />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="entradas" name="Entradas" fill="#2f7d5a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill="#b3462c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Despesas do mês por categoria">
          {expenseByCategory.length === 0 ? (
            <EmptyState title="Sem despesas registradas neste mês" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={expenseByCategory} dataKey="value" nameKey="name" outerRadius={95} label>
                  {expenseByCategory.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card title="Últimos lançamentos">
        {latestEntries.length === 0 ? (
          <EmptyState title="Nenhum lançamento ainda" description="Cadastre entradas e saídas no módulo Financeiro." />
        ) : (
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
                {latestEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="Data">{formatDate(entry.date)}</td>
                    <td data-label="Tipo">
                      <span className={`badge ${entry.type === 'entrada' ? 'badge-success' : 'badge-danger'}`}>
                        {entry.type === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td data-label="Categoria">{entry.category}</td>
                    <td data-label="Descrição">{entry.description || '—'}</td>
                    <td data-label="Valor" className="amount">{formatCurrency(entry.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
