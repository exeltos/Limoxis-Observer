import { useEffect,useState } from 'react'
import { FilePlus2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { createDocumentAsync,loadDocumentsAsync } from './documentService'
import { loadDepartments } from '../management/departmentsService'

const types={el:{policy:'Πολιτική',procedure:'Διαδικασία',instruction:'Οδηγία',form:'Έντυπο',protocol:'Πρωτόκολλο',other:'Άλλο'},en:{policy:'Policy',procedure:'Procedure',instruction:'Instruction',form:'Form',protocol:'Protocol',other:'Other'}}

export function DocumentCreatePage(){
 const navigate=useNavigate();const {tenant}=useTenant();const {language}=useLanguage();const en=language==='en';const {notify}=useFeedback();const actor=useAuditActor()
 const [saving,setSaving]=useState(false),[departments,setDepartments]=useState([]),[existing,setExisting]=useState([])
 const [v,setV]=useState({title:'',type:'policy',version:'0.1',departmentId:null,audience:'all',effectiveDate:'',reviewDate:'',description:''})
 const set=(k,x)=>setV(s=>({...s,[k]:x}));const valid=v.title.trim()&&v.version.trim()
 useEffect(()=>{let active=true;if(!tenant?.id)return;Promise.all([loadDepartments(tenant.id),loadDocumentsAsync(tenant.id)]).then(([departmentRows,documentRows])=>{if(!active)return;setDepartments((departmentRows||[]).filter(x=>x.is_active!==false));setExisting(documentRows||[])}).catch(()=>{if(active){setDepartments([]);setExisting([])}});return()=>{active=false}},[tenant?.id])
 async function save(){if(!valid||saving)return;setSaving(true);try{const selected=departments.find(x=>x.id===v.departmentId);const record=await createDocumentAsync(tenant.id,{...v,department:selected?.name||'',departmentId:selected?.id||null},actor,existing);notify(en?'Document created. Add files from the Files tab.':'Το έγγραφο δημιουργήθηκε. Τα αρχεία προστίθενται από την καρτέλα «Αρχεία».','success');navigate(`/documents/${record.id}`,{replace:true})}catch(error){notify(en?'The document could not be saved. No local fallback was used.':'Το έγγραφο δεν αποθηκεύτηκε. Δεν χρησιμοποιήθηκε τοπική εναλλακτική αποθήκευση.','danger')}finally{setSaving(false)}}
 return <Page fill><EntityRecordShell className="document-create-shell workspace-fill" avatar={<FilePlus2 size={19}/>} eyebrow={en?'Documents':'Έγγραφα'} title={en?'New document':'Νέο έγγραφο'} subtitle={en?'Create controlled document record':'Δημιουργία ελεγχόμενου εγγράφου'} tabs={[]} activeTab="" onTabChange={()=>{}} onBack={()=>navigate('/documents')}>
  <div className="record-section document-create-form">
   <div className="entry-grid">
    <label className="entry-span-2"><span>{en?'Title *':'Τίτλος *'}</span><input autoFocus value={v.title} onChange={e=>set('title',e.target.value)}/></label>
    <label><span>{en?'Type':'Τύπος'}</span><select value={v.type} onChange={e=>set('type',e.target.value)}>{Object.entries(types[language]||types.el).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <label><span>{en?'Version *':'Έκδοση *'}</span><input value={v.version} onChange={e=>set('version',e.target.value)} placeholder="1.0"/></label>
    <label><span>{en?'Department / scope':'Τμήμα / πεδίο εφαρμογής'}</span><select value={v.departmentId||''} onChange={e=>set('departmentId',e.target.value||null)}><option value="">{en?'Whole hospital / not specified':'Όλο το νοσοκομείο / χωρίς συγκεκριμένο τμήμα'}</option>{departments.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
    <div className="source-truth-note"><strong>{en?'Owner':'Υπεύθυνος'}:</strong> {actor?.name||'—'}<br/><small>{en?'The owner is recorded automatically from the authenticated user.':'Ο υπεύθυνος καταγράφεται αυτόματα από τον συνδεδεμένο χρήστη.'}</small></div>
    <ManualDateField label={en?'Effective date':'Ημερομηνία ισχύος'} value={v.effectiveDate} onChange={x=>set('effectiveDate',x)} optional/>
    <ManualDateField label={en?'Review date':'Ημερομηνία επανεξέτασης'} value={v.reviewDate} onChange={x=>set('reviewDate',x)} optional/>
    <label className="entry-span-2"><span>{en?'Description':'Περιγραφή'}</span><textarea rows="3" value={v.description} onChange={e=>set('description',e.target.value)}/></label>
    <div className="source-truth-note entry-span-2">{en?'Save the document first. Attachments are then uploaded to the saved record from the Files tab.':'Αποθηκεύστε πρώτα το έγγραφο. Τα συνημμένα ανεβαίνουν στη συνέχεια στην πραγματική εγγραφή από την καρτέλα «Αρχεία».'}</div>
   </div>
   <div className="inline-edit-footer"><Button variant="secondary" onClick={()=>navigate('/documents')}>{en?'Cancel':'Ακύρωση'}</Button><SaveButton loading={saving} disabled={!valid||saving} onClick={save}>{en?'Save':'Αποθήκευση'}</SaveButton></div>
  </div>
 </EntityRecordShell></Page>
}
