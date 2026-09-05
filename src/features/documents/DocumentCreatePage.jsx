import { useEffect,useState } from 'react'
import { FilePlus2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { createDocumentAsync,loadDocumentsAsync } from './documentService'
import { DocumentForm,createEmptyDocumentDraft,documentDraftIsValid } from './DocumentForm'
import { loadDepartments } from '../management/departmentsService'

export function DocumentCreatePage(){
 const navigate=useNavigate();const {tenant}=useTenant();const {language}=useLanguage();const en=language==='en';const {notify}=useFeedback();const actor=useAuditActor()
 const [saving,setSaving]=useState(false),[departments,setDepartments]=useState([]),[existing,setExisting]=useState([])
 const [v,setV]=useState(createEmptyDocumentDraft)
 const valid=documentDraftIsValid(v)
 useEffect(()=>{let active=true;if(!tenant?.id)return;Promise.all([loadDepartments(tenant.id),loadDocumentsAsync(tenant.id)]).then(([departmentRows,documentRows])=>{if(!active)return;setDepartments((departmentRows||[]).filter(x=>x.is_active!==false));setExisting(documentRows||[])}).catch(()=>{if(active){setDepartments([]);setExisting([])}});return()=>{active=false}},[tenant?.id])
 async function save(){if(!valid||saving)return;setSaving(true);try{const selected=departments.find(x=>x.id===v.departmentId);const record=await createDocumentAsync(tenant.id,{...v,department:selected?.name||'',departmentId:selected?.id||null},actor,existing);notify(en?'Document created. Add files from the Files tab.':'Το έγγραφο δημιουργήθηκε. Τα αρχεία προστίθενται από την καρτέλα «Αρχεία».','success');navigate(`/documents/${record.id}`,{replace:true})}catch(error){notify(en?'The document could not be saved. No local fallback was used.':'Το έγγραφο δεν αποθηκεύτηκε. Δεν χρησιμοποιήθηκε τοπική εναλλακτική αποθήκευση.','danger')}finally{setSaving(false)}}
 return <Page fill><EntityRecordShell className="document-create-shell workspace-fill" avatar={<FilePlus2 size={19}/>} eyebrow={en?'Documents':'Έγγραφα'} title={en?'New document':'Νέο έγγραφο'} subtitle={en?'Create controlled document record':'Δημιουργία ελεγχόμενου εγγράφου'} tabs={[]} activeTab="" onTabChange={()=>{}} onBack={()=>navigate('/documents')}>
  <div className="record-section document-create-form">
   <DocumentForm value={v} onChange={setV} language={language} departments={departments} ownerName={actor?.name||''} showOwner showAttachmentHint autoFocus/>
   <div className="inline-edit-footer"><Button variant="secondary" onClick={()=>navigate('/documents')}>{en?'Cancel':'Ακύρωση'}</Button><SaveButton loading={saving} disabled={!valid||saving} onClick={save}>{en?'Save':'Αποθήκευση'}</SaveButton></div>
  </div>
 </EntityRecordShell></Page>
}
