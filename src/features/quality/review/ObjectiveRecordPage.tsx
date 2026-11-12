import { useEffect,useState } from 'react'
import { useNavigate,useParams } from 'react-router-dom'
import { ClipboardList,Gauge,Pencil,Target } from 'lucide-react'
import { Page } from '../../../design-system/Page'
import { EntityRecordShell } from '../../../design-system/EntityRecordShell'
import { DetailList } from '../../../design-system/DetailList'
import { ExportMenu } from '../../../design-system/ExportMenu'
import { IconButton } from '../../../design-system/IconButton'
import { Button } from '../../../design-system/Button'
import { Meter,Sparkline } from '../../../design-system/MiniCharts'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { AutoTranslatedMark } from '../../../design-system/AutoTranslatedMark'
import { useAutoTranslated } from '../../../core/i18n/autoTranslated'
import { RouteLoading } from '../../../design-system/RouteLoading'
import { printReport, type ReportFact } from '../../../core/export/reportDocument'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { formatDay } from '../../../core/i18n/formatDay'
import { roleTitleText } from '../../../core/i18n/roleTitles'
import { CAPABILITIES,can } from '../../../core/permissions/roles'
import { loadObjectiveHistories,objectiveSection } from './objectiveDossier'
import { saveObjectiveValue } from './reviewService'
import { monthStart,monthsSoFar,objectiveSource } from './objectiveSources'
import { formatObjectiveValue,objectiveState } from './reviewTemplate'
import { objectiveLevelText,objectiveMeasureSource,objectiveMeasureText,objectiveStateLabel,objectiveTitle,targetReach,useObjectives } from './QualityObjectives'
import { rememberQualitySection } from '../qualityReturnSection'
import '../quality.css'
import { LinkedActions } from '../LinkedActions'
import type { AnyRecord } from '../../../types/featureTypes'

const tone=(state: string)=>({met:'success',missed:'danger'} as Record<string, string>)[state]||'info'

