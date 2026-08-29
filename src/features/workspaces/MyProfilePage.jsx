import { Page } from '../../design-system/Page'
import { useLanguage } from '../../core/i18n/LanguageContext'

export function MyProfilePage(){
 const {language}=useLanguage();const en=language==='en'
 return <Page title={en?'My profile':'Η καρτέλα μου'} subtitle={en?'Details, department/role, vaccinations, Occupational Health, training and certifications — with read-only limits where required.':'Στοιχεία, τμήμα/ιδιότητα, εμβολιασμοί, Ιατρός Εργασίας, εκπαιδεύσεις και πιστοποιήσεις - με read-only όρια όπου απαιτείται.'}><div className="surface"><div className="inline-empty">{en?'The personal record shows only data belonging to the signed-in employee.':'Η προσωπική καρτέλα θα εμφανίζει μόνο τα δεδομένα του συνδεδεμένου εργαζομένου.'}</div></div></Page>
}
