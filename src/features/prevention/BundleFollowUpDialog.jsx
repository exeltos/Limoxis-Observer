import { useMemo,useState } from 'react'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useAuth } from '../../core/auth/AuthContext'
import { controlActorFromAuth } from '../controls/controlActor'

export function BundleFollowUpDialog({item,value,onClose,onSave}){
 const {language}=useLanguage();const en=language==='en'
 const {profile,user}=useAuth();const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const [draft,setDraft]=useState(()=>({status:value?.status||'',date:value?.date||'',comment:value?.comment||''}))
 const valid=Boolean(draft.status&&draft.date)
 const save=()=>onSave?.({...draft,reviewedBy:actor.name,reviewedById:actor.id,reviewedAt:new Date().toISOString()})
 return <ObserverDialog
  width="standard"
  eyebrow={en?'Bundle follow-up':'Επανέλεγχος Bundle'}
  title={item?.label||''}
  subtitle={item?.note||(en?'Record the result of the follow-up review.':'Καταγράψτε το αποτέλεσμα του επανελέγχου.')}
  onClose={onClose}
  footer={<DialogActions showCancel onCancel={onClose} onSave={save} disabled={!valid} saveLabel={en?'Save follow-up':'Αποθήκευση επανελέγχου'}/>}>
  <div className="bundle-followup-form">
   <label><span>{en?'Status *':'Κατάσταση *'}</span><select value={draft.status} onChange={e=>setDraft(current=>({...current,status:e.target.value}))}><option value="">{en?'Select status':'Επιλέξτε κατάσταση'}</option><option value="resolved">{en?'Corrected':'Διορθώθηκε'}</option><option value="open">{en?'Still pending':'Παραμένει'}</option><option value="not_applicable">{en?'No longer applicable':'Δεν εφαρμόζεται πλέον'}</option></select></label>
   <ManualDateField label={en?'Follow-up date *':'Ημερομηνία επανελέγχου *'} value={draft.date} onChange={date=>setDraft(current=>({...current,date}))}/>
   <label className="bundle-followup-comment"><span>{en?'Comment / action':'Σχόλιο / ενέργεια'}</span><textarea rows="4" value={draft.comment} onChange={e=>setDraft(current=>({...current,comment:e.target.value}))} placeholder={en?'Optional note about the corrective action or current situation':'Προαιρετική σημείωση για τη διορθωτική ενέργεια ή την τρέχουσα κατάσταση'}/></label>
  </div>
 </ObserverDialog>
}
