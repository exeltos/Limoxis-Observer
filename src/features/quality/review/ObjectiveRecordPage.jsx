import { useEffect,useMemo,useState } from 'react'
import { useNavigate,useParams } from 'react-router-dom'
import { ClipboardList,Pencil,Target } from 'lucide-react'
import { Page } from '../../../design-system/Page'
import { EntityRecordShell } from '../../../design-system/EntityRecordShell'
import { DetailList } from '../../../design-system/DetailList'
import { ExportMenu } from '../../../design-system/ExportMenu'
import { IconButton } from '../../../design-system/IconButton'
import { Meter } from '../../../design-system/MiniCharts'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { RouteLoading } from '../../../design-system/RouteLoading'
import { printReport } from '../../../core/export/reportDocument'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { formatDay } from '../../../core/i18n/formatDay'
import { roleTitleText } from '../../../core/i18n/roleTitles'
import { CAPABILITIES,can } from '../../../core/permissions/roles'
import { monthlySeries,textOf } from '../../registers/registerEngine'
import { loadEntries } from '../../registers/registerService'
import { formatObjectiveValue,objectiveState } from './reviewTemplate'
import { objectiveStateLabel,objectiveTitle,targetReach,useObjectives } from './QualityObjectives'
import { rememberQualitySection } from '../qualityReturnSection'
import '../quality.css'

const tone=state=>({met:'success',missed:'danger'})[state]||'info'

