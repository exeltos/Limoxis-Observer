import { useMemo,useState } from 'react'
import { ExportMenu } from '../../design-system/ExportMenu'
import { CheckCircle2, FileWarning, History, Plus, Save, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../core/auth/AuthContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { formatDateTime } from '../../core/i18n/formatDay'

import { Button } from '../../design-system/Button'
import { ChecklistAnswers } from '../../design-system/ChecklistAnswers'
import { ChoiceChips } from '../../design-system/ChoiceChips'
import { Field } from '../../design-system/Field'
import { IconButton } from '../../design-system/IconButton'
import { DialogActions,ObserverDialog } from '../../design-system/ObserverDialog'
import { RegistryTable } from '../../design-system/RegistryTable'
import { SaveButton } from '../../design-system/SaveButton'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { SectionHeader } from '../../design-system/SectionHeader'
import { StatusBadge } from '../../design-system/StatusBadge'
import { useLibraries } from '../management/useLibraries'
import { assignmentProgress,getAssignment,frequencyLabel } from './controlScheduling'
import { progressCompleteMessage,progressText } from './controlProgress'
import { controlActorFromAuth } from './controlActor'
import { checklistRows,emptyStructuredRow,listHasFinding,printControlForm } from './controlStructured'
import { saveControlDraft } from './controlCloudService'
import { deviationActions,requiresEvidence } from './controlCriticality'
import { expiryState,expiryWindow,impliedFinding,isExpiryControl,prefilledExpiryRows } from './controlExpiry'
import { answerLabel,canonicalAnswer,checklistSummary,choiceOptions,isFindingAnswer } from './controlVocabulary'
import { ControlExpiryEntry } from './ControlExpiryEntry'
import { ControlDeviationActions,ControlEvidenceLinks,ControlEvidencePicker } from './ControlEvidence'
import { ownerText,personLabel } from '../employees/peopleOptions'
import './controlExecution.css'

// One way to record a control, as a page (a new entry) or a dialog (correcting
// an entry): the same fields, findings and checks either way.
function useControlExecution({organizationId,record,department,initialExecution,onDraftSaved}){
 const {profile,user}=useAuth()
 const {language}=useLanguage();const en=language==='en'
 const {confirm,notify}=useFeedback()
 const {libraries}=useLibraries()
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const assignment=getAssignment(record,department)
 const response=record.responseConfig||{mode:'text',label:'Αποτέλεσμα'}
 const mode=response.mode||'text'
 const expiryControl=isExpiryControl(record)
 const answers=libraries.controlAnswers||[]
 const isEditing=Boolean(initialExecution)
 const savedDraft=isEditing?null:assignment?.draft||null
 const [value,setValue]=useState(()=>{const v=initialExecution?.value??savedDraft?.value??'';return mode==='choice'?canonicalAnswer(v):v})
 const [notes,setNotes]=useState(initialExecution?.notes||savedDraft?.notes||'')
 const [resultText,setResultText]=useState(initialExecution?.resultText||savedDraft?.resultText||'')
 const [checkedPoints,setCheckedPoints]=useState(initialExecution?.checkedPoints||savedDraft?.checkedPoints||'')
 const [rows,setRows]=useState(()=>{
  // A saved entry keeps its own rows, even none: only a new entry starts from the list.
  if(Array.isArray(initialExecution?.structuredData?.rows))return initialExecution.structuredData.rows
  const stored=savedDraft?.rows
  if(stored?.length)return stored
  if(mode==='checklist')return checklistRows(record)
  const listed=expiryControl?prefilledExpiryRows(record,department):[]
  return listed.length?listed:[emptyStructuredRow(response.template)]
 })
 const [draftSaved,setDraftSaved]=useState(Boolean(savedDraft))
 const [draftSaving,setDraftSaving]=useState(false)
 const [evidence,setEvidence]=useState([])
 const evidenceRequired=!isEditing&&requiresEvidence(record)
 const numeric=Number(String(value).replace(',','.'))
 const outOfRange=mode==='numeric'&&String(value).trim()!==''&&Number.isFinite(numeric)&&((response.min!==''&&response.min!=null&&numeric<Number(response.min))||(response.max!==''&&response.max!=null&&numeric>Number(response.max)))
 const choiceFinding=mode==='choice'&&isFindingAnswer(response,value,answers)
 const expiryRowAlerts=expiryControl&&rows.some(row=>!row.removedAt&&expiryState(row.expiry,expiryWindow(record)).alert)
 const structured=mode==='list'||mode==='checklist'
 const hasFinding=outOfRange||choiceFinding||(structured&&listHasFinding(rows))||expiryRowAlerts
 const expiryRowsValid=!expiryControl||rows.every(row=>row.fromCatalogue||!String(row.item||'').trim()||String(row.expiry||'').trim())
 const checklistValid=mode!=='checklist'||rows.every(row=>row.required===false||row.answer)
 const valid=(structured?true:String(value).trim().length>0)&&expiryRowsValid&&checklistValid&&(!evidenceRequired||evidence.length>0)
 // Earlier entries of this department, latest first: what was recorded last.
 const history=(assignment?.history||[]).filter(h=>h.status!=='cancelled'&&h.id!==initialExecution?.id)
 const setRow=(index,key,next)=>setRows(current=>current.map((r,i)=>i===index?{...r,[key]:next}:r))
 const addRow=()=>setRows(current=>[...current,emptyStructuredRow(response.template)])
 async function removeRow(index){
  const ok=await confirm({title:en?'Remove row':'Αφαίρεση γραμμής',message:en?'The row will be removed from this entry. Continue?':'Η γραμμή θα αφαιρεθεί από την καταχώρηση. Θέλετε να συνεχίσετε;',confirmLabel:en?'Remove':'Αφαίρεση',danger:true})
  if(!ok)return
  setRows(current=>current.length===1?[emptyStructuredRow(response.template)]:current.filter((_,i)=>i!==index))
 }
 async function persistDraft(){
  if(draftSaving)return null
  setDraftSaving(true)
  try{const draft=await saveControlDraft(organizationId,record,department,{value,notes,resultText,checkedPoints,rows});setDraftSaved(true);onDraftSaved?.(draft);notify(en?'Draft saved.':'Η προσωρινή καταχώρηση αποθηκεύτηκε.','success');return draft}
  catch{notify(en?'The draft could not be saved.':'Δεν ήταν δυνατή η προσωρινή αποθήκευση.','error');return null}
  finally{setDraftSaving(false)}
 }
 const template=mode==='checklist'?'checklist':response.template
 function payload(){
  const cleanRows=mode==='checklist'?rows:mode==='list'?rows.filter(r=>Object.values(r||{}).some(v=>String(v??'').trim())).map(r=>expiryControl&&!r.finding?{...r,finding:impliedFinding(r,expiryWindow(record))}:r):null
  const storedValue=mode==='checklist'?checklistSummary(rows):value
  return {value:storedValue,resultText,checkedPoints,notes,structuredData:structured?{template,rows:cleanRows}:null,hasFinding,actor,evidenceFiles:evidence}
 }
 const printDraft=()=>printControlForm({record,department,execution:{at:initialExecution?.at||new Date().toISOString(),value,resultText,checkedPoints,notes,structuredData:structured?{template,rows}:null,by:actor.name},actorName:actor.name})
 return {en,language,actor,assignment,response,mode,answers,libraries,expiryControl,structured,isEditing,value,setValue,notes,setNotes,resultText,setResultText,checkedPoints,setCheckedPoints,rows,setRows,setRow,addRow,removeRow,evidence,setEvidence,evidenceRequired,outOfRange,hasFinding,valid,history,draftSaved,draftSaving,persistDraft,payload,printDraft}
}

function LastEntry({state,record}){
 const {en,language,history,mode,response}=state
 const last=history[0]
 if(!last||mode==='list')return null
 const shown=mode==='choice'?answerLabel(last.value,language,state.answers):mode==='checklist'?(last.structuredData?.rows?checklistSummary(last.structuredData.rows,language):last.value):`${last.value}${mode==='numeric'&&response.unit?` ${response.unit}`:''}`
 const recent=mode==='numeric'?history.slice(0,5).map(h=>h.value).filter(v=>String(v).trim()):[]
 return <div className="control-exec-last"><History size={15}/><span>{en?'Last entry':'Τελευταία καταχώρηση'}</span><strong>{shown||'—'}</strong>{last.hasFinding&&<StatusBadge tone="danger">{en?'Finding':'Εύρημα'}</StatusBadge>}<small>{formatDateTime(last.at,language)}{last.by?` · ${last.by}`:''}</small>{recent.length>1&&<small className="control-exec-trend">{en?'Recent':'Πρόσφατες'}: {recent.join(' · ')}{response.unit?` ${response.unit}`:''}</small>}{record.equipment&&<small>{record.equipment}</small>}</div>
}

function ResultField({state}){
 const {en,language,mode,response,value,setValue,outOfRange,answers,history}=state
 const label=(en&&response.label==='Αποτέλεσμα'?'Result':response.label)||(en?'Result':'Αποτέλεσμα')
 if(mode==='choice'){
  const options=choiceOptions(response,answers)
  return <div className="field control-exec-result"><SearchableSelect className="control-exec-choice" label={`${label} *`} value={value} onChange={next=>next&&setValue(next)} options={options.map(option=>({value:option.value,label:answerLabel(option.value,language,answers)}))}/>{isFindingAnswer(response,value,answers)&&<small className="control-exec-alert">{en?'This answer is a finding.':'Η απάντηση αυτή είναι εύρημα.'}</small>}</div>
 }
 if(mode==='numeric')return <div className="control-exec-result control-exec-numeric">
  <Field label={`${label}${response.unit?` (${response.unit})`:''} *`}><input autoFocus inputMode="decimal" type="number" step="any" value={value} onChange={e=>setValue(e.target.value)} placeholder={en?'Enter value':'Καταχωρήστε τιμή'} className={outOfRange?'is-out-of-range':''}/></Field>
  {(response.min!==''&&response.min!=null||response.max!==''&&response.max!=null)&&<div className={`control-exec-range${outOfRange?' danger':''}`}><span>{en?'Acceptable range':'Αποδεκτά όρια'}</span><strong>{response.min??'—'} – {response.max??'—'} {response.unit||''}</strong>{outOfRange&&<StatusBadge tone="danger">{en?'Out of range':'Εκτός ορίων'}</StatusBadge>}</div>}
 </div>
 // Free text: what earlier entries recorded is one click away.
 const recent=[...new Set(history.map(h=>String(h.value||'').trim()).filter(Boolean))].slice(0,8)
 return <SearchableSelect className="control-exec-result" label={`${label} *`} value={value} options={recent.map(v=>({value:v,label:v}))} recentValues={recent} recentLabel={en?'Recorded before':'Έχουν καταχωρηθεί'} onChange={setValue} allowCustom placeholder={en?'Enter result':'Καταχωρήστε αποτέλεσμα'} customLabel={text=>text} emptyLabel=""/>
}

function ChecklistEntry({state}){
 const {language,rows,setRow,setRows}=state
 return <ChecklistAnswers rows={rows} language={language} onRowChange={setRow} onRowsChange={next=>setRows(()=>next)}/>
}

function FindingsList({state}){
 const {en,rows,setRow,addRow,removeRow,history}=state
 // Items recorded before in this department are suggested first.
 const known=[...new Set(history.flatMap(h=>(h.structuredData?.rows||[]).map(r=>String(r.item||'').trim())).filter(Boolean))]
 return <section className="control-exec-findings">
  <SectionHeader title={en?'Findings list':'Λίστα ευρημάτων'} subtitle={en?'Add a row only when there is something to record.':'Προσθέστε γραμμή μόνο όταν υπάρχει κάτι προς καταγραφή.'} actions={<Button variant="secondary" onClick={addRow}><Plus size={15}/> {en?'Add row':'Προσθήκη γραμμής'}</Button>}/>
  <RegistryTable className="control-exec-table" wrapperClassName="control-exec-table-wrap" columns={[{key:'item',label:en?'Item':'Στοιχείο'},{key:'finding',label:en?'Finding':'Εύρημα'},{key:'action',label:en?'Action':'Ενέργεια'},{key:'remove',label:'',ariaLabel:en?'Actions':'Ενέργειες',className:'control-exec-action-col'}]} rows={rows} rowKey={(_,i)=>i} renderRow={(r,i)=><>
   <td><SearchableSelect hideLabel label={en?'Item':'Στοιχείο'} value={r.item||''} options={known.map(v=>({value:v,label:v}))} onChange={v=>setRow(i,'item',v)} allowCustom customLabel={t=>t} placeholder={en?'Item':'Στοιχείο'} emptyLabel=""/></td>
   <td><input aria-label={en?'Finding':'Εύρημα'} value={r.finding||''} onChange={e=>setRow(i,'finding',e.target.value)} placeholder={en?'Finding':'Εύρημα'}/></td>
   <td><input aria-label={en?'Action':'Ενέργεια'} value={r.action||''} onChange={e=>setRow(i,'action',e.target.value)} placeholder={en?'Action':'Ενέργεια'}/></td>
   <td className="control-exec-action-col"><IconButton size="sm" tone="danger" label={en?'Remove row':'Αφαίρεση γραμμής'} onClick={()=>removeRow(i)}><Trash2 size={14}/></IconButton></td>
  </>}/>
  <small className="control-exec-hint">{en?'You can finish the control with no rows.':'Μπορείτε να ολοκληρώσετε τον έλεγχο χωρίς γραμμές.'}</small>
 </section>
}

function ExecutionFields({state,record,department}){
 const {en,language,mode,expiryControl,rows,setRow,addRow,removeRow,setRows,libraries,history,notes,setNotes,resultText,setResultText,checkedPoints,setCheckedPoints,hasFinding,isEditing,evidence,setEvidence,evidenceRequired}=state
 const guidance=[[en?'Goal':'Στόχος',record.goal],[en?'Acceptance criteria':'Κριτήρια αποδοχής',record.acceptanceCriteria],[en?'Instructions':'Οδηγίες',record.description],[en?'Guidance notes':'Σημειώσεις καθοδήγησης',record.guideNotes]].filter(([,text])=>text)
 return <>
  {guidance.map(([label,text])=><div key={label} className="control-exec-instructions"><span className="lo-field-label">{label}</span><p>{text}</p></div>)}
  <LastEntry state={state} record={record}/>
  {expiryControl
   ?<ControlExpiryEntry record={record} rows={rows} setRow={setRow} addRow={addRow} removeRow={removeRow} keepFirstRow={()=>setRows(current=>current.slice(0,1))} libraries={libraries} history={history} department={department} language={language}/>
   :mode==='checklist'?<ChecklistEntry state={state}/>
   :mode==='list'?<FindingsList state={state}/>
   :<ResultField state={state}/>}
  <div className="control-exec-bottom">
   <Field label={en?'Result details':'Αναλυτικό αποτέλεσμα'}><textarea value={resultText} onChange={e=>setResultText(e.target.value)} rows="2" placeholder={en?'Optional, the result in words…':'Προαιρετικό, το αποτέλεσμα αναλυτικά…'}/></Field>
   <Field label={en?'Points checked':'Σημεία ελέγχου'}><textarea value={checkedPoints} onChange={e=>setCheckedPoints(e.target.value)} rows="2" placeholder={en?'Optional, which points were checked…':'Προαιρετικό, ποια σημεία ελέγχθηκαν…'}/></Field>
   <Field label={en?'Notes':'Σημειώσεις'}><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows="2" placeholder={en?'Optional notes…':'Προαιρετικές παρατηρήσεις…'}/></Field>
   {!isEditing&&<ControlEvidencePicker files={evidence} onChange={setEvidence} required={evidenceRequired} language={language}/>}
  </div>
  {hasFinding&&<ControlDeviationActions text={deviationActions(record)} language={language}/>}
 </>
}

// An extra entry («Έκτακτη καταχώρηση») once the period's required entries
// are done: only with its reason, recorded as such and not counted.
export function ControlExtraEntryDialog({language,progress,onClose,onConfirm}){
 const en=language==='en'
 const [reason,setReason]=useState('')
 return <ObserverDialog width="compact" className="control-extra-card" eyebrow={en?'Extra entry':'Έκτακτη καταχώρηση'} title={en?'Record an extra entry':'Καταχώρηση πέρα από τις απαιτούμενες'} subtitle={progressCompleteMessage(progress,language)} onClose={onClose} footer={<DialogActions onCancel={onClose} onSave={()=>{if(reason.trim())onConfirm(reason.trim())}} disabled={!reason.trim()} saveLabel={en?'Continue':'Συνέχεια'}/>}>
  <div className="governance-banner warning"><FileWarning size={17}/><span>{en?'An extra entry is kept with its reason and shown as extra. It does not count towards the required entries or the adherence.':'Η έκτακτη καταχώρηση φυλάσσεται με την αιτιολογία της και εμφανίζεται ως έκτακτη. Δεν μετρά στις απαιτούμενες καταχωρήσεις ούτε στην τήρηση.'}</span></div>
  <label className="field"><span>{en?'Reason *':'Αιτιολογία *'}</span><textarea autoFocus rows="3" value={reason} onChange={e=>setReason(e.target.value)} placeholder={en?'e.g. repeat measurement after a deviation':'π.χ. επαναληπτική μέτρηση μετά από απόκλιση'}/></label>
 </ObserverDialog>
}

export function ControlExecutionEditor({organizationId,record,department,onSave,onDraftSaved}){
 const state=useControlExecution({organizationId,record,department,onDraftSaved})
 const {en,language,actor,assignment,structured,expiryControl,hasFinding,valid,draftSaved,draftSaving,persistDraft,payload,printDraft,value,notes,rows}=state
 const navigate=useNavigate()
 const [saving,setSaving]=useState(false)
 // The over-entry guard: with the period's entries complete only an extra
 // entry, with its reason, can be saved (the database refuses the rest too).
 const progress=assignmentProgress(record,department)
 const [extraReason,setExtraReason]=useState('')
 const [askExtra,setAskExtra]=useState(false)
 const blocked=Boolean(progress?.complete)&&!extraReason
 async function submit(){if(!valid||saving||blocked)return;setSaving(true);try{await onSave?.(extraReason?{...payload(),extra:{reason:extraReason}}:payload())}finally{setSaving(false)}}
 async function report(){
  const draft=await persistDraft();if(!draft)return
  navigate('/quality/report',{state:{controlSource:{controlId:record.id,controlTitle:record.title,department,scheduledAt:assignment?.nextDueAt,value,notes,hasFinding,rows},limoxisFrom:{path:`/controls/${record.id}?department=${encodeURIComponent(department)}&execute=1`,label:record.title}}})
 }
 const responsible=personLabel(record.assignees?.[department],language)||ownerText(record,language)
 return <div className="control-execution-page-editor">
  <dl className="control-exec-meta">
   {[[en?'Department':'Τμήμα',department],[en?'Scheduled':'Προγραμματισμένος',formatDateTime(assignment?.nextDueAt,language)],[en?'Frequency':'Συχνότητα',frequencyLabel(record.frequency,language)],progress&&[en?'Done':'Πρόοδος',progressText(progress,language)],responsible&&[en?'Responsible':'Υπεύθυνος',responsible],[en?'Recorded by':'Καταχώρηση από',actor.name]].filter(Boolean).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'—'}</dd></div>)}
  </dl>
  {progress?.complete&&!extraReason&&<div className="governance-banner control-period-complete" role="status"><CheckCircle2 size={17}/><span><strong>{progressCompleteMessage(progress,language)}</strong> {en?'A further entry is possible only as an extra entry, with its reason.':'Νέα καταχώρηση γίνεται μόνο ως έκτακτη, με αιτιολογία.'}</span><Button variant="secondary" onClick={()=>setAskExtra(true)}>{en?'Extra entry':'Έκτακτη καταχώρηση'}</Button></div>}
  {extraReason&&<div className="governance-banner warning control-period-extra" role="status"><FileWarning size={17}/><span><strong>{en?'Extra entry':'Έκτακτη καταχώρηση'}</strong> · {extraReason}</span><Button variant="quiet" onClick={()=>setExtraReason('')}>{en?'Cancel':'Ακύρωση'}</Button></div>}
  {askExtra&&<ControlExtraEntryDialog language={language} progress={progress} onClose={()=>setAskExtra(false)} onConfirm={reason=>{setExtraReason(reason);setAskExtra(false)}}/>}
  <div className="control-exec-main"><ExecutionFields state={state} record={record} department={department}/></div>
  {hasFinding&&!expiryControl&&<div className="governance-banner warning control-finding-banner"><FileWarning size={17}/><span>{en?'This entry contains a finding or an out-of-range value. You can create a related incident report.':'Η καταχώρηση περιλαμβάνει εύρημα ή τιμή εκτός ορίων. Μπορείτε να δημιουργήσετε σχετική αναφορά.'}</span></div>}
  <div className="control-execution-page-tools">
   <div className="control-execution-page-secondary-actions">
    <Button variant="quiet" disabled={draftSaving} onClick={persistDraft}><Save size={15}/>{draftSaving?(en?' Saving…':' Αποθήκευση…'):(en?' Save draft':' Αποθήκευση προσωρινά')}</Button>
    {structured&&<ExportMenu items={[{id:'form',kind:'print',label:expiryControl?(en?'Change form':'Έντυπο αλλαγών'):(en?'Entry form':'Έντυπο καταχώρησης'),onClick:printDraft}]}/>}
    <Button variant="quiet" onClick={report}><FileWarning size={15}/>{en?' Create incident report':' Δημιουργία αναφοράς'}</Button>
    {draftSaved&&<StatusBadge tone="info">{en?'Draft saved':'Αποθηκευμένο προσωρινά'}</StatusBadge>}
   </div>
   <SaveButton disabled={!valid||saving||blocked} onClick={submit}>{saving?(en?'Saving…':'Αποθήκευση…'):extraReason?(en?'Save extra entry':'Αποθήκευση έκτακτης'):(en?'Save entry':'Αποθήκευση')}</SaveButton>
  </div>
 </div>
}

