import { Page } from '../../design-system/Page'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { EnvironmentalAnnualPlan } from '../surveillance/EnvironmentalAnnualPlan'

// The annual culture plan (the culture sampling programme month by month and department by department) on a page of its own.
export function CulturePlanPage() {
  const { language } = useLanguage()
  const en = language === 'en'
  return <Page fill className="registry-fill-page" title={en ? 'Culture plan' : 'Πλάνο καλλιεργειών'} subtitle={en ? 'The culture sampling of the year, month by month and department by department: what was taken, what was missed, what is planned.' : 'Η δειγματοληψία καλλιεργειών του έτους, ανά μήνα και τμήμα: τι έγινε, τι χάθηκε, τι έρχεται.'}>
    <section className="surface registry-workspace workspace-fill"><EnvironmentalAnnualPlan /></section>
  </Page>
}