// /quality/objectives/:objectiveId — one objective on its own page: where it stands today, what it is measured by, who owns it and by when.
export function ObjectiveRecordPage(){
 const {objectiveId}=useParams(),navigate=useNavigate(),{language}=useLanguage(),en=language==='en',{tenant,role,membership,isDemo}=useTenant(),{notify}=useFeedback()
 const {objectives,definitions,loading,reload}=useObjectives(tenant?.id)
 const canManage=can(role,CAPABILITIES.MANAGE_QUALITY,membership?.capabilities||[],membership?.customCapabilities||[])
 const back=()=>{rememberQualitySection('indicators:objectives');navigate('/quality',{replace:true})}
 const target_=objectives.find(item=>item.id===objectiveId||item.code===objectiveId)
 // Opened by its code (from a corrective action): continue at its own address.
 useEffect(()=>{if(target_&&target_.id!==objectiveId)navigate(`/quality/objectives/${target_.id}`,{replace:true})},[target_,objectiveId,navigate])
 // The value month by month for the objective's year, up to the current month, only the months with a value:
 // from the register, from the platform's indicator or the values entered by the owner.
 const [history,setHistory]=useState<AnyRecord[]>([])
 useEffect(()=>{
  if(!tenant?.id||!target_){setHistory([]);return undefined}
  let live=true
  loadObjectiveHistories(tenant.id,[target_],definitions).then(map=>{if(live)setHistory(map.get(target_.id)||[])}).catch(()=>{if(live)setHistory([])})
  return ()=>{live=false}
 },[tenant?.id,target_,definitions])
 const [drafts,setDrafts]=useState<Record<number, string>>({})
 async function saveMonth(month: number){
  if(!target_)return
  const key=monthStart(target_.year,month),value=drafts[month]
  if(value===undefined)return
  try{await saveObjectiveValue(tenant?.id,target_.id,key,value);setDrafts(current=>{const next={...current};delete next[month];return next});await reload();notify(en?'The value was saved.':'Η τιμή αποθηκεύτηκε.','success')}
  catch(error){console.error(error);notify(en?'The value could not be saved.':'Δεν ήταν δυνατή η αποθήκευση.','error')}
 }
 const auto=useAutoTranslated('quality_objectives',[objectiveId],{enabled:en&&!isDemo})
 if(loading)return <RouteLoading/>
 const objective=objectives.find(item=>item.id===objectiveId||item.code===objectiveId)
 if(!objective)return <Page title={en?'Quality objective':'Στόχος ποιότητας'}><div className="inline-empty">{en?'The objective was not found.':'Ο στόχος δεν βρέθηκε.'}</div></Page>
 const {current,register,unit}=objective
 const monthly=objectiveSource(objective)==='monthly'
 const state=current.status,reach=targetReach(objective),sign=objective.direction==='lower'?'≤':'≥'
 const monthChange=history.length>1?Number(((history.at(-1) as AnyRecord).value-(history.at(-2) as AnyRecord).value).toFixed(2)):null
 const value=formatObjectiveValue(current.value,unit,language),target=`${sign} ${formatObjectiveValue(objective.target,unit,language)}${objective.targetFromIndicator?(en?' (indicator)':' (από τον δείκτη)'):''}`
 const detail=[
  {title:en?'Measurement':'Μέτρηση',items:[
   {label:en?'Level':'Επίπεδο',value:objectiveLevelText(objective,language)},
   {label:en?'Measured by':'Μετριέται με',value:objectiveMeasureText(objective,language)},
   {label:en?'Source':'Πηγή',value:objectiveMeasureSource(objective,language)},
   {label:en?'Met when the value is':'Επιτυγχάνεται όταν η τιμή είναι',value:objective.direction==='lower'?(en?'At most':'Το πολύ'):(en?'At least':'Τουλάχιστον')},
   {label:en?'Year':'Έτος',value:objective.year},
  ]},
  {title:en?'Responsibility':'Ευθύνη',items:[
   {label:en?'Owner':'Υπεύθυνος',value:roleTitleText(objective.ownerLabel,language)},
   {label:en?'Due':'Προθεσμία',value:formatDay(objective.dueDate,language)},
  ]},
 ]
 // The objective as a printed sheet.
 const printObjective=(pdf?: boolean)=>{
  const ok=printReport({language,kind:en?'Quality objective':'Στόχος ποιότητας',code:objective.code,title:objectiveTitle(objective,language),subtitle:String(objective.year),
   meta:[[en?'Value today':'Τιμή σήμερα',value],[en?'Target':'Στόχος',target],[en?'Status':'Κατάσταση',objectiveStateLabel(state,en)],...detail.flatMap(section=>section.items.filter(item=>item.value!=null&&item.value!=='').map(item=>[item.label,String(item.value)] as ReportFact))],
   sections:[{...objectiveSection(objective,history,language),title:en?'Value by month':'Τιμή ανά μήνα',facts:undefined}],
   filename:`${objective.code}_${objective.year}`},{pdf:pdf===true})
  if(!ok)notify(en?'Allow pop-ups to print.':'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','error')
 }
 return <Page fill><EntityRecordShell className="quality-record-shell objective-record-shell workspace-fill" avatar={<Target size={19}/>} eyebrow={objective.code} title={objectiveTitle(objective,language)} subtitle={`${en?'Quality objective':'Στόχος ποιότητας'} · ${objective.year}`} status={<><StatusBadge tone={tone(state)}>{objectiveStateLabel(state,en)}</StatusBadge>{en&&auto.has(`${objective.id}:title`)&&objective.titleEn&&<AutoTranslatedMark/>}</>} onBack={back}
  headerActions={<><ExportMenu onPrint={()=>printObjective(false)} onPdf={()=>printObjective(true)}/>{register&&<IconButton size="sm" label={en?'Open the register':'Άνοιγμα μητρώου'} onClick={()=>navigate(`/registers/${register.id}`)}><ClipboardList size={16}/></IconButton>}{objective.platformIndicator?.definitionId&&<IconButton size="sm" label={en?'Open the indicator':'Άνοιγμα δείκτη'} onClick={()=>navigate(`/indicators/${objective.platformIndicator.definitionId}`)}><Gauge size={16}/></IconButton>}{canManage&&<Button recordMenu variant="secondary" onClick={()=>navigate(`/quality/objectives/${objective.id}/edit`)}><Pencil size={15}/>{en?'Edit':'Επεξεργασία'}</Button>}</>}>
  <section className="record-section">
   <div className="indicator-result-hero">
    <div className="indicator-result-value"><strong>{value}</strong></div>
    <div className="indicator-result-facts">
     <span><small>{en?'Target':'Στόχος'}</small><b>{target}</b></span>
     <span><small>{en?'Reached':'Επίτευξη'}</small><b className={state==='missed'?'is-late':state==='met'?'is-good':undefined}>{reach==null?'—':`${Math.round(reach)}%`}</b></span>
     <span><small>{en?'Status':'Κατάσταση'}</small><b className={state==='missed'?'is-late':state==='met'?'is-good':undefined}>{objectiveStateLabel(state,en)}</b></span>
     <span><small>{en?'Against the previous month':'Έναντι προηγούμενου μήνα'}</small>{monthChange==null?<b>—</b>:<b className={`indicator-change${(objective.direction==='lower'?monthChange<0:monthChange>0)?' is-better':monthChange===0?'':' is-worse'}`}>{monthChange===0?'0':`${monthChange>0?'+':'−'}${formatObjectiveValue(Math.abs(monthChange),unit,language)}`}</b>}</span>
    </div>
   </div>
   <Meter className="objective-record-meter" value={reach} tone={tone(state)} label={`${objectiveTitle(objective,language)}: ${value}`}/>
   <DetailList sections={detail}/>
   {monthly&&canManage&&monthsSoFar(objective.year)>0&&<div className="objective-month-entry"><small>{en?'Value of each month':'Τιμή κάθε μήνα'}</small>
    <div className="objective-month-grid">{Array.from({length:monthsSoFar(objective.year)},(_,index)=>index+1).map(month=>{const saved=objective.months?.find((row: AnyRecord)=>Number(row.month.slice(5,7))===month);const label=new Intl.DateTimeFormat(en?'en-GB':'el-GR',{month:'short'}).format(new Date(objective.year,month-1,1));return <label key={month} className="objective-month-cell"><span>{label}</span><input inputMode="decimal" aria-label={`${label} ${objective.year}`} value={drafts[month]??(saved?String(saved.value):'')} onChange={event=>setDrafts(current=>({...current,[month]:event.target.value}))} onBlur={()=>void saveMonth(month)}/></label>})}</div>
   </div>}
   {history.length>0&&<>
    {history.length>1&&<div className="indicator-result-trend"><small>{en?'Value by month':'Τιμή ανά μήνα'}</small><Sparkline width={560} height={92} points={history.map(row=>row.value)} target={Number.isFinite(Number(objective.target))&&objective.target!==''?Number(objective.target):null} label={en?'Value by month':'Τιμή ανά μήνα'}/></div>}
    {!(monthly&&canManage)&&<table className="objective-history objective-history-compact"><thead><tr><th>{en?'Month':'Μήνας'}</th><th>{en?'Value':'Τιμή'}</th></tr></thead>
     <tbody>{history.map(row=><tr key={row.month}><td>{new Intl.DateTimeFormat(en?'en-GB':'el-GR',{month:'long',year:'numeric'}).format(new Date(objective.year,row.month-1,1))}</td><td className={objectiveState(objective,row.value)==='missed'?'is-late':undefined}>{formatObjectiveValue(row.value,unit,language)}</td></tr>)}</tbody></table>}
   </>}
   <LinkedActions sourceId={objective.code} organizationId={tenant?.id}/>
  </section>
 </EntityRecordShell>
 </Page>
}