// Correcting a saved entry: the same fields in a dialog, with a confirmation.
export function ControlExecutionModal({organizationId,record,department,onClose,onSave,initialExecution}){
 const state=useControlExecution({organizationId,record,department,initialExecution})
 const {en,language,actor,structured,valid,payload,printDraft}=state
 const [confirmed,setConfirmed]=useState(false)
 return <ObserverDialog width={structured?'workspace':'wide'} className="control-execution-card" eyebrow={en?'Edit entry':'Επεξεργασία καταχώρησης'} title={en?(record.titleEn||record.title):record.title} subtitle={`${department} · ${frequencyLabel(record.frequency,language)} · ${en?'original entry':'αρχική καταχώρηση'} ${formatDateTime(initialExecution?.at,language)}`} onClose={onClose} footer={<>
  {structured&&<ExportMenu compact items={[{id:'form',kind:'print',label:en?'Entry form':'Έντυπο καταχώρησης',onClick:printDraft}]}/>}
  <ChoiceChips className="control-exec-confirm" options={[{value:'confirmed',label:en?'I confirm the corrections are accurate':'Επιβεβαιώνω ότι οι διορθώσεις είναι σωστές'}]} selected={confirmed?['confirmed']:[]} onToggle={()=>setConfirmed(x=>!x)}/>
  <DialogActions onCancel={onClose} onSave={()=>{if(valid&&confirmed)onSave(payload())}} disabled={!confirmed||!valid} saveLabel={en?'Save changes':'Αποθήκευση αλλαγών'}/>
 </>}>
  <div className="control-exec-main"><ExecutionFields state={state} record={record} department={department}/></div>
  {initialExecution?.evidence?.length>0&&<div className="control-evidence-existing"><span className="lo-field-label">{en?'Evidence':'Τεκμήρια'}</span><ControlEvidenceLinks evidence={initialExecution.evidence} language={language}/></div>}
  <small className="control-exec-hint">{en?`Edited by ${actor.name}`:`Επεξεργασία από ${actor.name}`}</small>
 </ObserverDialog>
}
