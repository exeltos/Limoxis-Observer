import { useEffect,useState } from 'react'
import { Plus } from 'lucide-react'
import { ActionButton } from '../../design-system/ActionButton'
import { Button } from '../../design-system/Button'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { FilterBar } from '../../design-system/FilterBar'\nimport { ManualDateField } from '../../design-system/ManualDateField'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { DocumentsWorkspace } from '../../design-system/DocumentsWorkspace'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { useEmployeeSubRecords } from './useEmployeeSubRecords'
import { loadOccupationalVisitsAsync,loadVaccinationsAsync,loadEmployeeTrainingAsync,loadEvaluationsAsync,loadExposureIncidentsAsync,createEmployeeEvaluationAsync,updateEmployeeEvaluationWorkflowAsync } from './employeeSubRecordsService'
import { loadEmployeeHistoryAsync } from './employeeHistoryService'
import { getEmployeeSurveillanceForEmployee,updateEmployeeSurveillanceRecord } from '../surveillance/employeeSurveillanceData'
import { EmployeeSurveillanceRecordDialog } from '../surveillance/EmployeeSurveillanceRecordDialog'
import { loadEmployeeSurveillanceRecords } from '../surveillance/employeeSurveillanceCloudService'
import { loadLaboratorySamples } from '../laboratory/laboratoryCloudService'
import { laboratorySamples as demoLaboratorySamples } from '../laboratory/laboratoryDemoData'
import './employeeRecordTabsRefinements.css'

function SectionTitle({title,subtitle,action}){return <div className="record-section-header"><div><span className="eyebrow">Limoxis Observer</span><h3>{title}</h3>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>}
function Empty({language,title}){return <div className="registry-empty-state employee-registry-empty"><strong>{title||(language==='en'?'No records':'Δεν υπάρχουν εγγραφές')}</strong></div>}
function State({loading,error,language,onRetry}){if(loading)return <div className="inline-empty">{language==='en'?'Loading…':'Φόρτωση…'}</div>;if(error)return <div className="data-access-state error"><span>{language==='en'?'Could not load this employee data.':'Δεν ήταν δυνατή η φόρτωση των δεδομένων του εργαζομένου.'}</span><Button variant="secondary" onClick={()=>onRetry?.().catch(()=>{})}>{language==='en'?'Retry':'Επανάληψη'}</Button></div>;return null}
function usePaged(rows){const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(15);const totalPages=Math.max(1,Math.ceil(rows.length/pageSize)),safePage=Math.min(page,totalPages),paged=rows.slice((safePage-1)*pageSize,safePage*pageSize);useEffect(()=>{if(page!==safePage)setPage(safePage)},[page,safePage]);return {page:safePage,pageSize,totalPages,paged,setPage,setPageSize}}
function Pager({paging,total,language}){if(!total)return null;return <div className="employee-registry-pagination-slot"><RegistryPagination language={language} page={paging.page} totalPages={paging.totalPages} totalItems={total} pageSize={paging.pageSize} onPageChange={paging.setPage} onPageSizeChange={size=>{paging.setPageSize(size);paging.setPage(1)}}/></div>}
function RegistryFilter({query,setQuery,language,count}){return <FilterBar query={query} onQueryChange={setQuery} placeholder={language==='en'?'Search records...':'Αναζήτηση εγγραφών...'} activeAdvancedCount={0} onClear={()=>setQuery('')} resultCount={count}/>}
function useRegistryRows(rows){const [query,setQuery]=useState('');const filtered=query.trim()?rows.filter(row=>JSON.stringify(row).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())):rows;const paging=usePaged(filtered);return {query,setQuery,filtered,paging}}
function statusClass(status){return ['complete','completed','fit','active','approved'].includes(status)?'active':['renew_soon','pending','scheduled','assigned','in_progress'].includes(status)?'temporary':['overdue','unfit','cancelled','declined'].includes(status)?'danger':''}
function label(value,t){if(!value)return '—';const translated=t?.(value);return translated&&translated!==value?translated:value}
function compactEpisodeCode(value){const code=String(value||'');if(code.startsWith('ESUR-')){const parts=code.split('-');if(parts.length>=3)return `ES-${parts[1]}-${parts.at(-1).slice(-4)}`}return code}

