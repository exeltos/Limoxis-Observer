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
import './styles/global.css'
import './styles/design-system-actions.css'
import './styles/platform-owner-polish.css'
import './styles/platform-settings.css'
import './styles/design-system-layouts.css'
import './styles/analysis-toolbar.css'
import './styles/design-system-navigation.css'
import './styles/my-profile.css'
import './styles/clickable-cursor.css'
import './styles/page-density.css'
import './styles/registry-stable-viewport.css'
import './styles/control-editor-fullscreen.css'
import './styles/lira-assistant.css'
import './styles/registry-return-highlight.css'
import './styles/training-workspace.css'
import './styles/training-refinement.css'
import './styles/design-system-record-details.css'
import './styles/design-system-kpi-action-rail.css'

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
