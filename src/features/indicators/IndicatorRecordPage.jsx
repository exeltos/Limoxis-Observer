import { useEffect,useState } from 'react'
import { Gauge,Pencil,Trash2 } from 'lucide-react'
import { useNavigate,useParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { PrintExportActions } from '../../design-system/PrintExportActions'
import { downloadRecordJson } from '../../core/export/recordExport'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { RouteLoading } from '../../design-system/RouteLoading'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { CAPABILITIES,can } from '../../core/permissions/roles'
import { loadDepartments } from '../management/departmentsService'
import { demoLibrarySeed } from '../management/managementData'
import { IndicatorDefinitionForm,indicatorDefinitionIsValid } from './IndicatorDefinitionForm'
import { deleteIndicatorDefinition,loadIndicatorDefinition,saveIndicatorDefinition } from './indicatorDefinitionService'
import { loadCommitteeObjectivesForIndicator } from './indicatorCommitteeService'

const statusLabel=(status,el)=>({draft:el?'Πρόχειρο':'Draft',review:el?'Σε έλεγχο':'In review',active:el?'Ενεργό':'Active',retired:el?'Αποσυρμένο':'Retired'}[status]||status)
const workflowStatusLabel=(status,el)=>({open:el?'Ανοιχτός':'Open',in_progress:el?'Σε εξέλιξη':'In progress',completed:el?'Ολοκληρωμένος':'Completed',cancelled:el?'Ακυρωμένος':'Cancelled'}[status]||status||'—')
const fmtDate=value=>value?new Date(`${String(value).slice(0,10)}T12:00:00`).toLocaleDateString('el-GR'):'—'

export function IndicatorRecordPage(){
 const {indicatorId}=useParams(),navigate=useNavigate(),{language}=useLanguage(),el=language==='el',{tenant,isDemo,role,membership}=useTenant(),{notify,confirm}=useFeedback()
 const [record,setRecord]=useState(null),[draft,setDraft]=useState(null),[loading,setLoading]=useState(true),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[committeeObjectives,setCommitteeObjectives]=useState([]),[departments,setDepartments]=useState([])
 const addOns=membership?.capabilities||[],custom=membership?.customCapabilities||[],canManage=can(role,CAPABILITIES.MANAGE_INDICATORS,addOns,custom)
 const recordNavigation=useRecordSequenceNavigation({registry:'indicators',currentId:indicatorId,pathForId:id=>`/indicators/${id}`})
 useEffect(()=>{let active=true;if(!tenant?.id||!indicatorId)return;setLoading(true);loadIndicatorDefinition(tenant.id,indicatorId).then(row=>{if(!active)return;setRecord(row);setDraft(row);setError('')}).catch(err=>{if(active)setError(err?.message||'load_failed')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[tenant?.id,indicatorId])
 useEffect(()=>{let active=true;if(!tenant?.id||!record){setCommitteeObjectives([]);return()=>{active=false}};loadCommitteeObjectivesForIndicator(tenant.id,record).then(rows=>{if(active)setCommitteeObjectives(rows||[])}).catch(()=>{if(active)setCommitteeObjectives([])});return()=>{active=false}},[tenant?.id,record])
 // loadDepartments is a plain cloud call with no demo awareness — calling it
 // with tenant.id='demo-hospital' (not a real UUID) fails with a Postgres 400.
 useEffect(()=>{let active=true;if(isDemo){setDepartments(demoLibrarySeed.departments.map(([elName,enName])=>({id:elName,name:elName,nameEn:enName})));return()=>{active=false}}if(!tenant?.id)return;loadDepartments(tenant.id).then(rows=>{if(active)setDepartments((rows||[]).filter(x=>x.is_active!==false))}).catch(()=>{if(active)setDepartments([])});return()=>{active=false}},[isDemo,tenant?.id])
 if(loading)return <RouteLoading/>
 if(error)return <Page title={el?'Δείκτες':'Indicators'}><div className="data-access-state error" role="alert">{el?'Δεν ήταν δυνατή η φόρτωση του δείκτη.':'Could not load the indicator.'}</div></Page>
 if(!record)return <Page title={el?'Δείκτες':'Indicators'}><div className="inline-empty">{el?'Ο δείκτης δεν βρέθηκε.':'Indicator not found.'}</div></Page>
 const valid=indicatorDefinitionIsValid(draft)
 async function save(){if(!canManage||!editing||!valid||busy)return;setBusy(true);try{const saved=await saveIndicatorDefinition(tenant.id,draft);setRecord(saved);setDraft(saved);setEditing(false);notify(el?'Ο δείκτης ενημερώθηκε.':'Indicator updated.','success')}catch(err){notify(err?.message||(el?'Δεν ήταν δυνατή η αποθήκευση.':'Could not save indicator.'),'danger')}finally{setBusy(false)}}
 async function remove(){if(!canManage||record.system||busy)return;const ok=await confirm({title:el?'Διαγραφή δείκτη':'Delete indicator',message:el?'Ο δείκτης θα διαγραφεί οριστικά. Τα ήδη αποθηκευμένα αποτελέσματα θα παραμείνουν στο ιστορικό χωρίς σύνδεση με τον ορισμό. Θέλετε να συνεχίσετε;':'The indicator definition will be permanently deleted. Existing saved results will remain in history without the definition link. Continue?',confirmLabel:el?'Διαγραφή':'Delete',danger:true});if(!ok)return;setBusy(true);try{await deleteIndicatorDefinition(tenant.id,record);notify(el?'Ο δείκτης διαγράφηκε.':'Indicator deleted.','success');navigate('/indicators',{replace:true})}catch(err){notify(err?.message||(el?'Δεν ήταν δυνατή η διαγραφή.':'Could not delete indicator.'),'danger');setBusy(false)}}
 function cancel(){setDraft(record);setEditing(false)}
 return <Page fill><EntityRecordShell className="indicator-record-shell workspace-fill" avatar={<Gauge size={19}/>} eyebrow={el?'ΔΕΙΚΤΗΣ':'INDICATOR'} title={el?record.titleEl:(record.titleEn||record.titleEl||record.key)} subtitle={`${record.key} · ${el?'Έκδοση':'Version'} ${record.version}`} status={<span className={`status-badge ${record.status==='active'?'active':record.status==='draft'?'temporary':''}`}>{statusLabel(record.status,el)}</span>} recordNavigation={recordNavigation} onBack={()=>navigate('/indicators')} headerActions={<>{canManage&&!editing&&<><button type="button" className="lo-icon-button lo-icon-button-edit lo-icon-button-sm" onClick={()=>setEditing(true)} title={el?'Επεξεργασία':'Edit'} aria-label={el?'Επεξεργασία':'Edit'}><Pencil size={16}/></button>{!record.system&&<button type="button" className="lo-icon-button lo-icon-button-danger lo-icon-button-sm" onClick={remove} disabled={busy} title={el?'Διαγραφή':'Delete'} aria-label={el?'Διαγραφή':'Delete'}><Trash2 size={16}/></button>}</>}<PrintExportActions onExport={()=>downloadRecordJson(record,{filename:record?.key})}/></>} tabs={[]} activeTab="" onTabChange={()=>{}}>
  <div className="workspace-column workspace-fill">
   <section className="record-section indicator-record-form">
    <IndicatorDefinitionForm value={draft} onChange={setDraft} language={language} readOnly={!editing} lockKey={Boolean(record.system)} departments={departments}/>
    {editing&&<div className="inline-edit-footer"><Button variant="secondary" onClick={cancel} disabled={busy}>{el?'Ακύρωση':'Cancel'}</Button><SaveButton loading={busy} disabled={!valid||busy} onClick={save}>{el?'Αποθήκευση':'Save'}</SaveButton></div>}
   </section>
   <section className="record-section indicator-committee-objectives">
    <div className="record-section-header"><div><span className="eyebrow">{el?'ΔΙΑΚΥΒΕΡΝΗΣΗ':'GOVERNANCE'}</span><h3>{el?'Στόχοι επιτροπών που χρησιμοποιούν τον δείκτη':'Committee objectives using this indicator'}</h3><p>{el?'Η σύνδεση προέρχεται από το ετήσιο σχέδιο δράσης των επιτροπών.':'Links come from committee annual action plans.'}</p></div></div>
    {committeeObjectives.length?<div className="scroll-table"><table className="data-table"><thead><tr><th>{el?'Επιτροπή':'Committee'}</th><th>{el?'Στόχος':'Objective'}</th><th>{el?'Baseline → στόχος':'Baseline → target'}</th><th>{el?'Υπεύθυνος':'Owner'}</th><th>{el?'Προθεσμία':'Due'}</th><th>{el?'Κατάσταση':'Status'}</th></tr></thead><tbody>{committeeObjectives.map(item=><tr key={item.id} className={item.committee?.code?'clickable-row':''} onClick={()=>item.committee?.code&&navigate(`/committees/${item.committee.code}`)}><td><strong>{item.committee?.name||'—'}</strong></td><td>{item.title||'—'}</td><td>{item.baseline||'—'} → {item.target||'—'}</td><td>{item.owner_label||'—'}</td><td>{fmtDate(item.due_date)}</td><td><span className={`status-badge ${item.status==='completed'?'active':item.status==='in_progress'?'temporary':''}`}>{workflowStatusLabel(item.status,el)}</span></td></tr>)}</tbody></table></div>:<div className="inline-empty">{el?'Δεν υπάρχουν στόχοι επιτροπών συνδεδεμένοι με αυτόν τον δείκτη.':'No committee objectives are linked to this indicator.'}</div>}
   </section>
  </div>
 </EntityRecordShell></Page>
}