export function EmployeeOccupationalTab({employee,t,language,fmt,organizationId}){
  const state=useEmployeeSubRecords(loadOccupationalVisitsAsync,organizationId,employee.dbId,employee.id)
  const [selected,setSelected]=useState(null)
  const registry=useRegistryRows(state.data)
  const paging=registry.paging
  return <section className="record-section record-secondary-registry">
    <SectionTitle title={language==='en'?'Occupational Health':'Ιατρός Εργασίας'} subtitle={language==='en'?'Visits are read from the Occupational Health clinical record.':'Οι επισκέψεις αντλούνται από το κλινικό αρχείο Ιατρού Εργασίας.'}/>
    <State {...state} language={language} onRetry={state.reload}/>
    {!state.loading&&!state.error&&<RegistryFilter query={registry.query} setQuery={registry.setQuery} language={language} count={registry.filtered.length}/>}
    {!state.loading&&!state.error&&(registry.filtered.length?<><div className="scroll-table"><table className="data-table sticky-table record-table-clickable"><thead><tr><th>{language==='en'?'Visit date':'Ημερομηνία'}</th><th>{language==='en'?'Visit type':'Τύπος επίσκεψης'}</th><th>{language==='en'?'Fitness':'Καταλληλότητα'}</th><th>{language==='en'?'Follow-up':'Επανέλεγχος'}</th><th>{language==='en'?'Status':'Κατάσταση'}</th></tr></thead><tbody>{paging.paged.map(row=><tr key={row.id} tabIndex={0} onClick={()=>setSelected(row)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(row)}}}><td>{fmt(row.date)}</td><td><strong>{label(row.type,t)}</strong></td><td>{label(row.fitStatus,t)}</td><td>{fmt(row.followUpDate)}</td><td><span className={`status-badge ${statusClass(row.status)}`}>{label(row.status,t)}</span></td></tr>)}</tbody></table></div><Pager paging={paging} total={registry.filtered.length} language={language}/></>:<Empty language={language} title={language==='en'?'No occupational-health visits':'Δεν υπάρχουν επισκέψεις Ιατρού Εργασίας'}/>) }
    {selected&&<ObserverDialog width="wide" eyebrow={language==='en'?'Occupational Health':'Ιατρός Εργασίας'} title={`${fmt(selected.date)} · ${label(selected.type,t)}`} onClose={()=>setSelected(null)}><div className="detail-grid"><div className="detail-item"><span>{language==='en'?'Status':'Κατάσταση'}</span><strong>{label(selected.status,t)}</strong></div><div className="detail-item"><span>{language==='en'?'Fitness status':'Καταλληλότητα'}</span><strong>{label(selected.fitStatus,t)}</strong></div><div className="detail-item"><span>{language==='en'?'Follow-up date':'Ημερομηνία επανελέγχου'}</span><strong>{fmt(selected.followUpDate)}</strong></div></div><div className="source-truth-note"><div><strong>{language==='en'?'Notes / treatment':'Σημειώσεις / αντιμετώπιση'}</strong><span>{selected.clinicalNotes||'—'}</span></div></div></ObserverDialog>}
  </section>
}