// /quality/objectives/:objectiveId — one objective on its own page: where it stands today, what it is measured by, who owns it and by when.
export function ObjectiveRecordPage(){
 const {objectiveId}=useParams(),navigate=useNavigate(),{language}=useLanguage(),en=language==='en',{tenant,role,membership}=useTenant(),{notify}=useFeedback()
 const {objectives,loading}=useObjectives(tenant?.id)
 const canManage=can(role,CAPABILITIES.MANAGE_QUALITY,membership?.capabilities||[],membership?.customCapabilities||[])
 const back=()=>{rememberQualitySection('indicators:objectives');navigate('/quality',{replace:true})}
 const target_=objectives.find(item=>item.id===objectiveId)
 const [entries,setEntries]=useState([])
 useEffect(()=>{
  const register=target_?.register
  if(!tenant?.id||!register||!target_?.indicator){setEntries([]);return undefined}
  let live=true
  loadEntries(tenant.id,register.id,{register}).then(rows=>{if(live)setEntries(rows)}).catch(()=>{if(live)setEntries([])})
  return ()=>{live=false}
 },[tenant?.id,target_?.register,target_?.indicator])
 // The value month by month for the objective's year, up to the current month, only the months with a value.
 const history=useMemo(()=>{
  if(!target_?.register||!target_?.indicator)return []
  const now=new Date(),last=target_.year<now.getFullYear()?12:target_.year>now.getFullYear()?0:now.getMonth()+1
  return monthlySeries(target_.register,target_.indicator,entries,target_.year).filter(row=>row.month<=last&&row.value!=null)
 },[target_,entries])
 if(loading)return <RouteLoading/>
 const objective=objectives.find(item=>item.id===objectiveId)
 if(!objective)return <Page title={en?'Quality objective':'Στόχος ποιότητας'}><div className="inline-empty">{en?'The objective was not found.':'Ο στόχος δεν βρέθηκε.'}</div></Page>
 const {current,register,indicator,unit}=objective
 const state=current.status,reach=targetReach(objective),sign=objective.direction==='lower'?'≤':'≥'
 const value=formatObjectiveValue(current.value,unit,language),target=`${sign} ${formatObjectiveValue(objective.target,unit,language)}`
 const detail=[
  {title:en?'Measurement':'Μέτρηση',items:[
   {label:en?'Measured by':'Μετριέται με',value:indicator?textOf(indicator,language):(en?'Value reported by the owner':'Τιμή από τον υπεύθυνο')},
   {label:en?'Register':'Μητρώο',value:register?(en?register.nameEn||register.name:register.name):null},
   {label:en?'Met when the value is':'Επιτυγχάνεται όταν η τιμή είναι',value:objective.direction==='lower'?(en?'At most':'Το πολύ'):(en?'At least':'Τουλάχιστον')},
   {label:en?'Year':'Έτος',value:objective.year},
  ]},
  {title:en?'Responsibility':'Ευθύνη',items:[
   {label:en?'Owner':'Υπεύθυνος',value:roleTitleText(objective.ownerLabel,language)},
   {label:en?'Due':'Προθεσμία',value:formatDay(objective.dueDate,language)},
  ]},
 ]
 // The objective as a printed sheet.
 const printObjective=pdf=>{
  const ok=printReport({language,kind:en?'Quality objective':'Στόχος ποιότητας',code:objective.code,title:objectiveTitle(objective,language),subtitle:String(objective.year),
   meta:[[en?'Value today':'Τιμή σήμερα',value],[en?'Target':'Στόχος',target],[en?'Status':'Κατάσταση',objectiveStateLabel(state,en)],...detail.flatMap(section=>section.items.filter(item=>item.value!=null&&item.value!=='').map(item=>[item.label,String(item.value)]))],
   filename:`${objective.code}_${objective.year}`},{pdf:pdf===true})
  if(!ok)notify(en?'Allow pop-ups to print.':'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','error')
 }
 return <Page fill><EntityRecordShell className="quality-record-shell objective-record-shell workspace-fill" avatar={<Target size={19}/>} eyebrow={objective.code} title={objectiveTitle(objective,language)} subtitle={`${objective.year} · ${en?'ISO 9001 §6.2':'ISO 9001 §6.2'}`} status={<StatusBadge tone={tone(state)}>{objectiveStateLabel(state,en)}</StatusBadge>} onBack={back}
  headerActions={<><ExportMenu onPrint={()=>printObjective(false)} onPdf={()=>printObjective(true)}/>{register&&<IconButton size="sm" label={en?'Open the register':'Άνοιγμα μητρώου'} onClick={()=>navigate(`/registers/${register.id}`)}><ClipboardList size={16}/></IconButton>}{canManage&&<IconButton size="sm" tone="edit" label={en?'Edit':'Επεξεργασία'} onClick={()=>navigate(`/quality/objectives/${objective.id}/edit`)}><Pencil size={16}/></IconButton>}</>}>
  <section className="record-section">
   <p className="quality-summary-line"><span><b>{value}</b> {en?'today':'σήμερα'}</span><span>{en?'target':'στόχος'} <b>{target}</b></span><span className={state==='missed'?'is-late':undefined}><b>{reach==null?'—':`${Math.round(reach)}%`}</b> {en?'of the target':'του στόχου'}</span><span>{objectiveStateLabel(state,en).toLowerCase()}</span></p>
   <Meter className="objective-record-meter" value={reach} tone={tone(state)} label={`${objectiveTitle(objective,language)}: ${value}`}/>
   <DetailList sections={detail}/>
   {history.length>0&&<>
    <h3 className="objective-history-title">{en?'Value by month':'Ιστορικό τιμών'}</h3>
    <table className="objective-history"><thead><tr><th>{en?'Month':'Μήνας'}</th><th>{en?'Value':'Τιμή'}</th><th>{en?'Status':'Κατάσταση'}</th></tr></thead>
     <tbody>{history.map(row=><tr key={row.month}><td>{new Intl.DateTimeFormat(en?'en-GB':'el-GR',{month:'long',year:'numeric'}).format(new Date(objective.year,row.month-1,1))}</td><td>{formatObjectiveValue(row.value,unit,language)}</td><td><StatusBadge tone={tone(objectiveState(objective,row.value))}>{objectiveStateLabel(objectiveState(objective,row.value),en)}</StatusBadge></td></tr>)}</tbody></table>
   </>}
  </section>
 </EntityRecordShell>
 </Page>
}
