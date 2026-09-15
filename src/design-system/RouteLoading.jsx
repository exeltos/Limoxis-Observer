import { useEffect, useState } from 'react'
import { useLanguage } from '../core/i18n/LanguageContext'

const SHOW_DELAY_MS = 150

export function RouteLoading(){
  const { t } = useLanguage()
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])
  if (!visible) return null
  return <div className="empty-state route-loading" role="status" aria-live="polite">
    <div className="route-loading-spinner" aria-hidden="true"/>
    <span>{t('loading')}</span>
  </div>
}
