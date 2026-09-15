import { useEffect,useState } from 'react'
import { Plus,Trash2 } from 'lucide-react'
import { ActionButton } from '../../design-system/ActionButton'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { ManualDateField } from '../../design-system/ManualDateField'
import { DocumentsWorkspace } from '../../design-system/DocumentsWorkspace'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { loadCertificatesAsync,createCertificateAsync,updateCertificateAsync,deleteCertificateAsync } from './employeeSubRecordsService'

const emptyDraft={titleEl:'',titleEn:'',issuer:'',issueDate:'',validUntil:'',certificateNumber:''}

export function EmployeeCertificatesTab({employee,language,organizationId,canEdit=false}){
  const {confirm,notify}=useFeedback()
  const [rows,setRows]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [selected,setSelected]=useState(null)
  const [editing,setEditing]=useState(false)
  const [draft,setDraft]=useState(emptyDraft)
  const [saving,setSaving]=useState(false)

  const load=async()=>{
    setLoading(true);setError('')
    try{setRows(await loadCertificatesAsync(organizationId,employee.dbId,employee.id))}
    catch(err){setError(err?.message||'LOAD_FAILED')}
    finally{setLoading(false)}
  }
  useEffect(()=>{load()},[organizationId,employee.dbId,employee.id])

  const titleOf=row=>language==='en'?(row.titleEn||row.titleEl):(row.titleEl||row.titleEn)
  const fmt=value=>value?new Intl.DateTimeFormat(language==='en'?'en-GB':'el-GR').format(new Date(`${value}T12:00:00`)):'—'
  const openNew=()=>{setSelected(null);setDraft(emptyDraft);setEditing(true)}
  const openEdit=row=>{setSelected(row);setDraft({...emptyDraft,...row});setEditing(true)}
  const close=()=>{setSelected(null);setEditing(false);setDraft(emptyDraft)}

  async function save(){
    if(saving||!draft.titleEl.trim())return
    setSaving(true)
    try{
      if(selected?.id)await updateCertificateAsync(organizationId,employee.dbId,selected.id,draft)
      else await createCertificateAsync(organizationId,employee.dbId,draft)
      await load();close();notify(language==='en'?'Certification saved.':'Η πιστοποίηση αποθηκεύτηκε.','success')
    }catch(err){notify(err?.message||(language==='en'?'Could not save certification.':'Δεν ήταν δυνατή η αποθήκευση της πιστοποίησης.'),'error')}
    finally{setSaving(false)}
  }
  async function remove(){
    if(!selected?.id||!canEdit)return
    const ok=await confirm({title:language==='en'?'Delete certification':'Διαγραφή πιστοποίησης',message:language==='en'?'The certification record will be deleted.':'Η εγγραφή της πιστοποίησης θα διαγραφεί.',confirmLabel:language==='en'?'Delete':'Διαγραφή',danger:true})
    if(!ok)return
    try{await deleteCertificateAsync(organizationId,employee.dbId,selected.id);await load();close();notify(language==='en'?'Certification deleted.':'Η πιστοποίηση διαγράφηκε.','success')}
    catch(err){notify(err?.message||(language==='en'?'Could not delete certification.':'Δεν ήταν δυνατή η διαγραφή της πιστοποίησης.'),'error')}
  }

  return <section className="record-section employee-secondary-registry">
    <div className="record-section-header"><div><span className="eyebrow">Limoxis Observer</span><h3>{language==='en'?'Certifications':'Πιστοποιήσεις'}</h3><p>{language==='en'?'Structured certification records with their supporting files.':'Δομημένες πιστοποιήσεις εργαζομένου με τα αντίστοιχα συνημμένα αρχεία.'}</p></div>{canEdit&&<ActionButton tone="primary" label={language==='en'?'Add certification':'Προσθήκη πιστοποίησης'} onClick={openNew}><Plus size={15}/><span>{language==='en'?'Add':'Προσθήκη'}</span></ActionButton>}</div>
    {loading?<div className="inline-empty">{language==='en'?'Loading…':'Φόρτωση…'}</div>:error?<div className="data-access-state error"><span>{language==='en'?'Could not load certifications.':'Δεν ήταν δυνατή η φόρτωση των πιστοποιήσεων.'}</span><Button variant="secondary" onClick={load}>{language==='en'?'Retry':'Επανάληψη'}</Button></div>:rows.length?<div className="scroll-table"><table className="data-table sticky-table record-table-clickable"><thead><tr><th>{language==='en'?'Certification':'Πιστοποίηση'}</th><th>{language==='en'?'Issuer':'Εκδότης'}</th><th>{language==='en'?'Issue date':'Έκδοση'}</th><th>{language==='en'?'Valid until':'Ισχύει έως'}</th><th>{language==='en'?'Number':'Αριθμός'}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} tabIndex={0} onClick={()=>openEdit(row)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openEdit(row)}}}><td><strong>{titleOf(row)||'—'}</strong></td><td>{row.issuer||'—'}</td><td>{fmt(row.issueDate)}</td><td>{fmt(row.validUntil)}</td><td>{row.certificateNumber||'—'}</td></tr>)}</tbody></table></div>:<div className="registry-empty-state employee-registry-empty"><strong>{language==='en'?'No certifications':'Δεν υπάρχουν πιστοποιήσεις'}</strong></div>}
    {editing&&<ObserverDialog width="wide" eyebrow={language==='en'?'Employee certification':'Πιστοποίηση εργαζομένου'} title={selected?titleOf(selected):(language==='en'?'New certification':'Νέα πιστοποίηση')} onClose={close} footer={<div className="dialog-actions">{selected&&canEdit&&<Button variant="danger" onClick={remove}><Trash2 size={15}/>{language==='en'?'Delete':'Διαγραφή'}</Button>}<Button variant="secondary" disabled={saving} onClick={close}>{language==='en'?'Cancel':'Ακύρωση'}</Button>{canEdit&&<SaveButton loading={saving} disabled={saving||!draft.titleEl.trim()} onClick={save}>{language==='en'?'Save':'Αποθήκευση'}</SaveButton>}</div>}>
      <div className="entry-grid"><label><span>{language==='en'?'Title (Greek)':'Τίτλος'} *</span><input value={draft.titleEl} disabled={!canEdit} onChange={e=>setDraft(v=>({...v,titleEl:e.target.value}))}/></label><label><span>{language==='en'?'Title (English)':'Τίτλος (EN)'}</span><input value={draft.titleEn} disabled={!canEdit} onChange={e=>setDraft(v=>({...v,titleEn:e.target.value}))}/></label><label><span>{language==='en'?'Issuer':'Εκδότης'}</span><input value={draft.issuer} disabled={!canEdit} onChange={e=>setDraft(v=>({...v,issuer:e.target.value}))}/></label><label><span>{language==='en'?'Certificate number':'Αριθμός πιστοποιητικού'}</span><input value={draft.certificateNumber} disabled={!canEdit} onChange={e=>setDraft(v=>({...v,certificateNumber:e.target.value}))}/></label><ManualDateField label={language==='en'?'Issue date':'Ημερομηνία έκδοσης'} value={draft.issueDate} disabled={!canEdit} onChange={value=>setDraft(v=>({...v,issueDate:value}))}/><ManualDateField label={language==='en'?'Valid until':'Ισχύει έως'} value={draft.validUntil} disabled={!canEdit} onChange={value=>setDraft(v=>({...v,validUntil:value}))}/></div>
      {selected?.id&&<DocumentsWorkspace title={language==='en'?'Attachments':'Συνημμένα'} subtitle={language==='en'?'Files supporting this certification.':'Αρχεία που τεκμηριώνουν τη συγκεκριμένη πιστοποίηση.'} disabled={!canEdit} organizationId={organizationId} entityType="employee-certificate" entityId={selected.id}/>} 
    </ObserverDialog>}
  </section>
}
