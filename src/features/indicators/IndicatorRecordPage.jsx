import { useEffect,useState } from 'react'
import { Gauge,Pencil,Trash2 } from 'lucide-react'
import { useNavigate,useParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { RouteLoading } from '../../design-system/RouteLoading'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { CAPABILITIES,can } from '../../core/permissions/roles'
import { IndicatorDefinitionForm,indicatorDefinitionIsValid } from './IndicatorDefinitionForm'
import { deleteIndicatorDefinition,loadIndicatorDefinition,saveIndicatorDefinition } from './indicatorDefinitionService'

const statusLabel=(status,el)=>({draft:el?'Πρόχειρο':'Draft',review:el?'Σε έλεγχο':'In review',active:el?'Ενεργό':'Active',retired:el?'Αποσυρμένο':'Retired'}[status]||status)

export function IndicatorRecordPage(){
 const {indicatorId}=useParams(),navigate=useNavigate(),{language}=useLanguage(),el=language==='el', {tenant,role,membership}=useTenant(),{notify,confirm}=useFeedback()
 const [record,setRecord]=useState(null),[draft,setDraft]=useState(null),[loading,setLoading]=useState(true),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const addOns=membership?.capabilities||[],custom=membership?.customCapabilities||[],canManage=can(role,CAPABILITIES.MANAGE_INDICATORS,addOns,custom)
 useEffect(()=>{let active=true;if(!tenant?.id||!indicatorId)return;setLoading(true);loadIndicatorDefinition(tenant.id,indicatorId).then(row=>{if(!active)return;setRecord(row);setDraft(row);setError('')}).catch(err=>{if(active)setError(err?.message||'load_failed')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[tenant?.id,indicatorId])
 if(loading)return <RouteLoading/>
 if(error)return <Page title={el?'Δείκτες':'Indicators'}><div className="data-access-state error" role="alert">{el?'Δεν ήταν δυνατή η φόρτωση του δείκτη.':'Could not load the indicator.'}</div></Page>
 if(!record)return <Page title={el?'Δείκτες':'Indicators'}><div className="inline-empty">{el?'Ο δείκτης δεν βρέθηκε.':'Indicator not found.'}</div></Page>
 const valid=indicatorDefinitionIsValid(draft)
 async function save(){if(!canManage||!editing||!valid||busy)return;setBusy(true);try{const saved=await saveIndicatorDefinition(tenant.id,draft);setRecord(saved);setDraft(saved);setEditing(false);notify(el?'Ο δείκτης ενημερώθηκε.':'Indicator updated.','success')}catch(err){notify(err?.message||(el?'Δεν ήταν δυνατή η αποθήκευση.':'Could not save indicator.'),'danger')}finally{setBusy(false)}}
 async function remove(){if(!canManage||record.system||busy)return;const ok=await confirm({title:el?'Διαγραφή δείκτη':'Delete indicator',message:el?'Ο δείκτης θα διαγραφεί οριστικά. Τα ήδη αποθηκευμένα αποτελέσματα θα παραμείνουν στο ιστορικό χωρίς σύνδεση με τον ορισμό. Θέλετε να συνεχίσετε;':'The indicator definition will be permanently deleted. Existing saved results will remain in history without the definition link. Continue?',confirmLabel:el?'Διαγραφή':'Delete',danger:true});if(!ok)return;setBusy(true);try{await deleteIndicatorDefinition(tenant.id,record);notify(el?'Ο δείκτης διαγράφηκε.':'Indicator deleted.','success');navigate('/indicators',{replace:true})}catch(err){notify(err?.message||(el?'Δεν ήταν δυνατή η διαγραφή.':'Could not delete indicator.'),'danger');setBusy(false)}}
 function cancel(){setDraft(record);setEditing(false)}
 return <Page fill><EntityRecordShell className="indicator-record-shell workspace-fill" avatar={<Gauge size={19}/>} eyebrow={el?'ΔΕΙΚΤΗΣ':'INDICATOR'} title={el?record.titleEl:(record.titleEl||record.key)} subtitle={`${record.key} · ${el?'Έκδοση':'Version'} ${record.version}`} status={<span className={`status-badge ${record.status==='active'?'active':record.status==='draft'?'temporary':''}`}>{statusLabel(record.status,el)}</span>} onBack={()=>navigate('/indicators')} headerActions={canManage&&!editing?<><button type="button" className="lo-icon-button lo-icon-button-edit lo-icon-button-sm" onClick={()=>setEditing(true)} title={el?'Επεξεργασία':'Edit'} aria-label={el?'Επεξεργασία':'Edit'}><Pencil size={16}/></button>{!record.system&&<button type="button" className="lo-icon-button lo-icon-button-danger lo-icon-button-sm" onClick={remove} disabled={busy} title={el?'Διαγραφή':'Delete'} aria-label={el?'Διαγραφή':'Delete'}><Trash2 size={16}/></button>}</>:null} tabs={[]} activeTab="" onTabChange={()=>{}}>
  <section className="record-section indicator-record-form">
   <IndicatorDefinitionForm value={draft} onChange={setDraft} language={language} readOnly={!editing} lockKey={Boolean(record.system)}/>
   {editing&&<div className="inline-edit-footer"><Button variant="secondary" onClick={cancel} disabled={busy}>{el?'Ακύρωση':'Cancel'}</Button><SaveButton loading={busy} disabled={!valid||busy} onClick={save}>{el?'Αποθήκευση':'Save'}</SaveButton></div>}
  </section>
 </EntityRecordShell></Page>
}
