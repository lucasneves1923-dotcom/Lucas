import { useState } from 'react'
import AppShell from './components/layout/AppShell.jsx'
import Dashboard from './pages/Dashboard.jsx'
import MembersPage from './pages/Members/MembersPage.jsx'
import FinancePage from './pages/Finance/FinancePage.jsx'
import AssetsPage from './pages/Assets/AssetsPage.jsx'
import ReportsPage from './pages/Reports/ReportsPage.jsx'
import SettingsPage from './pages/Settings/SettingsPage.jsx'

const PAGES = {
  dashboard: Dashboard,
  members: MembersPage,
  finance: FinancePage,
  assets: AssetsPage,
  reports: ReportsPage,
  settings: SettingsPage,
}

export default function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const Page = PAGES[activePage] || Dashboard

  return (
    <AppShell activePage={activePage} onNavigate={setActivePage}>
      <Page onNavigate={setActivePage} />
    </AppShell>
  )
}
