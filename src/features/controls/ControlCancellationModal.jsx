import { useMemo,useState } from 'react'
import { AlertTriangle,UserRound } from 'lucide-react'
import { useAuth } from '../../core/auth/AuthContext'
import { controlActorFromAuth } from './controlActor'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'

export function ControlCancellationModal({onClose,onConfirm,mode='void'}){
 const {profile,user}=useAuth();const {language}=useLanguage();const en=language==='en';const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user]);const [reason,setReason]=useState('')
 const deleting=mode==='delete'
 const eyebrow=deleting?(en?'Delete entry':'Διαγραφή καταχώρησης'):(en?'Void entry':'Αναίρεση καταχώρησης')
 const title=deleting?(en?'Delete control entry':'Διαγραφή εκτέλεσης'):(en?'Void control entry':'Ακύρωση ελέγχου')
 const subtitle=deleting?(en?'The entry will be marked as deleted but preserved in the audit trail.':'Η εγγραφή θα σημειωθεί ως διαγραμμένη, αλλά θα διατηρηθεί στο audit trail.'):(en?'The original entry will remain in history as voided.':'Η αρχική καταχώρηση θα παραμείνει στο ιστορικό ως ακυρωμένη.')
 const actionLabel=deleting?(en?'Delete entry':'Διαγραφή καταχώρησης'):(en?'Void entry':'Αναίρεση καταχώρησης')
 return <ObserverDialog width="compact" className="control-cancel-card" eyebrow={eyebrow} title={title} subtitle={subtitle} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>{en?'Cancel':'Άκυρο'}</Button><Button variant="danger" disabled={!reason.trim()} onClick={()=>onConfirm({reason,actor})}>{actionLabel}</Button></>}>
 <div className="governance-banner warning"><AlertTriangle size={17}/><span>{deleting?(en?'A reason is required. The action is preserved in the audit trail instead of hard-deleting the clinical governance record.':'Απαιτείται αιτιολογία. Η ενέργεια διατηρείται στο audit trail αντί να γίνεται οριστική διαγραφή του ελεγχόμενου αρχείου.'):(en?'A reason is required and the action is recorded in the audit trail.':'Η αναίρεση απαιτεί αιτιολογία και καταγράφεται στο audit trail.')}</span></div>
 <div className="control-cancel-meta"><UserRound size={16}/><span>{deleting?(en?'Deleted by':'Διαγραφή από'):(en?'Voided by':'Αναίρεση από')}</span><strong>{actor.name}</strong></div>
 <label className="field"><span>{deleting?(en?'Reason for deletion *':'Αιτιολογία διαγραφής *'):(en?'Reason for voiding *':'Αιτιολογία αναίρεσης *')}</span><textarea rows="4" value={reason} onChange={e=>setReason(e.target.value)} placeholder={en?'e.g. Incorrect value / entry recorded under the wrong control...':'π.χ. Λανθασμένη τιμή / καταχώρηση σε λάθος έλεγχο...'}/></label>
 </ObserverDialog>
}
