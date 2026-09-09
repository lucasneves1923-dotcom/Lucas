import { Loader2 } from 'lucide-react'
import Sidebar from './Sidebar.jsx'
import { SaveIndicator } from '../common/ui.jsx'
import { useChurchData } from '../../context/DataContext.jsx'

export default function AppShell({ activePage, onNavigate, children }) {
  const { saveStatus, isLoading } = useChurchData()

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={onNavigate} />
      <main className="app-main">
        <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <SaveIndicator saveStatus={saveStatus} />
        </div>
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-text-muted)', padding: '40px 0' }}>
            <Loader2 size={18} className="spin" /> Carregando dados…
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  )
}
