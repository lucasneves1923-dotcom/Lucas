import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { DataProvider } from './context/DataContext.jsx'
import { RoleProvider } from './context/RoleContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DataProvider>
      <RoleProvider>
        <App />
      </RoleProvider>
    </DataProvider>
  </StrictMode>,
)
