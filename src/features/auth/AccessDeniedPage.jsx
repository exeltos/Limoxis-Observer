import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { Page } from '../../design-system/Page'

export function AccessDeniedPage() {
  const { language } = useLanguage()
  const english = language === 'en'

  return <Page title={english ? 'Access denied' : 'Δεν επιτρέπεται η πρόσβαση'}>
    <div className="empty-state" role="alert">
      <ShieldAlert size={34} aria-hidden="true" />
      <h2>{english ? 'This area is not available for your current role.' : 'Αυτή η περιοχή δεν είναι διαθέσιμη για τον τρέχοντα ρόλο σας.'}</h2>
      <p>{english ? 'Choose an available section from the navigation or return to your workspace.' : 'Επιλέξτε μια διαθέσιμη ενότητα από την πλοήγηση ή επιστρέψτε στον χώρο εργασίας σας.'}</p>
      <Link className="button secondary" to="/">{english ? 'Return to workspace' : 'Επιστροφή στον χώρο εργασίας'}</Link>
    </div>
  </Page>
}
