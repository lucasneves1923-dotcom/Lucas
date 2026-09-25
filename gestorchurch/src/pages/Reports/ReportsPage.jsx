import { useState } from 'react'
import PeriodReport from './PeriodReport.jsx'
import ContributionsReport from './ContributionsReport.jsx'
import AssetsReport from './AssetsReport.jsx'

const TABS = [
  { key: 'period', label: 'Por período', Component: PeriodReport },
  { key: 'contributions', label: 'Contribuições por membro', Component: ContributionsReport },
  { key: 'assets', label: 'Patrimônio', Component: AssetsReport },
]

export default function ReportsPage() {
  const [tab, setTab] = useState('period')
  const Active = TABS.find((t) => t.key === tab)?.Component || PeriodReport

  return (
    <div>
      <div className="page-header no-print">
        <div>
          <h1>Relatórios</h1>
          <p className="page-subtitle">Financeiro, contribuições e patrimônio</p>
        </div>
      </div>

      <div className="tabs no-print">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`tab-btn ${tab === key ? 'is-active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <Active />
    </div>
  )
}
