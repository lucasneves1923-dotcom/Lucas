import { useState } from 'react'
import BrandingSettings from './BrandingSettings.jsx'
import CongregationsSettings from './CongregationsSettings.jsx'
import UsersSettings from './UsersSettings.jsx'
import DiagnosticsSettings from './DiagnosticsSettings.jsx'
import BackupSettings from './BackupSettings.jsx'

const TABS = [
  { key: 'branding', label: 'Identidade visual', Component: BrandingSettings },
  { key: 'congregations', label: 'Congregações', Component: CongregationsSettings },
  { key: 'users', label: 'Usuários', Component: UsersSettings },
  { key: 'diagnostics', label: 'Diagnóstico', Component: DiagnosticsSettings },
  { key: 'backup', label: 'Backup', Component: BackupSettings },
]

export default function SettingsPage() {
  const [tab, setTab] = useState('branding')
  const Active = TABS.find((t) => t.key === tab)?.Component || BrandingSettings

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Personalização</h1>
          <p className="page-subtitle">Marca, congregações, usuários, diagnóstico e backup</p>
        </div>
      </div>

      <div className="tabs">
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
