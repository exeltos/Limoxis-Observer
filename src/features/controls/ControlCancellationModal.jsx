import { useMemo,useState } from 'react'
import { AlertTriangle,UserRound } from 'lucide-react'
import { useAuth } from '../../core/auth/AuthContext'
import { controlActorFromAuth } from './controlActor'
import { useLanguage } from '../../core/i18n/LanguageContext'

export function ControlCancellationModal({onClose,onConfirm}){
 const {profile,user}=useAuth();const {language}=useLanguage();const en=language==='en';const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user]);const [reason,setReason]=useState('')
 return <div className="modal-backdrop"><div className="entry-card control-cancel-card"><header><div><span className="eyebrow">{en?'VOID ENTRY':'ΑΝΑΙΡΕΣΗ ΚΑΤΑΧΩΡΗΣΗΣ'}</span><h3>{en?'Void control entry':'Ακύρωση ελέγχου'}</h3><p>{en?'The original entry will remain in history as voided.':'Η αρχική καταχώρηση θα παραμείνει στο ιστορικό ως ακυρωμένη.'}</p></div><button className="icon-close" onClick={onClose}>×</button></header>
 <div className="governance-banner warning"><AlertTriangle size={17}/><span>{en?'A reason is required and the action is recorded in the audit trail.':'Η αναίρεση απαιτεί αιτιολογία και καταγράφεται στο audit trail.'}</span></div>
 <div className="control-cancel-meta"><UserRound size={16}/><span>{en?'Voided by':'Αναίρεση από'}</span><strong>{actor.name}</strong></div>
 <label className="field"><span>{en?'Reason for voiding *':'Αιτιολογία αναίρεσης *'}</span><textarea rows="4" value={reason} onChange={e=>setReason(e.target.value)} placeholder={en?'e.g. Incorrect value / entry recorded under the wrong control...':'π.χ. Λανθασμένη τιμή / καταχώρηση σε λάθος έλεγχο...'}/></label>
 <footer><button className="button" onClick={onClose}>{en?'Cancel':'Άκυρο'}</button><button className="button button-danger" disabled={!reason.trim()} onClick={()=>onConfirm({reason,actor})}>{en?'Void entry':'Αναίρεση καταχώρησης'}</button></footer>
 </div></div>
}
