import { useState } from 'react'
import AppShell from './components/layout/AppShell.jsx'
import Dashboard from './pages/Dashboard.jsx'
import MembersPage from './pages/Members/MembersPage.jsx'
import FinancePage from './pages/Finance/FinancePage.jsx'
import AssetsPage from './pages/Assets/AssetsPage.jsx'
import ReportsPage from './pages/Reports/ReportsPage.jsx'
import MuralPage from './pages/Mural/MuralPage.jsx'
import SettingsPage from './pages/Settings/SettingsPage.jsx'
import { useRole } from './context/RoleContext.jsx'

const PAGES = {
  dashboard: Dashboard,
  members: MembersPage,
  finance: FinancePage,
  assets: AssetsPage,
  reports: ReportsPage,
  mural: MuralPage,
  settings: SettingsPage,
}

export default function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const { loading, canAccess } = useRole()

  // Se o papel não permitir a página atual (ainda carregando, ou o acesso
  // mudou enquanto a pessoa estava nela), renderiza o Painel no lugar em vez
  // de uma tela vazia/proibida — sem precisar de outro ciclo de render.
  const allowed = !loading && canAccess(activePage)
  const Page = allowed ? PAGES[activePage] : Dashboard

  return (
    <AppShell activePage={activePage} onNavigate={setActivePage}>
      <Page onNavigate={setActivePage} />
    </AppShell>
  )
}