export function EmployeeVaccinationsTab({employee,t,language,fmt,organizationId}){
  const state=useEmployeeSubRecords(loadVaccinationsAsync,organizationId,employee.dbId,employee.id)
  const [selected,setSelected]=useState(null)
  const registry=useRegistryRows(state.data)
  const paging=registry.paging
  return <section className="record-section record-secondary-registry">
    <SectionTitle title={language==='en'?'Vaccinations':'Εμβολιασμοί'} subtitle={language==='en'?'Vaccination records come from the staff vaccination register.':'Τα στοιχεία αντλούνται από το μητρώο εμβολιασμών προσωπικού.'}/>
    <State {...state} language={language} onRetry={state.reload}/>
    {!state.loading&&!state.error&&<RegistryFilter query={registry.query} setQuery={registry.setQuery} language={language} count={registry.filtered.length}/>}
    {!state.loading&&!state.error&&(registry.filtered.length?<><div className="scroll-table"><table className="data-table sticky-table record-table-clickable"><thead><tr><th>{language==='en'?'Vaccine':'Εμβόλιο'}</th><th>{language==='en'?'Dose':'Δόση'}</th><th>{language==='en'?'Date':'Ημερομηνία'}</th><th>{language==='en'?'Valid until':'Ισχύει έως'}</th><th>{language==='en'?'Status':'Κατάσταση'}</th></tr></thead><tbody>{paging.paged.map(row=><tr key={row.id} tabIndex={0} onClick={()=>setSelected(row)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(row)}}}><td><strong>{row.vaccine||'—'}</strong></td><td>{row.dose||'—'}</td><td>{fmt(row.date)}</td><td>{fmt(row.validUntil)}</td><td><span className={`status-badge ${statusClass(row.status)}`}>{label(row.status,t)}</span></td></tr>)}</tbody></table></div><Pager paging={paging} total={registry.filtered.length} language={language}/></>:<Empty language={language} title={language==='en'?'No vaccination records':'Δεν υπάρχουν εμβολιασμοί'}/>) }
    {selected&&<ObserverDialog width="wide" eyebrow={language==='en'?'Staff vaccination':'Εμβολιασμός προσωπικού'} title={selected.vaccine||'—'} subtitle={fmt(selected.date)} onClose={()=>setSelected(null)}><div className="detail-grid"><div className="detail-item"><span>{language==='en'?'Dose':'Δόση'}</span><strong>{selected.dose||'—'}</strong></div><div className="detail-item"><span>{language==='en'?'Lot number':'Αριθμός παρτίδας'}</span><strong>{selected.lotNumber||'—'}</strong></div><div className="detail-item"><span>{language==='en'?'Valid until':'Ισχύει έως'}</span><strong>{fmt(selected.validUntil)}</strong></div><div className="detail-item"><span>{language==='en'?'Status':'Κατάσταση'}</span><strong>{label(selected.status,t)}</strong></div></div>{selected.clinicalNotes&&<div className="source-truth-note"><div><strong>{language==='en'?'Notes':'Σημειώσεις'}</strong><span>{selected.clinicalNotes}</span></div></div>}</ObserverDialog>}
  </section>
}

export function EmployeeExposureIncidentsTab({employee,language,fmt,organizationId}){
  const en=language==='en'
  const state=useEmployeeSubRecords(loadExposureIncidentsAsync,organizationId,employee.dbId,employee.id)
  const [selected,setSelected]=useState(null)
  const registry=useRegistryRows(state.data)
  const paging=registry.paging
  const typeLabel=value=>({needlestick:['Τρύπημα βελόνας','Needlestick'],sharps_object:['Άλλο αιχμηρό αντικείμενο','Other sharps object'],mucocutaneous:['Έκθεση βλεννογόνου','Mucocutaneous exposure'],non_intact_skin:['Έκθεση μη ακέραιου δέρματος','Non-intact skin exposure'],other:['Άλλο','Other']}[value]?.[en?1:0]||value||'—')
  const followUpLabel=value=>({pending:['Εκκρεμεί','Pending'],scheduled:['Προγραμματισμένη','Scheduled'],completed:['Ολοκληρώθηκε','Completed'],closed:['Έκλεισε','Closed']}[value]?.[en?1:0]||value||'—')
  return <section className="record-section record-secondary-registry">
    <SectionTitle title={en?'Occupational exposure':'Επαγγελματική έκθεση'} subtitle={en?'Needlestick, sharps and mucocutaneous exposure incidents and their follow-up.':'Περιστατικά τρυπήματος βελόνας, αιχμηρών αντικειμένων και έκθεσης βλεννογόνου, με την παρακολούθησή τους.'}/>
    <State {...state} language={language} onRetry={state.reload}/>
    {!state.loading&&!state.error&&<RegistryFilter query={registry.query} setQuery={registry.setQuery} language={language} count={registry.filtered.length}/>}
    {!state.loading&&!state.error&&(registry.filtered.length?<><div className="scroll-table"><table className="data-table sticky-table record-table-clickable"><thead><tr><th>{en?'Date':'Ημερομηνία'}</th><th>{en?'Exposure type':'Τύπος έκθεσης'}</th><th>{en?'Follow-up':'Παρακολούθηση'}</th><th>{en?'Status':'Κατάσταση'}</th></tr></thead><tbody>{paging.paged.map(row=><tr key={row.id} tabIndex={0} onClick={()=>setSelected(row)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(row)}}}><td>{fmt(row.incidentDate)}</td><td><strong>{typeLabel(row.exposureType)}</strong></td><td>{followUpLabel(row.followUpStatus)}</td><td><span className={`status-badge ${row.status==='open'?'temporary':''}`}>{row.status==='open'?(en?'Open':'Ανοικτό'):(en?'Closed':'Κλειστό')}</span></td></tr>)}</tbody></table></div><Pager paging={paging} total={registry.filtered.length} language={language}/></>:<Empty language={language} title={en?'No exposure incidents recorded':'Δεν έχουν καταγραφεί περιστατικά έκθεσης'}/>) }
    {selected&&<ObserverDialog width="wide" eyebrow={en?'Occupational exposure':'Επαγγελματική έκθεση'} title={`${fmt(selected.incidentDate)} · ${typeLabel(selected.exposureType)}`} onClose={()=>setSelected(null)}><div className="detail-grid"><div className="detail-item"><span>{en?'Device / source':'Συσκευή / πηγή'}</span><strong>{selected.deviceOrSource||'—'}</strong></div><div className="detail-item"><span>{en?'Body site':'Σημείο έκθεσης'}</span><strong>{selected.bodySite||'—'}</strong></div><div className="detail-item"><span>{en?'Follow-up status':'Κατάσταση παρακολούθησης'}</span><strong>{followUpLabel(selected.followUpStatus)}</strong></div><div className="detail-item"><span>{en?'Follow-up due':'Επόμενος επανέλεγχος'}</span><strong>{fmt(selected.followUpDueAt)}</strong></div></div><div className="source-truth-note"><div><strong>{en?'Notes':'Σημειώσεις'}</strong><span>{selected.notes||'—'}</span></div></div></ObserverDialog>}
  </section>
}

