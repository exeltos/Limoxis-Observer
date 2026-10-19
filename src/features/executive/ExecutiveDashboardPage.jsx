import { Page } from '../../design-system/Page'
import { useLanguage } from '../../core/i18n/LanguageContext'

export function ExecutiveDashboardPage(){
  const {t}=useLanguage()
  return <Page title={t('executiveDashboard')}/>
}
