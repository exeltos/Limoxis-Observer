import { useLanguage } from '../core/i18n/LanguageContext'

export function RouteLoading(){
  const { t } = useLanguage()
  return <div className="empty-state route-loading" role="status" aria-live="polite">
    <div className="route-loading-spinner" aria-hidden="true"/>
    <span>{t('loading')}</span>
  </div>
}
