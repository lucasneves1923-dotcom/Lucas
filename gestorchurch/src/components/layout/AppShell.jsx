import Sidebar from './Sidebar.jsx'
import { SaveIndicator } from '../common/ui.jsx'
import { useChurchData } from '../../context/DataContext.jsx'

export default function AppShell({ activePage, onNavigate, children }) {
  const { saveStatus } = useChurchData()

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={onNavigate} />
      <main className="app-main">
        <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <SaveIndicator saveStatus={saveStatus} />
        </div>
        {children}
      </main>
    </div>
  )
}
