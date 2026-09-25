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
import './styles/surveillance-workflow-preview.css'
import './styles/auth.css'
import './styles/classic-rebase.css'
import './styles/design-system-actions.css'
import './styles/platform-owner-polish.css'
import './styles/canonical-registry-visual.css'
import './styles/filterbar-final.css'
import './styles/training-refinements.css'
import './styles/prevention-refinements.css'
import './styles/surveillance-library-dropdown-fix.css'
import './styles/surveillance-flow-polish.css'
import './styles/patient-workspace-polish.css'
import './styles/clinical-loading.css'
import './styles/canonical-tabs-final.css'
import './styles/analysis-print.css'
import './styles/tabs-unified.css'
import './styles/short-viewport.css'
import './styles/tablet-rail.css'
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