export function EmployeeTrainingTab({employee,t,language,fmt,organizationId,canOpenProgram=false}){
  const {goTo}=useContextualNavigation('/training')
  const state=useEmployeeSubRecords(loadEmployeeTrainingAsync,organizationId,employee.dbId,employee.id)
  const [selected,setSelected]=useState(null)
  const registry=useRegistryRows(state.data)
  const paging=registry.paging
  return <section className="record-section record-secondary-registry">
    <SectionTitle title={language==='en'?'Training':'Εκπαίδευση'} subtitle={language==='en'?'Assignments and completion data come directly from Training programmes.':'Οι αναθέσεις και οι ολοκληρώσεις αντλούνται απευθείας από τα προγράμματα Εκπαίδευσης.'}/>
    <State {...state} language={language} onRetry={state.reload}/>
    {!state.loading&&!state.error&&<RegistryFilter query={registry.query} setQuery={registry.setQuery} language={language} count={registry.filtered.length}/>}
    {!state.loading&&!state.error&&(registry.filtered.length?<><div className="scroll-table"><table className="data-table sticky-table record-table-clickable"><thead><tr><th>{language==='en'?'Training':'Εκπαίδευση'}</th><th>{language==='en'?'Date':'Ημερομηνία'}</th><th>{language==='en'?'Status':'Κατάσταση'}</th><th>{language==='en'?'Score':'Βαθμολογία'}</th></tr></thead><tbody>{paging.paged.map(row=><tr key={row.id} tabIndex={0} onClick={()=>setSelected(row)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(row)}}}><td><strong>{language==='el'?(row.titleEl||row.titleEn):(row.titleEn||row.titleEl)}</strong></td><td>{fmt(row.date)}</td><td><span className={`status-badge ${statusClass(row.status)}`}>{label(row.status,t)}</span></td><td>{row.score!=null?`${row.score}%`:'—'}</td></tr>)}</tbody></table></div><Pager paging={paging} total={registry.filtered.length} language={language}/></>:<Empty language={language} title={language==='en'?'No training records':'Δεν υπάρχουν εκπαιδεύσεις'}/>) }
    {selected&&<ObserverDialog width="wide" eyebrow={language==='en'?'Employee training':'Εκπαίδευση εργαζομένου'} title={language==='el'?(selected.titleEl||selected.titleEn):(selected.titleEn||selected.titleEl)} subtitle={fmt(selected.date)} onClose={()=>setSelected(null)} footer={canOpenProgram&&selected.programId?<Button onClick={()=>goTo(`/training/${selected.programId}`,{tab:'training',returnTo:`/employees/${encodeURIComponent(employee.id)}`,returnTab:'training'})}>{language==='en'?'Open training programme':'Άνοιγμα εκπαίδευσης'}</Button>:undefined}><div className="detail-grid"><div className="detail-item"><span>{language==='en'?'Status':'Κατάσταση'}</span><strong>{label(selected.status,t)}</strong></div><div className="detail-item"><span>{language==='en'?'Assigned':'Ανάθεση'}</span><strong>{fmt(selected.assignedDate)}</strong></div><div className="detail-item"><span>{language==='en'?'Completed':'Ολοκλήρωση'}</span><strong>{fmt(selected.completedDate)}</strong></div><div className="detail-item"><span>{language==='en'?'Score':'Βαθμολογία'}</span><strong>{selected.score!=null?`${selected.score}%`:'—'}</strong></div></div></ObserverDialog>}
  </section>
}

