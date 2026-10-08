import { useEffect,useMemo,useState } from 'react'
import { CheckCircle2,Clock3,FileText } from 'lucide-react'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { JOB_DESCRIPTION_FIELDS,acknowledgePosition,acknowledgementState,emptyJobDescription,hasJobDescription,loadPositionAcknowledgements,positionRow } from './jobDescription'
import './jobDescription.css'

// Edit a position's job description (Management > Libraries > Job positions).
export function JobDescriptionDialog({row,language,onClose,onSave,saving=false}){
 const en=language==='en'
 const current=row?.[2]?.jobDescription||emptyJobDescription()
 const [draft,setDraft]=useState(()=>({...emptyJobDescription(),...current}))
 const changed=JOB_DESCRIPTION_FIELDS.some(([key])=>String(draft[key]||'')!==String(current[key]||''))
 return <ObserverDialog width="wide" eyebrow={en?'Job description':'Περιγραφή θέσης'} title={row?.[en?1:0]||row?.[0]} subtitle={current.version?(en?`Version ${current.version} · saving creates version ${current.version+1}; staff will be asked to accept it again.`:`Έκδοση ${current.version} · η αποθήκευση δημιουργεί την έκδοση ${current.version+1} και το προσωπικό θα κληθεί να την αποδεχτεί ξανά.`):(en?'Staff in this position will be asked to accept it.':'Το προσωπικό της θέσης θα κληθεί να την αποδεχτεί.')} onClose={onClose} footer={<DialogActions showCancel onCancel={onClose} onSave={()=>onSave(draft)} disabled={!changed||saving||!hasJobDescription(draft)} saveLabel={en?'Save new version':'Αποθήκευση νέας έκδοσης'}/>}>
  <div className="job-description-form">
   {JOB_DESCRIPTION_FIELDS.map(([key,el,enLabel])=><label key={key} className={key==='reportsTo'?'':'span-2'}><span>{en?enLabel:el}</span>{key==='reportsTo'?<input value={draft[key]||''} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))}/>:<textarea rows={key==='purpose'?2:4} value={draft[key]||''} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))} placeholder={en?'One item per line':'Ένα στοιχείο ανά γραμμή'}/>}</label>)}
  </div>
 </ObserverDialog>
}

// Employee record > Position: the description of the employee's position and
// the employee's acceptance of the current version.
export function EmployeePositionTab({employee,positions=[],language,organizationId,canAcknowledge,actorName}){
 const en=language==='en'
 const {notify,notifyError}=useFeedback()
 const row=positionRow(positions,employee.position)
 const jd=row?.[2]?.jobDescription||null
 const [acks,setAcks]=useState([])
 const [busy,setBusy]=useState(false)
 useEffect(()=>{let active=true;loadPositionAcknowledgements(organizationId,employee).then(rows=>{if(active)setAcks(rows)}).catch(()=>{if(active)setAcks([])});return()=>{active=false}},[organizationId,employee])
 const forPosition=useMemo(()=>acks.filter(a=>a.position===employee.position),[acks,employee.position])
 const {state,latest}=acknowledgementState(jd,forPosition)
 const fmt=v=>v?new Intl.DateTimeFormat(en?'en-GB':'el-GR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—'
 async function accept(){
  setBusy(true)
  try{const saved=await acknowledgePosition(organizationId,employee,{position:employee.position,version:jd.version,actorName});setAcks(current=>[saved,...current]);notify(en?'Job description accepted.':'Η περιγραφή θέσης έγινε αποδεκτή.','success')}
  catch(error){notifyError(error,'save',{operation:'position_acknowledgement'})}
  finally{setBusy(false)}
 }
 if(!employee.position)return <div className="record-section"><div className="inline-empty">{en?'No job position is set for this employee.':'Δεν έχει οριστεί θέση εργασίας για τον εργαζόμενο.'}</div></div>
 return <div className="record-section job-description-view">
  <div className="record-section-header"><div><span className="eyebrow">{en?'JOB POSITION':'ΘΕΣΗ ΕΡΓΑΣΙΑΣ'}</span><h3>{en?(row?.[1]||employee.positionEn||employee.position):employee.position}</h3>{jd?.version>0&&<p>{en?`Version ${jd.version} · updated ${fmt(jd.updatedAt)}`:`Έκδοση ${jd.version} · ενημέρωση ${fmt(jd.updatedAt)}`}{jd.updatedBy?` · ${jd.updatedBy}`:''}</p>}</div></div>
  {state!=='none'&&<div className={`job-description-ack ${state}`}>
   {state==='acknowledged'?<CheckCircle2 size={18} aria-hidden="true"/>:<Clock3 size={18} aria-hidden="true"/>}
   <div><strong>{state==='acknowledged'?(en?'Accepted':'Αποδεκτή'):state==='outdated'?(en?'A new version needs to be accepted':'Νέα έκδοση προς αποδοχή'):(en?'Not accepted yet':'Εκκρεμεί αποδοχή')}</strong><small>{latest?(en?`Version ${latest.version} accepted ${fmt(latest.acknowledgedAt)}`:`Αποδοχή έκδοσης ${latest.version} στις ${fmt(latest.acknowledgedAt)}`):(en?'The employee has not accepted this job description.':'Ο εργαζόμενος δεν έχει αποδεχτεί την περιγραφή θέσης.')}</small></div>
   {canAcknowledge&&state!=='acknowledged'&&<Button disabled={busy} onClick={accept}><CheckCircle2 size={15}/>{en?' I have read and accept it':' Τη διάβασα και την αποδέχομαι'}</Button>}
  </div>}
  {hasJobDescription(jd)?<div className="job-description-sections">{JOB_DESCRIPTION_FIELDS.filter(([key])=>String(jd[key]||'').trim()).map(([key,el,enLabel])=><section key={key}><span>{en?enLabel:el}</span>{key==='reportsTo'||key==='purpose'?<p>{jd[key]}</p>:<ul>{String(jd[key]).split('\n').map(line=>line.replace(/^\s*[-•*]\s*/,'').trim()).filter(Boolean).map((line,index)=><li key={index}>{line}</li>)}</ul>}</section>)}</div>:<div className="inline-empty"><FileText size={16} aria-hidden="true"/> {en?'This position has no job description yet. It is written in Management > Libraries > Job positions.':'Η θέση δεν έχει ακόμη περιγραφή. Συντάσσεται στο Κέντρο Διαχείρισης > Βιβλιοθήκες > Θέσεις εργασίας.'}</div>}
  {forPosition.length>0&&<div className="job-description-history"><span>{en?'Acceptance history':'Ιστορικό αποδοχών'}</span><ul>{forPosition.map(a=><li key={a.id||a.acknowledgedAt}>{en?`Version ${a.version}`:`Έκδοση ${a.version}`} · {fmt(a.acknowledgedAt)}{a.acknowledgedByName?` · ${a.acknowledgedByName}`:''}</li>)}</ul></div>}
 </div>
}
