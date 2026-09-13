import { useEffect,useRef,useState } from 'react'
import { Pencil,Trash2,XCircle } from 'lucide-react'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can,CAPABILITIES } from '../../core/permissions/roles'
import { loadLaboratorySamples,sampleTypeLabel } from '../laboratory/laboratoryCloudService'
import { cancelLaboratoryRequest,deleteLaboratoryRequest,laboratoryRequestEditable,updateLaboratoryRequest } from '../laboratory/laboratoryRequestManagementService'
import { updateEmployeeSurveillanceFollowup } from './employeeSurveillanceCloudService'

const isPositive=row=>['positive','positive_recheck'].includes(row.resultStatus)
const hasFollowup=row=>Boolean(row.intervention||row.interventionType||row.noIntervention||row.recheckDue||row.noRecheck||row.recheckDate)
const hasPositiveHistory=samples=>samples.some(sample=>(sample.finalizedAt||sample.resultStatus==='validated')&&sample.result==='positive')
const compactCode=value=>{
  const code=String(value||'')
  if(code.startsWith('LAB-EMP-')&&code.length>18)return `LE-${code.slice(-6).toUpperCase()}`
  if(code.startsWith('ESUR-')){const parts=code.split('-');if(parts.length>=3)return `ES-${parts[1]}-${parts.at(-1).slice(-4)}`}
  return code
}

