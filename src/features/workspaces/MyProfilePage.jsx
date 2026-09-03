import { Page } from '../../design-system/Page'
import { useLanguage } from '../../core/i18n/LanguageContext'

export function MyProfilePage(){
 const {language}=useLanguage();const en=language==='en'
 return <Page title={en?'My profile':'Το προφίλ μου'} subtitle={en?'Account details first, with employee-record information shown only when a linked employee record exists.':'Πρώτα εμφανίζονται τα στοιχεία του λογαριασμού και, μόνο όταν υπάρχει σύνδεση, τα στοιχεία της καρτέλας εργαζομένου.'}><div className="surface"><div className="inline-empty">{en?'Employee-record information is shown only when this account is linked to an employee record.':'Τα στοιχεία καρτέλας εργαζομένου εμφανίζονται μόνο όταν ο λογαριασμός έχει συνδεθεί με εγγραφή εργαζομένου.'}</div></div></Page>
}
