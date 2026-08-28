import { useMemo,useState } from 'react'
import { AlertTriangle,UserRound } from 'lucide-react'
import { useAuth } from '../../core/auth/AuthContext'
import { controlActorFromAuth } from './controlActor'

export function ControlCancellationModal({onClose,onConfirm}){
 const {profile,user}=useAuth();const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user]);const [reason,setReason]=useState('')
 return <div className="modal-backdrop"><div className="entry-card control-cancel-card"><header><div><span className="eyebrow">ΑΝΑΙΡΕΣΗ ΚΑΤΑΧΩΡΗΣΗΣ</span><h3>Ακύρωση ελέγχου</h3><p>Η αρχική καταχώρηση θα παραμείνει στο ιστορικό ως ακυρωμένη.</p></div><button className="icon-close" onClick={onClose}>×</button></header>
 <div className="governance-banner warning"><AlertTriangle size={17}/><span>Η αναίρεση απαιτεί αιτιολογία και καταγράφεται στο audit trail.</span></div>
 <div className="control-cancel-meta"><UserRound size={16}/><span>Αναίρεση από</span><strong>{actor.name}</strong></div>
 <label className="field"><span>Αιτιολογία αναίρεσης *</span><textarea rows="4" value={reason} onChange={e=>setReason(e.target.value)} placeholder="π.χ. Λανθασμένη τιμή / καταχώρηση σε λάθος έλεγχο..."/></label>
 <footer><button className="button" onClick={onClose}>Άκυρο</button><button className="button button-danger" disabled={!reason.trim()} onClick={()=>onConfirm({reason,actor})}>Αναίρεση καταχώρησης</button></footer>
 </div></div>
}
