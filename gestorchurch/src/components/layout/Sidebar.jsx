import { LayoutDashboard, Users, Wallet, Boxes, FileText, Megaphone, Settings } from 'lucide-react'
import { useChurchData } from '../../context/DataContext.jsx'
import { useRole } from '../../context/RoleContext.jsx'

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Painel', icon: LayoutDashboard },
  { key: 'members', label: 'Membros', icon: Users },
  { key: 'finance', label: 'Financeiro', icon: Wallet },
  { key: 'assets', label: 'Patrimônio', icon: Boxes },
  { key: 'reports', label: 'Relatórios', icon: FileText },
  { key: 'mural', label: 'Mural', icon: Megaphone },
  { key: 'settings', label: 'Personalização', icon: Settings },
]

export default function Sidebar({ activePage, onNavigate }) {
  const { branding } = useChurchData()
  const { allowedPages } = useRole()
  const visibleItems = NAV_ITEMS.filter((item) => allowedPages.includes(item.key))

  return (
    <nav className="app-sidebar" aria-label="Navegação principal">
      <div className="sidebar-brand">
        {branding.logoDataUrl ? (
          <img src={branding.logoDataUrl} alt={branding.churchName} className="sidebar-logo" />
        ) : (
          <div className="sidebar-logo-placeholder" aria-hidden="true">
            {branding.churchName?.charAt(0) || 'G'}
          </div>
        )}
        <div className="sidebar-brand-text">
          <strong>GestorChurch</strong>
          <span>{branding.churchName}</span>
        </div>
      </div>

      <ul className="sidebar-nav">
        {visibleItems.map(({ key, label, icon: Icon }) => (
          <li key={key}>
            <button
              type="button"
              className={`sidebar-link ${activePage === key ? 'is-active' : ''}`}
              onClick={() => onNavigate(key)}
              aria-current={activePage === key ? 'page' : undefined}
            >
              <Icon size={20} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
