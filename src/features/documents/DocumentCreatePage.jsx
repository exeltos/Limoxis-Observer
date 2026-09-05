import { useEffect,useState } from 'react'
import { FilePlus2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { ManualDateField } from '../../design-system/ManualDateField'
import { AttachmentField } from '../../design-system/AttachmentField'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { createDocumentAsync } from './documentService'
import { loadDepartments } from '../management/departmentsService'

const types={el:{policy:'Πολιτική',procedure:'Διαδικασία',instruction:'Οδηγία',form:'Έντυπο',protocol:'Πρωτόκολλο',other:'Άλλο'},en:{policy:'Policy',procedure:'Procedure',instruction:'Instruction',form:'Form',protocol:'Protocol',other:'Other'}}

export function DocumentCreatePage(){
 const navigate=useNavigate();const {tenant}=useTenant();const {language}=useLanguage();const en=language==='en';const {notify}=useFeedback();const actor=useAuditActor()
 const [saving,setSaving]=useState(false),[departments,setDepartments]=useState([])
 const [v,setV]=useState({title:'',type:'policy',version:'0.1',owner:'',department:'',departmentId:null,audience:'all',effectiveDate:'',reviewDate:'',description:'',attachments:[]})
 const set=(k,x)=>setV(s=>({...s,[k]:x}));const valid=v.title.trim()&&v.version.trim()
 useEffect(()=>{let active=true;if(!tenant?.id)return;loadDepartments(tenant.id).then(rows=>{if(active)setDepartments((rows||[]).filter(x=>x.is_active!==false))}).catch(()=>{if(active)setDepartments([])});return()=>{active=false}},[tenant?.id])
 async function save(){if(!valid||saving)return;setSaving(true);try{const selected=departments.find(x=>x.id===v.departmentId);const record=await createDocumentAsync(tenant.id,{...v,department:selected?.name||v.department||'',departmentId:selected?.id||null},actor,[]);notify(en?'Document created.':'Το έγγραφο δημιουργήθηκε.','success');navigate(`/documents/${record.id}`,{replace:true})}catch(error){notify(en?'The document could not be saved. No local fallback was used.':'Το έγγραφο δεν αποθηκεύτηκε. Δεν χρησιμοποιήθηκε τοπική εναλλακτική αποθήκευση.','danger')}finally{setSaving(false)}}
 return <Page fill><EntityRecordShell className="document-create-shell workspace-fill" avatar={<FilePlus2 size={19}/>} eyebrow={en?'Documents':'Έγγραφα'} title={en?'New document':'Νέο έγγραφο'} subtitle={en?'Create controlled document record':'Δημιουργία ελεγχόμενου εγγράφου'} tabs={[]} activeTab="" onTabChange={()=>{}} onBack={()=>navigate('/documents')}>
  <div className="record-section document-create-form">
   <div className="entry-grid">
    <label className="entry-span-2"><span>{en?'Title *':'Τίτλος *'}</span><input autoFocus value={v.title} onChange={e=>set('title',e.target.value)}/></label>
    <label><span>{en?'Type':'Τύπος'}</span><select value={v.type} onChange={e=>set('type',e.target.value)}>{Object.entries(types[language]||types.el).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <label><span>{en?'Version *':'Έκδοση *'}</span><input value={v.version} onChange={e=>set('version',e.target.value)} placeholder="1.0"/></label>
    <label><span>{en?'Owner':'Υπεύθυνος'}</span><input value={v.owner} onChange={e=>set('owner',e.target.value)}/></label>
    <label><span>{en?'Department / scope':'Τμήμα / πεδίο εφαρμογής'}</span><select value={v.departmentId||''} onChange={e=>set('departmentId',e.target.value||null)}><option value="">{en?'Whole hospital / not specified':'Όλο το νοσοκομείο / χωρίς συγκεκριμένο τμήμα'}</option>{departments.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
    <ManualDateField label={en?'Effective date':'Ημερομηνία ισχύος'} value={v.effectiveDate} onChange={x=>set('effectiveDate',x)} optional/>
    <ManualDateField label={en?'Review date':'Ημερομηνία επανεξέτασης'} value={v.reviewDate} onChange={x=>set('reviewDate',x)} optional/>
    <label className="entry-span-2"><span>{en?'Description':'Περιγραφή'}</span><textarea rows="3" value={v.description} onChange={e=>set('description',e.target.value)}/></label>
    <div className="entry-span-2"><AttachmentField value={v.attachments} onChange={x=>set('attachments',x)}/></div>
   </div>
   <div className="inline-edit-footer"><Button variant="secondary" onClick={()=>navigate('/documents')}>{en?'Cancel':'Ακύρωση'}</Button><SaveButton loading={saving} disabled={!valid||saving} onClick={save}>{en?'Save':'Αποθήκευση'}</SaveButton></div>
  </div>
 </EntityRecordShell></Page>
}
