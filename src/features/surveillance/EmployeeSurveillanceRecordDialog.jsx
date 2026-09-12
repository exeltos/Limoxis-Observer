import { useState } from 'react'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { sampleTypeLabel } from '../laboratory/laboratoryCloudService'
import { updateEmployeeSurveillanceFollowup } from './employeeSurveillanceCloudService'

const isPositive=row=>['positive','positive_recheck'].includes(row.resultStatus)
const hasFollowup=row=>Boolean(row.intervention||row.interventionType||row.noIntervention||row.recheckDue||row.noRecheck)
const hasPositiveHistory=samples=>samples.some(sample=>(sample.finalizedAt||sample.resultStatus==='validated')&&sample.result==='positive')

export function EmployeeSurveillanceRecordDialog({organizationId,record,samples=[],canManage,t,language,fmt,onClose,onUpdated}){
  const {notify,notifyError}=useFeedback()
  const en=language==='en'
  const [editMode,setEditMode]=useState(false)
  const [saving,setSaving]=useState(false)
  const [selected,setSelected]=useState(record)
  const [intervention,setIntervention]=useState(record.intervention||'')
  const [interventionType,setInterventionType]=useState(record.interventionType||'')
  const [interventionStart,setInterventionStart]=useState(record.interventionStart||'')
  const [interventionEnd,setInterventionEnd]=useState(record.interventionEnd||'')
  const [noIntervention,setNoIntervention]=useState(Boolean(record.noIntervention))
  const [recheckDate,setRecheckDate]=useState(record.recheckDue||'')
  const [noRecheck,setNoRecheck]=useState(Boolean(record.noRecheck))
  const [correctionReason,setCorrectionReason]=useState('')

  const followupEligible=isPositive(selected)||selected.resultStatus==='cleared'||hasFollowup(selected)||hasPositiveHistory(samples)

  function loadFollowup(row){setIntervention(row.intervention||'');setInterventionType(row.interventionType||'');setInterventionStart(row.interventionStart||'');setInterventionEnd(row.interventionEnd||'');setNoIntervention(Boolean(row.noIntervention));setRecheckDate(row.recheckDue||'');setNoRecheck(Boolean(row.noRecheck));setCorrectionReason('')}
  function startEdit(){loadFollowup(selected);setEditMode(true)}
  function cancelEdit(){loadFollowup(selected);setEditMode(false)}

  const existingChanged=hasFollowup(selected)&&((selected.intervention||'')!==intervention.trim()||(selected.interventionType||'')!==interventionType||(selected.interventionStart||'')!==interventionStart||(selected.interventionEnd||'')!==interventionEnd||Boolean(selected.noIntervention)!==noIntervention||(selected.recheckDue||'')!==recheckDate||Boolean(selected.noRecheck)!==noRecheck)
  const saveDisabled=saving||Boolean(existingChanged&&!correctionReason.trim())

  async function saveFollowup(){
    if(saveDisabled)return
    setSaving(true)
    try{
      const updated=await updateEmployeeSurveillanceFollowup(organizationId,selected,{intervention,interventionType,interventionStart,interventionEnd,noIntervention,recheckDue:recheckDate,noRecheck,correctionReason})
      setSelected(updated);setEditMode(false);setCorrectionReason('');onUpdated?.(updated)
      notify(en?'Follow-up saved.':'Η παρακολούθηση αποθηκεύτηκε.','success')
    }catch(error){notifyError(error,'save',{operation:'employee_surveillance_followup_update'})}
    finally{setSaving(false)}
  }

  return <ObserverDialog eyebrow={en?'Employee screening record':'Καρτέλα ελέγχου εργαζομένου'} title={en?selected.employeeNameEn:selected.employeeName} subtitle={`${selected.id} · ${en?selected.departmentEn:selected.department}`} width="workspace" className="employee-screening-record-card" onClose={onClose} footer={editMode?<DialogActions onCancel={cancelEdit} onSave={saveFollowup} saveLabel={en?'Save changes':'Αποθήκευση αλλαγών'} disabled={saveDisabled} showCancel/>:(canManage&&followupEligible?<Button variant="secondary" onClick={startEdit}>{hasFollowup(selected)?(en?'Edit':'Επεξεργασία'):(en?'Record follow-up':'Καταγραφή παρακολούθησης')}</Button>:null)}>
    <div className="employee-record-status-strip"><div><small>{en?'Screening type':'Τύπος ελέγχου'}</small><strong>{(selected.screeningTypes||[]).map(type=>t(type)).join(', ')||'—'}</strong></div><div><small>{en?'Result':'Αποτέλεσμα'}</small><strong>{t(selected.resultStatus||'pending')}</strong></div><div><small>{en?'Status':'Κατάσταση'}</small><strong>{t(selected.status||'active')}</strong></div></div>
    {followupEligible&&<div className="employee-screening-flow"><div className="screening-flow-step done"><span>01</span><strong>{en?'Positive result':'Θετικό αποτέλεσμα'}</strong><small>{en?'Completed':'Ολοκληρώθηκε'}</small></div><div className={`screening-flow-step ${hasFollowup(selected)?'done':'current'}`}><span>02</span><strong>{en?'Intervention':'Παρέμβαση'}</strong><small>{en?'Optional':'Προαιρετικό'}</small></div><div className={`screening-flow-step ${selected.recheckDue||selected.noRecheck?'done':''}`}><span>03</span><strong>{en?'Recheck':'Επανέλεγχος'}</strong><small>{en?'Optional':'Προαιρετικό'}</small></div><div className={`screening-flow-step ${selected.resultStatus==='cleared'?'done':''}`}><span>04</span><strong>{en?'Outcome':'Έκβαση'}</strong><small>{selected.resultStatus==='cleared'?(en?'Completed':'Ολοκληρώθηκε'):(en?'Open':'Ανοιχτό')}</small></div></div>}
    <section className="employee-record-section"><div className="followup-section-title"><strong>{en?'Laboratory results':'Εργαστηριακά αποτελέσματα'}</strong><span>{en?'Laboratory is the source of truth for results.':'Το εργαστήριο αποτελεί την πηγή αλήθειας για τα αποτελέσματα.'}</span></div><div className="employee-sample-list">{samples.length?samples.map(sample=><div key={sample.id} className="employee-sample-row"><div><strong>{sample.id}</strong><span>{sampleTypeLabel(sample.type,t)}</span></div><div><span className={`status-badge ${sample.result==='negative'?'active':''}`}>{sample.result?t(sample.result):t(sample.status)}</span>{sample.organism&&<small>{sample.organism}</small>}</div></div>):<div className="inline-empty">{t('noData')}</div>}</div></section>
    {followupEligible&&<section className="employee-record-section followup-highlight"><div className="followup-section-title"><strong>{en?'Intervention & recheck':'Παρέμβαση & επανέλεγχος'}</strong><span>{en?'Recording follow-up is optional and can be corrected with a reason.':'Η καταγραφή παρακολούθησης είναι προαιρετική και μπορεί να διορθωθεί με αιτιολόγηση.'}</span></div>
      {!editMode&&<div className="followup-read-grid"><div><small>{en?'Intervention':'Παρέμβαση'}</small><strong>{selected.noIntervention?(en?'No intervention planned':'Δεν προγραμματίστηκε παρέμβαση'):(selected.interventionType||selected.intervention||(en?'Not recorded':'Δεν έχει καταγραφεί'))}</strong>{selected.intervention&&selected.interventionType&&<span>{selected.intervention}</span>}{selected.interventionStart&&<span>{en?'Start':'Έναρξη'}: {fmt(selected.interventionStart)}</span>}{selected.interventionEnd&&<span>{en?'End':'Λήξη'}: {fmt(selected.interventionEnd)}</span>}</div><div><small>{en?'Recheck':'Επανέλεγχος'}</small><strong>{selected.noRecheck?(en?'No recheck planned':'Δεν προγραμματίστηκε επανέλεγχος'):(selected.recheckDue?fmt(selected.recheckDue):(en?'Not scheduled':'Δεν έχει προγραμματιστεί'))}</strong></div></div>}
      {editMode&&<div className="employee-followup-edit-grid">
        <div className="entry-span-2 followup-choice-row"><label><input type="checkbox" checked={noIntervention} onChange={e=>{setNoIntervention(e.target.checked);if(e.target.checked){setIntervention('');setInterventionType('');setInterventionStart('');setInterventionEnd('')}}}/><span>{en?'No intervention planned':'Δεν προγραμματίζεται παρέμβαση'}</span></label></div>
        {!noIntervention&&<><label className="field"><span>{en?'Intervention type':'Τύπος παρέμβασης'}</span><input value={interventionType} onChange={e=>setInterventionType(e.target.value)} placeholder={en?'Choose or type…':'Επιλέξτε ή πληκτρολογήστε…'}/></label><label className="field"><span>{en?'Intervention details':'Λεπτομέρειες παρέμβασης'}</span><input value={intervention} onChange={e=>setIntervention(e.target.value)} placeholder={en?'Optional notes':'Προαιρετικές σημειώσεις'}/></label><ManualDateField className="field" label={en?'Start':'Έναρξη'} value={interventionStart} onChange={setInterventionStart}/><ManualDateField className="field" label={en?'End':'Λήξη'} value={interventionEnd} onChange={setInterventionEnd}/></>}
        <div className="entry-span-2 followup-choice-row"><label><input type="checkbox" checked={noRecheck} onChange={e=>{setNoRecheck(e.target.checked);if(e.target.checked)setRecheckDate('')}}/><span>{en?'No recheck planned':'Δεν προγραμματίζεται επανέλεγχος'}</span></label></div>
        {!noRecheck&&<div className="entry-span-2"><ManualDateField className="field" label={en?'Recheck date':'Ημερομηνία επανελέγχου'} value={recheckDate} onChange={setRecheckDate}/></div>}
        {hasFollowup(selected)&&<label className="field entry-span-2"><span>{en?'Correction reason':'Αιτιολογία διόρθωσης'}</span><textarea rows="2" value={correctionReason} onChange={e=>setCorrectionReason(e.target.value)} placeholder={en?'Required when changing an existing follow-up':'Απαιτείται κατά την τροποποίηση υπάρχουσας παρακολούθησης'}/></label>}
      </div>}
    </section>}
    {!followupEligible&&<section className="employee-record-section"><div className="source-truth-note">{en?'This screening does not require follow-up.':'Αυτός ο έλεγχος δεν απαιτεί παρακολούθηση.'}</div></section>}
  </ObserverDialog>
}