export function EmployeeEvaluationsTab({employee,t,language,fmt,organizationId,canCreate=false,canHrApprove=false,canAdminApprove=false,selfReadOnly=false}){
  const state=useEmployeeSubRecords(loadEvaluationsAsync,organizationId,employee.dbId,employee.id)
  const [selected,setSelected]=useState(null),[creating,setCreating]=useState(false),[saving,setSaving]=useState(false)
  const registry=useRegistryRows(state.data),paging=registry.paging,en=language==='en'
  const criteriaLabels=en?['Professional competence','Quality & accuracy','Procedures & protocols','Patient safety & infection prevention','Teamwork','Communication','Responsibility & consistency','Professional development']:['Επαγγελματική επάρκεια','Ποιότητα & ακρίβεια εργασίας','Τήρηση διαδικασιών / πρωτοκόλλων','Ασφάλεια ασθενών & πρόληψη λοιμώξεων','Συνεργασία / ομαδικότητα','Επικοινωνία','Υπευθυνότητα / συνέπεια','Επαγγελματική ανάπτυξη']
  const [draft,setDraft]=useState({period:'',date:new Date().toISOString().slice(0,10),notes:'',criteria:criteriaLabels.map((name,index)=>({id:String(index+1),name,score:3,weight:1}))})
  const statusLabel=v=>({draft:en?'Draft':'Πρόχειρη',submitted:en?'Submitted':'Υποβλήθηκε',employee_acknowledged:en?'Employee acknowledged':'Έλαβε γνώση',hr_approved:en?'HR approved':'Εγκρίθηκε από HR',finalized:en?'Finalized':'Οριστικοποιημένη'}[v]||v||'—')
  async function create(){setSaving(true);try{await createEmployeeEvaluationAsync(organizationId,employee.dbId,draft);setCreating(false);await state.reload()}finally{setSaving(false)}}
  async function action(name,comment){setSaving(true);try{const updated=await updateEmployeeEvaluationWorkflowAsync(organizationId,employee.dbId,selected.id,{action:name,comment});setSelected(updated);await state.reload()}finally{setSaving(false)}}
  return <section className="record-section record-secondary-registry">
    <SectionTitle title={en?'Evaluations':'Αξιολογήσεις'} subtitle={en?'Performance evaluations and training knowledge assessments.':'Αξιολογήσεις απόδοσης και αξιολογήσεις γνώσεων από την Εκπαίδευση.'} action={canCreate&&<ActionButton tone="primary" label={en?'New evaluation':'Νέα αξιολόγηση'} onClick={()=>setCreating(true)}><Plus size={16}/><span>{en?'New evaluation':'Νέα αξιολόγηση'}</span></ActionButton>}/>
    <State {...state} language={language} onRetry={state.reload}/>
    {!state.loading&&!state.error&&<RegistryFilter query={registry.query} setQuery={registry.setQuery} language={language} count={registry.filtered.length}/>}
    {!state.loading&&!state.error&&(registry.filtered.length?<><div className="scroll-table"><table className="data-table sticky-table record-table-clickable"><thead><tr><th>{en?'Evaluation':'Αξιολόγηση'}</th><th>{en?'Period':'Περίοδος'}</th><th>{en?'Date':'Ημερομηνία'}</th><th>{en?'Score':'Βαθμολογία'}</th><th>{en?'Status':'Κατάσταση'}</th></tr></thead><tbody>{paging.paged.map(row=><tr key={row.id} tabIndex={0} onClick={()=>setSelected(row)}><td><strong>{en?row.titleEn:row.titleEl}</strong></td><td>{row.period||'—'}</td><td>{fmt(row.date)}</td><td>{row.overallScore!=null?`${row.overallScore.toFixed(2)} / 5`:(en?row.resultEn:row.resultEl)||'—'}</td><td><span className={`status-badge ${statusClass(row.status)}`}>{statusLabel(row.status)}</span></td></tr>)}</tbody></table></div><Pager paging={paging} total={registry.filtered.length} language={language}/></>:<Empty language={language}/>)}
    {creating&&<ObserverDialog width="wide" eyebrow={en?'Performance evaluation':'Αξιολόγηση απόδοσης'} title={en?'New employee evaluation':'Νέα αξιολόγηση εργαζομένου'} onClose={()=>setCreating(false)} footer={<DialogActions onCancel={()=>setCreating(false)} onSave={create} disabled={saving||!draft.period}/>}>
      <div className="entry-grid"><label><span>{en?'Evaluation period':'Περίοδος αξιολόγησης'} *</span><input value={draft.period} onChange={e=>setDraft(v=>({...v,period:e.target.value}))} placeholder="2026"/></label><ManualDateField label={en?'Evaluation date':'Ημερομηνία αξιολόγησης'} value={draft.date} onChange={value=>setDraft(v=>({...v,date:value}))}/></div>
      <div className="evaluation-scale-note">{en?'Scale: 1 Unsatisfactory · 2 Needs improvement · 3 Meets requirements · 4 Exceeds requirements · 5 Outstanding':'Κλίμακα: 1 Ανεπαρκής · 2 Χρειάζεται βελτίωση · 3 Πλήρως επαρκής · 4 Υπερβαίνει τις απαιτήσεις · 5 Εξαιρετική επίδοση'}</div>
      <div className="evaluation-criteria">{draft.criteria.map((item,index)=><div className="evaluation-criterion" key={item.id}><strong>{item.name}</strong><select value={item.score} onChange={e=>setDraft(v=>({...v,criteria:v.criteria.map((x,i)=>i===index?{...x,score:Number(e.target.value)}:x)}))}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></div>)}</div>
      <label className="entry-field"><span>{en?'Manager comments':'Σχόλια προϊσταμένου'}</span><textarea value={draft.notes} onChange={e=>setDraft(v=>({...v,notes:e.target.value}))}/></label>
    </ObserverDialog>}
    {selected&&<ObserverDialog width="wide" eyebrow={en?'Employee evaluation':'Αξιολόγηση εργαζομένου'} title={en?selected.titleEn:selected.titleEl} subtitle={`${selected.period||''} · ${fmt(selected.date)}`} onClose={()=>setSelected(null)}>
      {selected.overallScore!=null&&<div className="evaluation-score-hero"><strong>{selected.overallScore.toFixed(2)} / 5</strong><span>{statusLabel(selected.status)}</span></div>}
      <div className="evaluation-criteria">{(selected.criteria||[]).map(item=><div className="evaluation-criterion" key={item.id||item.name}><strong>{item.name}</strong><span className="status-badge">{item.score} / 5</span></div>)}</div>
      {selected.notes&&<div className="source-truth-note"><div><strong>{en?'Manager comments':'Σχόλια προϊσταμένου'}</strong><span>{selected.notes}</span></div></div>}
      {selected.employeeComment&&<div className="source-truth-note"><div><strong>{en?'Employee comment':'Σχόλιο εργαζομένου'}</strong><span>{selected.employeeComment}</span></div></div>}
      <div className="dialog-actions">{selected.source==='employee_evaluations'&&selected.status==='draft'&&canCreate&&<Button onClick={()=>action('submit')} disabled={saving}>{en?'Submit to employee':'Υποβολή στον εργαζόμενο'}</Button>}{selected.status==='submitted'&&selfReadOnly&&<Button onClick={()=>action('acknowledge','')} disabled={saving}>{en?'Acknowledge receipt':'Έλαβα γνώση'}</Button>}{selected.status==='employee_acknowledged'&&canHrApprove&&<Button onClick={()=>action('hrApprove')} disabled={saving}>{en?'HR approval':'Έγκριση HR'}</Button>}{selected.status==='hr_approved'&&canAdminApprove&&<Button onClick={()=>action('finalize')} disabled={saving}>{en?'Final approval':'Τελική έγκριση'}</Button>}</div>
    </ObserverDialog>}
  </section>
}