export function EmployeeSurveillanceRecordDialog({organizationId,record,samples=[],canManage,t,language,fmt,onClose,onUpdated,onSaveFollowup}){
  const {notify,notifyError,confirm}=useFeedback()
  const {role,membership}=useTenant()
  const en=language==='en'
  const canManageLab=can(role,CAPABILITIES.MANAGE_LAB_SAMPLES,membership?.capabilities??[],membership?.customCapabilities??[])
  const samplesRef=useRef(samples)
  samplesRef.current=samples
  const sampleSignature=(samples||[]).map(sample=>sample.id).join('|')
  const [editMode,setEditMode]=useState(false)
  const [saving,setSaving]=useState(false)
  const [selected,setSelected]=useState(record)
  const [resolvedSamples,setResolvedSamples]=useState(samples)
  const [requestEditor,setRequestEditor]=useState(null)
  const [requestSaving,setRequestSaving]=useState(false)
  const [intervention,setIntervention]=useState(record.intervention||'')
  const [interventionType,setInterventionType]=useState(record.interventionType||'')
  const [interventionStart,setInterventionStart]=useState(record.interventionStart||'')
  const [interventionEnd,setInterventionEnd]=useState(record.interventionEnd||'')
  const [noIntervention,setNoIntervention]=useState(Boolean(record.noIntervention))
  const [recheckDate,setRecheckDate]=useState(record.recheckDue||record.recheckDate||'')
  const [noRecheck,setNoRecheck]=useState(Boolean(record.noRecheck))
  const [correctionReason,setCorrectionReason]=useState('')

  async function reloadSamples(){
    if(!organizationId||!record?.recordId)return
    try{
      const rows=await loadLaboratorySamples(organizationId)
      setResolvedSamples((rows||[]).filter(sample=>sample.employeeSurveillanceId===record.recordId))
    }catch(error){notifyError(error,'load',{operation:'employee_surveillance_laboratory_load'})}
  }

  useEffect(()=>{
    const supplied=samplesRef.current||[]
    if(supplied.length){setResolvedSamples(supplied);return}
    if(!organizationId||!record?.recordId){setResolvedSamples([]);return}
    let alive=true
    loadLaboratorySamples(organizationId)
      .then(rows=>{if(alive)setResolvedSamples((rows||[]).filter(sample=>sample.employeeSurveillanceId===record.recordId))})
      .catch(error=>{if(alive){setResolvedSamples([]);notifyError(error,'load',{operation:'employee_surveillance_laboratory_load'})}})
    return ()=>{alive=false}
  },[organizationId,record?.recordId,sampleSignature,notifyError])

  const followupEligible=isPositive(selected)||selected.resultStatus==='cleared'||hasFollowup(selected)||hasPositiveHistory(resolvedSamples)

  function loadFollowup(row){setIntervention(row.intervention||'');setInterventionType(row.interventionType||'');setInterventionStart(row.interventionStart||'');setInterventionEnd(row.interventionEnd||'');setNoIntervention(Boolean(row.noIntervention));setRecheckDate(row.recheckDue||row.recheckDate||'');setNoRecheck(Boolean(row.noRecheck));setCorrectionReason('')}
  function startEdit(){loadFollowup(selected);setEditMode(true)}
  function cancelEdit(){loadFollowup(selected);setEditMode(false)}
  function editRequest(sample){setRequestEditor({sample,source:sample.source||'',priority:sample.priority||'routine',sampleType:sample.type||'surveillance'})}

  const currentRecheck=selected.recheckDue||selected.recheckDate||''
  const existingChanged=hasFollowup(selected)&&((selected.intervention||'')!==intervention.trim()||(selected.interventionType||'')!==interventionType||(selected.interventionStart||'')!==interventionStart||(selected.interventionEnd||'')!==interventionEnd||Boolean(selected.noIntervention)!==noIntervention||currentRecheck!==recheckDate||Boolean(selected.noRecheck)!==noRecheck)
  const saveDisabled=saving||Boolean(existingChanged&&!correctionReason.trim())

  async function saveFollowup(){
    if(saveDisabled)return
    setSaving(true)
    const patch={intervention,interventionType,interventionStart,interventionEnd,noIntervention,recheckDue:recheckDate,recheckDate,noRecheck,correctionReason}
    try{
      const updated=onSaveFollowup?await onSaveFollowup(selected,patch):await updateEmployeeSurveillanceFollowup(organizationId,selected,patch)
      setSelected(updated);setEditMode(false);setCorrectionReason('');onUpdated?.(updated)
      notify(en?'Follow-up saved.':'Η παρακολούθηση αποθηκεύτηκε.','success')
    }catch(error){notifyError(error,'save',{operation:'employee_surveillance_followup_update'})}
    finally{setSaving(false)}
  }

  async function saveRequest(){
    if(!requestEditor||requestSaving)return
    setRequestSaving(true)
    try{
      await updateLaboratoryRequest(organizationId,requestEditor.sample.recordId,{source:requestEditor.source,priority:requestEditor.priority,sampleType:requestEditor.sampleType})
      await reloadSamples();setRequestEditor(null);notify(en?'Laboratory request updated.':'Το αίτημα εργαστηρίου ενημερώθηκε.','success')
    }catch(error){notifyError(error,'save',{operation:'employee_laboratory_request_update'})}
    finally{setRequestSaving(false)}
  }

  async function cancelRequest(sample){
    const ok=await confirm({title:en?'Cancel laboratory request':'Ακύρωση αιτήματος εργαστηρίου',message:en?'The pending request will be cancelled.':'Το εκκρεμές αίτημα θα ακυρωθεί.',confirmLabel:en?'Cancel request':'Ακύρωση αιτήματος',danger:true})
    if(!ok)return
    try{await cancelLaboratoryRequest(organizationId,sample.recordId);await reloadSamples();notify(en?'Laboratory request cancelled.':'Το αίτημα εργαστηρίου ακυρώθηκε.','success')}catch(error){notifyError(error,'save',{operation:'employee_laboratory_request_cancel'})}
  }

  async function deleteRequest(sample){
    const ok=await confirm({title:en?'Delete laboratory request':'Διαγραφή αιτήματος εργαστηρίου',message:en?'Delete this request permanently? This is only allowed before Laboratory receives it or records a result.':'Να διαγραφεί οριστικά το αίτημα; Επιτρέπεται μόνο πριν το παραλάβει το Εργαστήριο ή καταχωρηθεί αποτέλεσμα.',confirmLabel:en?'Delete':'Διαγραφή',danger:true})
    if(!ok)return
    try{await deleteLaboratoryRequest(organizationId,sample.recordId);await reloadSamples();notify(en?'Laboratory request deleted.':'Το αίτημα εργαστηρίου διαγράφηκε.','success')}catch(error){notifyError(error,'delete',{operation:'employee_laboratory_request_delete'})}
  }

  return <ObserverDialog eyebrow={en?'Employee screening record':'Καρτέλα ελέγχου εργαζομένου'} title={en?selected.employeeNameEn:selected.employeeName} subtitle={`${compactCode(selected.id)} · ${en?selected.departmentEn:selected.department}`} width="workspace" className="employee-screening-record-card" onClose={onClose} footer={editMode?<DialogActions onCancel={cancelEdit} onSave={saveFollowup} saveLabel={en?'Save changes':'Αποθήκευση αλλαγών'} disabled={saveDisabled} showCancel/>:(canManage&&followupEligible?<Button variant="secondary" onClick={startEdit}>{hasFollowup(selected)?(en?'Edit':'Επεξεργασία'):(en?'Record follow-up':'Καταγραφή παρακολούθησης')}</Button>:null)}>
    <div className="employee-record-status-strip"><div><small>{en?'Screening type':'Τύπος ελέγχου'}</small><strong>{(selected.screeningTypes||[]).map(type=>t(type)).join(', ')||'—'}</strong></div><div><small>{en?'Result':'Αποτέλεσμα'}</small><strong>{t(selected.resultStatus||'pending')}</strong></div><div><small>{en?'Status':'Κατάσταση'}</small><strong>{t(selected.status||'active')}</strong></div></div>
    {followupEligible&&<div className="employee-screening-flow"><div className="screening-flow-step done"><span>01</span><strong>{en?'Positive result':'Θετικό αποτέλεσμα'}</strong><small>{en?'Completed':'Ολοκληρώθηκε'}</small></div><div className={`screening-flow-step ${hasFollowup(selected)?'done':'current'}`}><span>02</span><strong>{en?'Intervention':'Παρέμβαση'}</strong><small>{en?'Optional':'Προαιρετικό'}</small></div><div className={`screening-flow-step ${currentRecheck||selected.noRecheck?'done':''}`}><span>03</span><strong>{en?'Recheck':'Επανέλεγχος'}</strong><small>{en?'Optional':'Προαιρετικό'}</small></div><div className={`screening-flow-step ${selected.resultStatus==='cleared'?'done':''}`}><span>04</span><strong>{en?'Outcome':'Έκβαση'}</strong><small>{selected.resultStatus==='cleared'?(en?'Completed':'Ολοκληρώθηκε'):(en?'Open':'Ανοιχτό')}</small></div></div>}
    <section className="employee-record-section"><div className="followup-section-title"><strong>{en?'Laboratory results':'Εργαστηριακά αποτελέσματα'}</strong><span>{en?'Laboratory is the source of truth for results. Pending requests can be corrected before receipt.':'Το εργαστήριο αποτελεί την πηγή αλήθειας για τα αποτελέσματα. Τα εκκρεμή αιτήματα μπορούν να διορθωθούν πριν την παραλαβή.'}</span></div><div className="employee-sample-list">{resolvedSamples.length?resolvedSamples.map(sample=>{const editable=canManageLab&&laboratoryRequestEditable(sample);const actions=editable?[{id:'edit',label:en?'Edit request':'Επεξεργασία αιτήματος',icon:Pencil,onClick:()=>editRequest(sample)},{id:'cancel',label:en?'Cancel request':'Ακύρωση αιτήματος',icon:XCircle,onClick:()=>cancelRequest(sample)},{id:'delete',label:en?'Delete request':'Διαγραφή αιτήματος',icon:Trash2,tone:'danger',separatorBefore:true,onClick:()=>deleteRequest(sample)}]:[];return <div key={sample.recordId||sample.id} className="employee-sample-row"><div className="employee-sample-main"><strong className="employee-code-compact" title={sample.id}>{compactCode(sample.id)}</strong><span>{sampleTypeLabel(sample.type,t)}{sample.source?` · ${sample.source}`:''}</span></div><div className="employee-lab-actions"><span className={`status-badge ${sample.result==='negative'?'active':''}`}>{sample.result?t(sample.result):t(sample.status)}</span>{sample.organism&&<small>{sample.organism}</small>}{actions.length>0&&<OverflowMenu label={en?'Laboratory request actions':'Ενέργειες αιτήματος εργαστηρίου'} items={actions}/>}</div></div>}):<div className="inline-empty">{t('noData')}</div>}</div></section>
    {followupEligible&&<section className="employee-record-section followup-highlight"><div className="followup-section-title"><strong>{en?'Intervention & recheck':'Παρέμβαση & επανέλεγχος'}</strong><span>{en?'Recording follow-up is optional and can be corrected with a reason.':'Η καταγραφή παρακολούθησης είναι προαιρετική και μπορεί να διορθωθεί με αιτιολόγηση.'}</span></div>
      {!editMode&&<div className="followup-read-grid"><div><small>{en?'Intervention':'Παρέμβαση'}</small><strong>{selected.noIntervention?(en?'No intervention planned':'Δεν προγραμματίστηκε παρέμβαση'):(selected.interventionType||selected.intervention||(en?'Not recorded':'Δεν έχει καταγραφεί'))}</strong>{selected.intervention&&selected.interventionType&&<span>{selected.intervention}</span>}{selected.interventionStart&&<span>{en?'Start':'Έναρξη'}: {fmt(selected.interventionStart)}</span>}{selected.interventionEnd&&<span>{en?'End':'Λήξη'}: {fmt(selected.interventionEnd)}</span>}</div><div><small>{en?'Recheck':'Επανέλεγχος'}</small><strong>{selected.noRecheck?(en?'No recheck planned':'Δεν προγραμματίστηκε επανέλεγχος'):(currentRecheck?fmt(currentRecheck):(en?'Not scheduled':'Δεν έχει προγραμματιστεί'))}</strong></div></div>}
      {editMode&&<div className="employee-followup-edit-grid">
        <div className="entry-span-2 followup-choice-row"><label><input type="checkbox" checked={noIntervention} onChange={e=>{setNoIntervention(e.target.checked);if(e.target.checked){setIntervention('');setInterventionType('');setInterventionStart('');setInterventionEnd('')}}}/><span>{en?'No intervention planned':'Δεν προγραμματίζεται παρέμβαση'}</span></label></div>
        {!noIntervention&&<><label className="field"><span>{en?'Intervention type':'Τύπος παρέμβασης'}</span><input value={interventionType} onChange={e=>setInterventionType(e.target.value)} placeholder={en?'Choose or type…':'Επιλέξτε ή πληκτρολογήστε…'}/></label><label className="field"><span>{en?'Intervention details':'Λεπτομέρειες παρέμβασης'}</span><input value={intervention} onChange={e=>setIntervention(e.target.value)} placeholder={en?'Optional notes':'Προαιρετικές σημειώσεις'}/></label><ManualDateField className="field" label={en?'Start':'Έναρξη'} value={interventionStart} onChange={setInterventionStart}/><ManualDateField className="field" label={en?'End':'Λήξη'} value={interventionEnd} onChange={setInterventionEnd}/></>}
        <div className="entry-span-2 followup-choice-row"><label><input type="checkbox" checked={noRecheck} onChange={e=>{setNoRecheck(e.target.checked);if(e.target.checked)setRecheckDate('')}}/><span>{en?'No recheck planned':'Δεν προγραμματίζεται επανέλεγχος'}</span></label></div>
        {!noRecheck&&<div className="entry-span-2"><ManualDateField className="field" label={en?'Recheck date':'Ημερομηνία επανελέγχου'} value={recheckDate} onChange={setRecheckDate}/></div>}
        {hasFollowup(selected)&&<label className="field entry-span-2"><span>{en?'Correction reason':'Αιτιολογία διόρθωσης'}</span><textarea rows="2" value={correctionReason} onChange={e=>setCorrectionReason(e.target.value)} placeholder={en?'Required when changing an existing follow-up':'Απαιτείται κατά την τροποποίηση υπάρχουσας παρακολούθησης'}/></label>}
      </div>}
    </section>}
    {!followupEligible&&<section className="employee-record-section"><div className="source-truth-note">{en?'This screening does not require follow-up.':'Αυτός ο έλεγχος δεν απαιτεί παρακολούθηση.'}</div></section>}
    {requestEditor&&<ObserverDialog width="wide" eyebrow={en?'Laboratory request':'Αίτημα εργαστηρίου'} title={compactCode(requestEditor.sample.id)} subtitle={en?'Corrections are allowed only while the request is pending and has no result.':'Διορθώσεις επιτρέπονται μόνο όσο το αίτημα είναι εκκρεμές και δεν έχει αποτέλεσμα.'} onClose={()=>!requestSaving&&setRequestEditor(null)} footer={<DialogActions onCancel={()=>setRequestEditor(null)} onSave={saveRequest} saveLabel={requestSaving?(en?'Saving…':'Αποθήκευση…'):(en?'Save changes':'Αποθήκευση αλλαγών')} disabled={requestSaving}/>}><div className="employee-lab-request-editor"><label className="field entry-span-2"><span>{en?'Requested examination / material':'Ζητούμενος έλεγχος / υλικό'}</span><input value={requestEditor.source} onChange={e=>setRequestEditor(v=>({...v,source:e.target.value}))}/></label><label className="field"><span>{en?'Request type':'Τύπος αιτήματος'}</span><select value={requestEditor.sampleType} onChange={e=>setRequestEditor(v=>({...v,sampleType:e.target.value}))}><option value="surveillance">{en?'Surveillance':'Επιτήρηση'}</option><option value="screening">Screening</option><option value="other">{en?'Other':'Άλλο'}</option></select></label><label className="field"><span>{en?'Priority':'Προτεραιότητα'}</span><select value={requestEditor.priority} onChange={e=>setRequestEditor(v=>({...v,priority:e.target.value}))}><option value="routine">{en?'Routine':'Ρουτίνα'}</option><option value="urgent">{en?'Urgent':'Επείγον'}</option><option value="critical">{en?'Critical':'Κρίσιμο'}</option></select></label></div></ObserverDialog>}
  </ObserverDialog>
}
