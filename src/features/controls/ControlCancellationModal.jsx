import { useMemo,useState } from 'react'
import { AlertTriangle,UserRound } from 'lucide-react'
import { useAuth } from '../../core/auth/AuthContext'
import { controlActorFromAuth } from './controlActor'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'

export function ControlCancellationModal({onClose,onConfirm}){
 const {profile,user}=useAuth();const {language}=useLanguage();const en=language==='en';const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user]);const [reason,setReason]=useState('')
 return <ObserverDialog width="compact" className="control-cancel-card" eyebrow={en?'Void entry':'Αναίρεση καταχώρησης'} title={en?'Void control entry':'Ακύρωση ελέγχου'} subtitle={en?'The original entry will remain in history as voided.':'Η αρχική καταχώρηση θα παραμείνει στο ιστορικό ως ακυρωμένη.'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>{en?'Cancel':'Άκυρο'}</Button><Button variant="danger" disabled={!reason.trim()} onClick={()=>onConfirm({reason,actor})}>{en?'Void entry':'Αναίρεση καταχώρησης'}</Button></>}>
 <div className="governance-banner warning"><AlertTriangle size={17}/><span>{en?'A reason is required and the action is recorded in the audit trail.':'Η αναίρεση απαιτεί αιτιολογία και καταγράφεται στο audit trail.'}</span></div>
 <div className="control-cancel-meta"><UserRound size={16}/><span>{en?'Voided by':'Αναίρεση από'}</span><strong>{actor.name}</strong></div>
 <label className="field"><span>{en?'Reason for voiding *':'Αιτιολογία αναίρεσης *'}</span><textarea rows="4" value={reason} onChange={e=>setReason(e.target.value)} placeholder={en?'e.g. Incorrect value / entry recorded under the wrong control...':'π.χ. Λανθασμένη τιμή / καταχώρηση σε λάθος έλεγχο...'}/></label>
 </ObserverDialog>
}
