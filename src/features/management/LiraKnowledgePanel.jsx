import { useEffect,useMemo,useState } from 'react'
import { CheckCircle2,FilePlus2,Pencil,RotateCcw } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { FilterBar } from '../../design-system/FilterBar'
import { RecordDetailsGrid } from '../../design-system/RecordDetailsGrid'
import { RegistryTable } from '../../design-system/RegistryTable'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { supabase } from '../../core/supabase/client'

const statusLabel=(value,en)=>({review:en?'In review':'Προς έλεγχο',approved:en?'Approved':'Εγκεκριμένη',retired:en?'Retired':'Αποσυρμένη'}[value]||value)
const ingestionLabel=(value,en)=>({ingested:en?'Ready':'Έτοιμη',pending:en?'Pending':'Εκκρεμεί',failed:en?'Failed':'Αποτυχία'}[value]||value)
const badgeClass=value=>value==='approved'||value==='ingested'?'active':value==='retired'||value==='failed'?'danger':'temporary'

export function LiraKnowledgePanel(){
 const {language}=useLanguage();const en=language==='en';const {tenant}=useTenant();const {notify}=useFeedback()
 const [rows,setRows]=useState([]);const [loading,setLoading]=useState(true);const [selected,setSelected]=useState(null);const [chunks,setChunks]=useState([]);const [edit,setEdit]=useState(null);const [version,setVersion]=useState('');const [query,setQuery]=useState('');const [authority,setAuthority]=useState('all');const [status,setStatus]=useState('all')
 async function load(){if(!supabase){setRows([]);setLoading(false);return}setLoading(true);const {data,error}=await supabase.from('lira_knowledge_sources').select('id,title,authority,source_version,source_url,status,ingestion_status,effective_from,effective_to,approved_at,review_notes').order('authority').order('title');if(error)notify(error.message,'error');else setRows(data||[]);setLoading(false)}
 useEffect(()=>{load()},[tenant?.id])
 const authorities=useMemo(()=>[...new Set(rows.map(x=>x.authority).filter(Boolean))].sort(),[rows])
 const filtered=useMemo(()=>{const q=query.trim().toLocaleLowerCase();return rows.filter(x=>(authority==='all'||x.authority===authority)&&(status==='all'||x.status===status)&&(!q||[x.authority,x.title,x.source_version].some(v=>String(v||'').toLocaleLowerCase().includes(q))))},[rows,query,authority,status])
 async function open(row){setSelected(row);setVersion('');const {data,error}=await supabase.from('lira_knowledge_chunks').select('id,chunk_index,heading,content,citation_label,page_start,page_end').eq('source_id',row.id).order('chunk_index');if(error)notify(error.message,'error');setChunks(data||[])}
 async function approve(){const {error}=await supabase.rpc('approve_lira_knowledge_source',{p_source_id:selected.id,p_review_notes:'Approved from LIRA Knowledge Center'});if(error)return notify(error.message,'error');notify(en?'Knowledge source approved.':'Η πηγή γνώσης εγκρίθηκε.','success');setSelected(null);load()}
 async function retire(){const {error}=await supabase.rpc('retire_lira_knowledge_source',{p_source_id:selected.id,p_review_notes:'Retired from LIRA Knowledge Center'});if(error)return notify(error.message,'error');notify(en?'Source retired.':'Η πηγή αποσύρθηκε.','success');setSelected(null);load()}
 async function saveEdit(){const {error}=await supabase.rpc('revise_lira_knowledge_source',{p_source_id:selected.id,p_title:edit.title,p_source_version:edit.source_version,p_source_url:edit.source_url||'',p_review_notes:edit.review_notes||''});if(error)return notify(error.message,'error');notify(en?'Source updated.':'Η πηγή ενημερώθηκε.','success');setEdit(null);setSelected(null);load()}
 async function newVersion(){if(!version.trim())return;const {error}=await supabase.rpc('create_lira_knowledge_source_version',{p_source_id:selected.id,p_source_version:version.trim(),p_review_notes:'New version created from approved source'});if(error)return notify(error.message,'error');notify(en?'New review version created.':'Δημιουργήθηκε νέα έκδοση προς έλεγχο.','success');setSelected(null);load()}
 return <section className="management-section management-scroll-section">
  <div className="section-toolbar"><div><h2>{en?'LIRA Knowledge':'Γνώση LIRA'}</h2><p>{en?'Governed clinical knowledge used by LIRA. Open a source to review its evidence and lifecycle.':'Ελεγχόμενη κλινική γνώση που χρησιμοποιεί η LIRA. Ανοίξτε μια πηγή για έλεγχο τεκμηρίωσης και διαχείριση έκδοσης.'}</p></div></div>
  <FilterBar compact query={query} onQueryChange={setQuery} placeholder={en?'Search sources…':'Αναζήτηση πηγών…'} onClear={()=>{setQuery('');setAuthority('all');setStatus('all')}} activeAdvancedCount={(authority==='all'?0:1)+(status==='all'?0:1)} advanced={<><label className="filter-select"><span>{en?'Authority':'Φορέας'}</span><select value={authority} onChange={e=>setAuthority(e.target.value)}><option value="all">{en?'All authorities':'Όλοι οι φορείς'}</option>{authorities.map(x=><option key={x} value={x}>{x}</option>)}</select></label><label className="filter-select"><span>{en?'Status':'Κατάσταση'}</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">{en?'All statuses':'Όλες οι καταστάσεις'}</option><option value="review">{en?'In review':'Προς έλεγχο'}</option><option value="approved">{en?'Approved':'Εγκεκριμένες'}</option><option value="retired">{en?'Retired':'Αποσυρμένες'}</option></select></label></>}/>
  {loading?<div className="inline-empty">{en?'Loading…':'Φόρτωση…'}</div>:<RegistryTable
   wrapperClassName="table-wrap scroll-table"
   columns={[{key:'authority',label:en?'Authority':'Φορέας'},{key:'source',label:en?'Source':'Πηγή'},{key:'version',label:en?'Version':'Έκδοση'},{key:'status',label:en?'Approval':'Έγκριση'},{key:'knowledge',label:en?'Knowledge':'Γνώση'}]}
   rows={filtered}
   rowKey={x=>x.id}
   rowProps={x=>({className:`clickable-row ${selected?.id===x.id?'is-selected':''}`,tabIndex:0,onClick:()=>open(x),onKeyDown:e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(x)}}})}
   renderRow={x=><><td><strong>{x.authority}</strong></td><td>{x.title}</td><td>{x.source_version||'—'}</td><td><span className={`status-badge ${badgeClass(x.status)}`}>{statusLabel(x.status,en)}</span></td><td><span className={`status-badge ${badgeClass(x.ingestion_status)}`}>{ingestionLabel(x.ingestion_status,en)}</span></td></>}
   emptyTitle={rows.length?(en?'No sources match the filters.':'Δεν βρέθηκαν πηγές με αυτά τα φίλτρα.'):(en?'No knowledge sources yet.':'Δεν υπάρχουν ακόμη πηγές γνώσης.')}
  />}
  {selected&&<ObserverDialog onClose={()=>setSelected(null)} eyebrow={en?'KNOWLEDGE SOURCE':'ΠΗΓΗ ΓΝΩΣΗΣ'} title={selected.title||''} subtitle={[selected.authority,selected.source_version].filter(Boolean).join(' · ')} width="wide" className="lira-knowledge-dialog" footer={<DialogActions>
    <Button variant="secondary" onClick={()=>setSelected(null)}>{en?'Close':'Κλείσιμο'}</Button>
    {selected.status==='review'&&<><Button variant="secondary" onClick={()=>setEdit({...selected})}><Pencil size={15}/>{en?'Edit details':'Επεξεργασία'}</Button><Button onClick={approve}><CheckCircle2 size={15}/>{en?'Approve':'Έγκριση'}</Button></>}
    {selected.status==='approved'&&<Button variant="danger" onClick={retire}><RotateCcw size={15}/>{en?'Retire':'Απόσυρση'}</Button>}
   </DialogActions>}>
   <section className="record-section lira-knowledge-summary"><RecordDetailsGrid fields={[
    {id:'authority',label:en?'Authority':'Φορέας',value:selected.authority},
    {id:'version',label:en?'Version':'Έκδοση',value:selected.source_version},
    {id:'status',label:en?'Approval':'Έγκριση',value:<span className={`status-badge ${badgeClass(selected.status)}`}>{statusLabel(selected.status,en)}</span>},
    {id:'knowledge',label:en?'Knowledge':'Γνώση',value:<span className={`status-badge ${badgeClass(selected.ingestion_status)}`}>{ingestionLabel(selected.ingestion_status,en)}</span>},
    {id:'url',label:en?'Official source':'Επίσημη πηγή',value:<a href={selected.source_url} target="_blank" rel="noreferrer">{selected.source_url}</a>,hidden:!selected.source_url,className:'detail-span-full'},
    {id:'notes',label:en?'Review notes':'Σημειώσεις ελέγχου',value:selected.review_notes,hidden:!selected.review_notes,className:'detail-span-full'},
   ]}/></section>
   {selected.status==='approved'&&<section className="lira-knowledge-new-version"><div><strong>{en?'New version for review':'Νέα έκδοση προς έλεγχο'}</strong><small>{en?'Creates a copy in review; the approved version stays active until the new one is approved.':'Δημιουργεί αντίγραφο προς έλεγχο· η εγκεκριμένη έκδοση μένει ενεργή μέχρι να εγκριθεί η νέα.'}</small></div><input className="lira-knowledge-version-input" aria-label={en?'New version':'Νέα έκδοση'} value={version} onChange={e=>setVersion(e.target.value)} placeholder={en?'e.g. 2026-01':'π.χ. 2026-01'}/><Button variant="secondary" disabled={!version.trim()} onClick={newVersion}><FilePlus2 size={15}/>{en?'Create version':'Δημιουργία έκδοσης'}</Button></section>}
   <section className="lira-knowledge-chunks"><header><h3>{en?'Knowledge content':'Περιεχόμενο γνώσης'}</h3><span className="status-badge">{chunks.length} {en?'sections':'ενότητες'}</span></header>
    <div className="lira-knowledge-chunk-list">{chunks.map(x=><article key={x.id} className="lira-knowledge-chunk"><strong>{x.heading||`#${x.chunk_index+1}`}</strong><p>{x.content}</p>{x.citation_label&&<small>{x.citation_label}{x.page_start!=null?` · p. ${x.page_start}${x.page_end&&x.page_end!==x.page_start?`–${x.page_end}`:''}`:''}</small>}</article>)}</div>
   </section>
  </ObserverDialog>}
  {edit&&<ObserverDialog onClose={()=>setEdit(null)} title={en?'Edit source under review':'Επεξεργασία πηγής υπό έλεγχο'} width="standard" footer={<DialogActions showCancel onCancel={()=>setEdit(null)} onSave={saveEdit}/>}>
   <div className="entry-grid"><label><span>{en?'Title':'Τίτλος'}</span><input value={edit.title} onChange={e=>setEdit({...edit,title:e.target.value})}/></label><label><span>{en?'Version':'Έκδοση'}</span><input value={edit.source_version||''} onChange={e=>setEdit({...edit,source_version:e.target.value})}/></label><label className="entry-span-2"><span>{en?'Source URL':'URL πηγής'}</span><input value={edit.source_url||''} onChange={e=>setEdit({...edit,source_url:e.target.value})}/></label><label className="entry-span-2"><span>{en?'Review notes':'Σημειώσεις ελέγχου'}</span><textarea rows={3} value={edit.review_notes||''} onChange={e=>setEdit({...edit,review_notes:e.target.value})}/></label></div>
  </ObserverDialog>}
 </section>
}
