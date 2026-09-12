import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './app/App'
import { AuthProvider } from './core/auth/AuthContext'
import { LanguageProvider } from './core/i18n/LanguageContext'
import { TenantProvider } from './core/tenant/TenantContext'
import { FeedbackProvider } from './core/feedback/FeedbackContext'
import { NotificationProvider } from './core/notifications/NotificationContext'
import { DataAccessStatus } from './core/data/DataAccessStatus'
import { AppErrorBoundary } from './core/errors/AppErrorBoundary'
import { LiraAssistantLauncher } from './features/lira/LiraAssistantLauncher'
import './styles/theme.css'
import './styles/core.css'
import './styles/design-system-navigation.css'
import './styles/modules.css'
import './styles/modern.css'
import './styles/registry.css'
import './styles/patient-record.css'
import './styles/auth.css'
import './styles/classic-rebase.css'
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <AppErrorBoundary>
          <AuthProvider>
            <TenantProvider><FeedbackProvider><NotificationProvider><><App /><LiraAssistantLauncher/><DataAccessStatus /></></NotificationProvider></FeedbackProvider></TenantProvider>
          </AuthProvider>
        </AppErrorBoundary>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>,
)