import { useState } from 'react'
import { useNavigate,useParams } from 'react-router-dom'
import { ClipboardList,Pencil,Target } from 'lucide-react'
import { Page } from '../../../design-system/Page'
import { EntityRecordShell } from '../../../design-system/EntityRecordShell'
import { DetailList } from '../../../design-system/DetailList'
import { IconButton } from '../../../design-system/IconButton'
import { Meter } from '../../../design-system/MiniCharts'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { RouteLoading } from '../../../design-system/RouteLoading'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { formatDay } from '../../../core/i18n/formatDay'
import { roleTitleText } from '../../../core/i18n/roleTitles'
import { CAPABILITIES,can } from '../../../core/permissions/roles'
import { textOf } from '../../registers/registerEngine'
import { formatObjectiveValue } from './reviewTemplate'
import { ObjectiveDialog,objectiveStateLabel,objectiveTitle,targetReach,useObjectives } from './QualityObjectives'
import { rememberQualitySection } from '../qualityReturnSection'
import '../quality.css'

const tone=state=>({met:'success',missed:'danger'})[state]||'info'

// /quality/objectives/:objectiveId — one objective on its own page: where it stands today, what it is measured by, who owns it and by when.
export function ObjectiveRecordPage(){
 const {objectiveId}=useParams(),navigate=useNavigate(),{language}=useLanguage(),en=language==='en',{tenant,role,membership}=useTenant()
 const {objectives,registers,loading,reload}=useObjectives(tenant?.id)
 const [editing,setEditing]=useState(false)
 const canManage=can(role,CAPABILITIES.MANAGE_QUALITY,membership?.capabilities||[],membership?.customCapabilities||[])
 const back=()=>{rememberQualitySection('indicators:objectives');navigate('/quality',{replace:true})}
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
 return <Page fill><EntityRecordShell className="quality-record-shell objective-record-shell workspace-fill" avatar={<Target size={19}/>} eyebrow={objective.code} title={objectiveTitle(objective,language)} subtitle={`${objective.year} · ${en?'ISO 9001 §6.2':'ISO 9001 §6.2'}`} status={<StatusBadge tone={tone(state)}>{objectiveStateLabel(state,en)}</StatusBadge>} onBack={back}
  headerActions={<>{register&&<IconButton size="sm" label={en?'Open the register':'Άνοιγμα μητρώου'} onClick={()=>navigate(`/registers/${register.id}`)}><ClipboardList size={16}/></IconButton>}{canManage&&<IconButton size="sm" tone="edit" label={en?'Edit':'Επεξεργασία'} onClick={()=>setEditing(true)}><Pencil size={16}/></IconButton>}</>}>
  <section className="record-section">
   <p className="quality-summary-line"><span><b>{value}</b> {en?'today':'σήμερα'}</span><span>{en?'target':'στόχος'} <b>{target}</b></span><span className={state==='missed'?'is-late':undefined}><b>{reach==null?'—':`${Math.round(reach)}%`}</b> {en?'of the target':'του στόχου'}</span><span>{objectiveStateLabel(state,en).toLowerCase()}</span></p>
   <Meter value={reach} tone={tone(state)} label={`${objectiveTitle(objective,language)}: ${value}`}/>
   <DetailList sections={detail}/>
  </section>
 </EntityRecordShell>
 {editing&&<ObjectiveDialog objective={objective} registers={registers} onClose={()=>setEditing(false)} onSaved={()=>{setEditing(false);void reload()}}/>}
 </Page>
}
