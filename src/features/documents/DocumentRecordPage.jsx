import { useMemo,useState } from 'react'
import { Archive,BookOpenCheck,FileClock,Paperclip,Pencil } from 'lucide-react'
import { useNavigate,useParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { AttachmentField } from '../../design-system/AttachmentField'
import { ManualDateField } from '../../design-system/ManualDateField'
import { PrintExportActions } from '../../design-system/PrintExportActions'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { downloadRecordJson } from '../../core/export/recordExport'
import { useTenant } from '../../core/tenant/TenantContext'
import { can,CAPABILITIES } from '../../core/permissions/roles'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { loadDocuments,saveDocuments } from './documentStore'

const typeLabels={policy:'Πολιτική',procedure:'Διαδικασία',instruction:'Οδηγία',form:'Έντυπο',protocol:'Πρωτόκολλο',other:'Άλλο'}
const statusLabels={draft:'Πρόχειρο',published:'Δημοσιευμένο',archived:'Αρχειοθετημένο'}

export function DocumentRecordPage(){
 const {documentId}=useParams(),navigate=useNavigate(),actor=useAuditActor(),{notify,confirm}=useFeedback(),{role,membership}=useTenant()
 const [rows,setRows]=useState(loadDocuments),[tab,setTab]=useState('overview'),[editOpen,setEditOpen]=useState(false)
 const record=rows.find(x=>x.id===documentId)
 const addOns=membership?.capabilities??[],custom=membership?.customCapabilities??[]
 const canManage=can(role,CAPABILITIES.EDIT_RECORDS,addOns,custom)&&can(role,CAPABILITIES.ATTACH_FILES,addOns,custom)
 if(!record)return <Page title="Έγγραφα"><div className="inline-empty">Το έγγραφο δεν βρέθηκε.</div></Page>
 function persist(next){const all=rows.map(x=>x.id===record.id?next:x);setRows(all);saveDocuments(all)}
 function audit(next,action,reason){const now=new Date().toISOString();return {...next,updatedAt:now,updatedBy:actor.name,updatedById:actor.id,history:[{at:now,actor:actor.name,actorId:actor.id,action,reason},...(next.history||record.history||[])]}}
 function saveEdit(data){persist(audit({...record,...data},'Επεξεργασία στοιχείων εγγράφου',data.version?`Έκδοση ${data.version}`:''));setEditOpen(false);notify('Το έγγραφο ενημερώθηκε.','success')}
 async function publish(){const ok=await confirm({title:'Δημοσίευση εγγράφου',message:'Η τρέχουσα έκδοση θα χαρακτηριστεί ως δημοσιευμένη και διαθέσιμη για χρήση. Θέλετε να συνεχίσετε;',confirmLabel:'Δημοσίευση'});if(!ok)return;persist(audit({...record,status:'published',publishedAt:new Date().toISOString(),publishedBy:actor.name},'Δημοσίευση εγγράφου',`Έκδοση ${record.version}`));notify('Το έγγραφο δημοσιεύτηκε.','success')}
 async function archive(){const ok=await confirm({title:'Αρχειοθέτηση εγγράφου',message:'Το έγγραφο θα πάψει να θεωρείται ενεργό για τρέχουσα χρήση. Το ιστορικό θα διατηρηθεί.',confirmLabel:'Αρχειοθέτηση',danger:true});if(!ok)return;persist(audit({...record,status:'archived'},'Αρχειοθέτηση εγγράφου',`Έκδοση ${record.version}`));notify('Το έγγραφο αρχειοθετήθηκε.','success')}
 function attachments(next){persist(audit({...record,attachments:next},'Ενημέρωση συνημμένων',`${next.length} συνημμένα`));notify('Τα συνημμένα ενημερώθηκαν.','success')}
 const tabs=[{id:'overview',label:'Σύνοψη',icon:BookOpenCheck},{id:'files',label:'Αρχεία',icon:Paperclip},{id:'history',label:'Ιστορικό',icon:FileClock}]
 return <Page fill><EntityRecordShell avatar={<BookOpenCheck size={19}/>} eyebrow={record.id} title={record.title} subtitle={`${typeLabels[record.type]||record.type} · Έκδοση ${record.version||'—'}`} status={<span className={`status-badge ${record.status==='published'?'active':record.status==='draft'?'temporary':''}`}>{statusLabels[record.status]||record.status}</span>} onBack={()=>navigate('/documents')} headerActions={<>{canManage&&<button className="general-edit-button" onClick={()=>setEditOpen(true)}><Pencil size={15}/> Επεξεργασία</button>}{canManage&&record.status==='draft'&&<Button onClick={publish}>Δημοσίευση</Button>}{canManage&&record.status==='published'&&<button className="entity-record-icon-button danger" onClick={archive} title="Αρχειοθέτηση" aria-label="Αρχειοθέτηση"><Archive size={15}/></button>}<PrintExportActions onExport={()=>downloadRecordJson(record,{filename:record.id})}/></>} tabs={tabs} activeTab={tab} onTabChange={setTab}>
  {tab==='overview'&&<section className="record-section"><div className="record-section-header"><div><span className="eyebrow">Έγγραφα</span><h3>Βασικά στοιχεία</h3></div></div><div className="details-grid"><div><span>Τύπος</span><strong>{typeLabels[record.type]||'—'}</strong></div><div><span>Έκδοση</span><strong>{record.version||'—'}</strong></div><div><span>Υπεύθυνος</span><strong>{record.owner||'—'}</strong></div><div><span>Τμήμα / πεδίο εφαρμογής</span><strong>{record.department||'—'}</strong></div><div><span>Ημερομηνία ισχύος</span><strong>{record.effectiveDate||'—'}</strong></div><div><span>Επανεξέταση</span><strong>{record.reviewDate||'—'}</strong></div></div><div className="source-truth-note">{record.description||'Δεν έχει καταχωρηθεί περιγραφή.'}</div></section>}
  {tab==='files'&&<section className="record-section"><div className="record-section-header"><div><span className="eyebrow">Έγγραφα</span><h3>Αρχεία & συνημμένα</h3><p>Η προβολή ανοίγει το ίδιο το αρχείο. Κάθε προσθήκη/μεταβολή καταγράφεται στο ιστορικό.</p></div></div><AttachmentField disabled={!canManage||record.status==='archived'} value={record.attachments||[]} onChange={attachments}/></section>}
  {tab==='history'&&<DocumentHistory rows={record.history||[]}/>}
 </EntityRecordShell>{editOpen&&<DocumentEditDialog initial={record} onClose={()=>setEditOpen(false)} onSave={saveEdit}/>}</Page>
}

function DocumentEditDialog({initial,onClose,onSave}){
 const [v,setV]=useState({...initial}),set=(k,x)=>setV(s=>({...s,[k]:x}))
 return <ObserverDialog width="wide" eyebrow="Έγγραφα" title="Επεξεργασία εγγράφου" subtitle={initial.id} onClose={onClose} footer={<DialogActions onCancel={onClose} disabled={!v.title?.trim()||!v.version?.trim()||!v.owner?.trim()} onSave={()=>onSave(v)}/>}>
  <div className="entry-grid compact"><label className="entry-span-2"><span>Τίτλος *</span><input value={v.title} onChange={e=>set('title',e.target.value)}/></label><label><span>Τύπος</span><select value={v.type} onChange={e=>set('type',e.target.value)}>{Object.entries(typeLabels).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><label><span>Έκδοση *</span><input value={v.version} onChange={e=>set('version',e.target.value)}/></label><label><span>Υπεύθυνος *</span><input value={v.owner} onChange={e=>set('owner',e.target.value)}/></label><label><span>Τμήμα / πεδίο εφαρμογής</span><input value={v.department||''} onChange={e=>set('department',e.target.value)}/></label><ManualDateField label="Ημερομηνία ισχύος" value={v.effectiveDate||''} onChange={x=>set('effectiveDate',x)} optional/><ManualDateField label="Επανεξέταση" value={v.reviewDate||''} onChange={x=>set('reviewDate',x)} optional/><label className="entry-span-2"><span>Περιγραφή</span><textarea rows="3" value={v.description||''} onChange={e=>set('description',e.target.value)}/></label></div>
 </ObserverDialog>
}

function DocumentHistory({rows}){
 const [query,setQuery]=useState(''),[action,setAction]=useState('all')
 const actions=[...new Set(rows.map(x=>x.action).filter(Boolean))]
 const filtered=useMemo(()=>rows.filter(x=>(action==='all'||x.action===action)&&`${x.action} ${x.actor} ${x.reason||''}`.toLowerCase().includes(query.toLowerCase())),[rows,query,action])
 return <section className="record-section"><div className="record-section-header"><div><span className="eyebrow">Έγγραφα</span><h3>Ιστορικό</h3><p>Πλήρης ιστορικότητα εκδόσεων, δημοσιεύσεων, αρχείων και μεταβολών.</p></div></div><FilterBar query={query} onQueryChange={setQuery} placeholder="Αναζήτηση ιστορικού..." activeAdvancedCount={action!=='all'?1:0} onClear={()=>{setQuery('');setAction('all')}}><FilterSelect label="Ενέργεια" value={action} onChange={setAction}><option value="all">Όλες</option>{actions.map(x=><option key={x}>{x}</option>)}</FilterSelect></FilterBar><div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th>Ημερομηνία / ώρα</th><th>Ενέργεια</th><th>Χρήστης</th><th>Στοιχεία</th></tr></thead><tbody>{filtered.map((h,i)=><tr key={`${h.at}-${i}`}><td>{h.at?new Date(h.at).toLocaleString('el-GR'):'—'}</td><td><strong>{h.action}</strong></td><td>{h.actor||'—'}</td><td>{h.reason||'—'}</td></tr>)}</tbody></table></div></section>
}
