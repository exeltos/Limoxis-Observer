import { Page } from '../../design-system/Page'
import { useLanguage } from '../../core/i18n/LanguageContext'

export function PharmacyPage(){
 const {language}=useLanguage();const en=language==='en'
 return <Page title={en?'Pharmacy':'Φαρμακείο'} subtitle={en?'Antimicrobial stewardship, advanced antibiotics, approvals and consumption / DDD.':'Αντιμικροβιακή επιτήρηση, προωθημένα αντιβιοτικά, εγκρίσεις και κατανάλωση / DDD.'}><div className="surface"><div className="inline-empty">{en?'The stewardship workflow will connect to structured clinical approvals.':'Το stewardship workflow θα συνδεθεί με δομημένα clinical approvals.'}</div></div></Page>
}
