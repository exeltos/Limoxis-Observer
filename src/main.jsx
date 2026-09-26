import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './app/App'
import { AuthProvider } from './core/auth/AuthContext'
import { LanguageProvider, preloadInitialLanguage } from './core/i18n/LanguageContext'
import { TenantProvider } from './core/tenant/TenantContext'
import { FeedbackProvider } from './core/feedback/FeedbackContext'
import { NotificationProvider } from './core/notifications/NotificationContext'
import { DataAccessStatus } from './core/data/DataAccessStatus'
import { AppErrorBoundary } from './core/errors/AppErrorBoundary'
import './styles/foundation.css'
import './styles/features.css'
import './styles/design-system.css'
import './styles/workspaces.css'
import './styles/responsive.css'

// LIRA (assistant panel + analysis engine) is not needed for first paint; load it
// after the shell so it stays out of the initial bundle.
const LiraAssistantLauncher = lazy(() => import('./features/lira/LiraAssistantLauncher').then(module => ({ default: module.LiraAssistantLauncher })))
// A returning English user gets the English chunk before the first paint.
preloadInitialLanguage().then(() => ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <AppErrorBoundary>
          <AuthProvider>
            <TenantProvider><FeedbackProvider><NotificationProvider><><App /><Suspense fallback={null}><LiraAssistantLauncher/></Suspense><DataAccessStatus /></></NotificationProvider></FeedbackProvider></TenantProvider>
          </AuthProvider>
        </AppErrorBoundary>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>,
))
