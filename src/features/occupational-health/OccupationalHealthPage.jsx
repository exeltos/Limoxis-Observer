import { useEffect,useMemo,useState,useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock,HeartPulse,ShieldAlert,UserRoundCheck } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RecordActions } from '../../design-system/RecordActions'
import { ModuleTabs } from '../../design-system/ModuleTabs'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { CAPABILITIES } from '../../core/permissions/roles'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useEmployeesData } from '../employees/useEmployeesData'
import { loadOccupationalVisits } from '../employees/employeeRecordsService'
import { loadAllExposureIncidentsAsync,createExposureIncidentAsync } from './exposureIncidentService'
import { ExposureIncidentEditor,EMPTY_EXPOSURE_INCIDENT } from './ExposureIncidentEditor'
import { downloadCsv } from '../../core/export/csvExport'
import { MetricCard } from '../../design-system/MetricCard'
import './OccupationalHealthPage.css'

export function OccupationalHealthPage(){
 const {t,language,locale}=useLanguage();const {notify}=useFeedback();const navigate=useNavigate();const {canAccessRecord,tenant}=useTenant()
 const {data:employeeRows}=useEmployeesData();const occupationalVisits=useMemo(loadOccupationalVisits,[])
 const en=language==='en'
 const [section,setSection]=useState('visits')
 const [query,setQuery]=useState(''),[status,setStatus]=useState('all'),[department,setDepartment]=useState('all')
 const [exposureRows,setExposureRows]=useState([]),[exposureLoading,setExposureLoading]=useState(false),[exposureEditor,setExposureEditor]=useState(null)
 const departments=useMemo(()=>[...new Set(employeeRows.map(x=>language==='el'?x.department:x.departmentEn).filter(Boolean))],[employeeRows,language])
 const employeeMap=useMemo(()=>{const out={};for(const x of employeeRows){out[x.id]=x;if(x.dbId)out[x.dbId]=x}return out},[employeeRows])
 const reloadExposureIncidents=useCallback(async()=>{if(!tenant?.id)return;setExposureLoading(true);try{setExposureRows(await loadAllExposureIncidentsAsync(tenant.id))}catch(error){notify(error?.message||(en?'Could not load exposure incidents.':'Δεν ήταν δυνατή η φόρτωση των περιστατικών έκθεσης.'),'error')}finally{setExposureLoading(false)}},[tenant?.id,notify,en])
 useEffect(()=>{void reloadExposureIncidents()},[reloadExposureIncidents])
 const visitRows=useMemo(()=>occupationalVisits.filter(x=>Boolean(employeeMap[x.employeeId])).filter(x=>canAccessRecord(employeeMap[x.employeeId])).filter(x=>{const e=employeeMap[x.employeeId];const hay=`${e?.id??''} ${e?.firstName??''} ${e?.firstNameEn??''} ${e?.lastName??''} ${e?.lastNameEn??''}`.toLowerCase();return hay.includes(query.toLowerCase())}).filter(x=>department==='all'||(language==='el'?employeeMap[x.employeeId]?.department:employeeMap[x.employeeId]?.departmentEn)===department).filter(x=>status==='all'||x.status===status),[occupationalVisits,employeeMap,canAccessRecord,query,department,status,language])
 const exposureFiltered=useMemo(()=>exposureRows.filter(x=>Boolean(employeeMap[x.employeeId])).filter(x=>canAccessRecord(employeeMap[x.employeeId])).filter(x=>{const e=employeeMap[x.employeeId];const hay=`${e?.id??''} ${e?.firstName??''} ${e?.firstNameEn??''} ${e?.lastName??''} ${e?.lastNameEn??''}`.toLowerCase();return hay.includes(query.toLowerCase())}).filter(x=>department==='all'||(language==='el'?employeeMap[x.employeeId]?.department:employeeMap[x.employeeId]?.departmentEn)===department),[exposureRows,employeeMap,canAccessRecord,query,department,language])
 const fmt=v=>v?new Intl.DateTimeFormat(locale).format(new Date(`${v}T12:00:00`)):'—';const name=e=>!e?'—':language==='el'?`${e.lastName} ${e.firstName}`:`${e.firstNameEn||e.firstName} ${e.lastNameEn||e.lastName}`
 const scheduled=occupationalVisits.filter(x=>x.status==='scheduled').length
 const openExposures=exposureRows.filter(x=>x.status==='open').length
 async function saveExposureIncident(draft){try{const employee=employeeRows.find(x=>x.id===draft.employeeId);await createExposureIncidentAsync(tenant?.id,employee,draft);notify(en?'Exposure incident saved.':'Το περιστατικό έκθεσης αποθηκεύτηκε.','success');setExposureEditor(null);await reloadExposureIncidents()}catch(error){notify(error?.message||(en?'Could not save the exposure incident.':'Δεν ήταν δυνατή η αποθήκευση του περιστατικού.'),'error')}}
 function action(a){
  if(a===UI_ACTIONS.PRINT){window.print();return}
  if(a===UI_ACTIONS.EXPORT){
   if(section==='exposure'){downloadCsv('limoxis-occupational-exposure-incidents.csv',[t('date'),t('employee'),en?'Exposure type':'Τύπος έκθεσης',en?'Follow-up':'Παρακολούθηση',t('status')],exposureFiltered.map(x=>{const e=employeeMap[x.employeeId];return [x.incidentDate,name(e),x.exposureType,x.followUpStatus,x.status]}));notify(t('currentListExported'),'success');return}
   downloadCsv('limoxis-occupational-visits.csv',[t('date'),t('employee'),t('visitType'),t('status'),t('fitnessStatus'),t('followUp')],visitRows.map(x=>{const e=employeeMap[x.employeeId];return [x.date,name(e),t(x.type),t(x.status),t(x.fitStatus),x.followUpDate||'']}));notify(t('currentListExported'),'success');return
  }
  if(a===UI_ACTIONS.CREATE){
   if(section==='exposure'){setExposureEditor({...EMPTY_EXPOSURE_INCIDENT});return}
   notify(t('newOccupationalVisit'),'info');return
  }
  notify(t('actionCompleted'),'info')
 }
 const sectionTabs=[{id:'visits',label:t('occupationalHealth'),icon:HeartPulse},{id:'exposure',label:en?'Exposure incidents':'Περιστατικά έκθεσης',icon:ShieldAlert}]
 const createLabel=section==='exposure'?(en?'New exposure incident':'Νέο περιστατικό έκθεσης'):t('newOccupationalVisit')
 return <Page fill title={t('occupationalHealth')} subtitle={t('occupationalHealthSubtitle')} actions={<RecordActions actions={[UI_ACTIONS.CREATE,UI_ACTIONS.ATTACH,UI_ACTIONS.PRINT,UI_ACTIONS.EXPORT]} actionCapabilities={{[UI_ACTIONS.CREATE]:CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH,[UI_ACTIONS.ATTACH]:CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH}} actionLabels={{[UI_ACTIONS.CREATE]:createLabel}} onAction={action}/> }>
  <div className="workspace-summary"><div className="employee-kpis"><Kpi icon={CalendarClock} value={scheduled} label={t('scheduledVisits')}/><Kpi icon={UserRoundCheck} value={occupationalVisits.filter(x=>x.fitStatus==='fit').length} label={t('fitForWork')}/><Kpi icon={ShieldAlert} value={openExposures} label={en?'Open exposure incidents':'Ανοικτά περιστατικά έκθεσης'}/></div><div className="governance-banner"><HeartPulse size={17}/><span>{t('occupationalHealthGovernance')}</span></div></div>
  <ModuleTabs tabs={sectionTabs} activeId={section} onChange={setSection} ariaLabel={en?'Occupational health sections':'Ενότητες Ιατρού Εργασίας'}/>
  <section className="surface registry-workspace occupational-workspace workspace-fill"><FilterBar query={query} onQueryChange={setQuery} placeholder={t('searchEmployees')} activeAdvancedCount={(department!=='all'?1:0)+(section==='visits'&&status!=='all'?1:0)} onClear={()=>{setQuery('');setDepartment('all');setStatus('all')}}><FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(x=><option key={x}>{x}</option>)}</FilterSelect>{section==='visits'&&<FilterSelect label={t('status')} value={status} onChange={setStatus}><option value="all">{t('all')}</option><option value="scheduled">{t('scheduled')}</option><option value="completed">{t('completed')}</option></FilterSelect>}</FilterBar><div className="occupational-content single"><div className="scroll-table">{section==='visits'?<Visits rows={visitRows} employeeMap={employeeMap} name={name} t={t} fmt={fmt} openEmployee={id=>navigate(`/employees/${id}`)}/>:exposureLoading?<div className="inline-empty">{en?'Loading…':'Φόρτωση…'}</div>:<ExposureIncidents rows={exposureFiltered} employeeMap={employeeMap} name={name} en={en} fmt={fmt} openEmployee={id=>navigate(`/employees/${id}`)}/>}</div></div></section>
  {exposureEditor&&<ExposureIncidentEditor language={language} employees={employeeRows.filter(x=>x.employmentStatus==='active'&&canAccessRecord(x))} draft={exposureEditor} onChange={setExposureEditor} onClose={()=>setExposureEditor(null)} onSave={saveExposureIncident}/>}
 </Page>
}
function Kpi({icon:Icon,value,label}){return <MetricCard icon={Icon} value={value} label={label}/>}
function Visits({rows,employeeMap,name,t,fmt,openEmployee}){return <table className="data-table sticky-table"><thead><tr><th>{t('date')}</th><th>{t('employee')}</th><th>{t('visitType')}</th><th>{t('status')}</th><th>{t('fitnessStatus')}</th><th>{t('followUp')}</th></tr></thead><tbody>{rows.map(x=>{const e=employeeMap[x.employeeId];return <tr key={x.id} className="clickable-row" tabIndex={0} onClick={()=>openEmployee(e.id)} onKeyDown={ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();openEmployee(e.id)}}}><td>{fmt(x.date)}</td><td><strong>{name(e)}</strong><small>{e.id}</small></td><td>{t(x.type)}</td><td><span className="status-badge active">{t(x.status)}</span></td><td>{t(x.fitStatus)}</td><td>{fmt(x.followUpDate)}</td></tr>})}</tbody></table>}
const EXPOSURE_TYPE_LABELS={needlestick:['Τρύπημα βελόνας','Needlestick'],sharps_object:['Άλλο αιχμηρό αντικείμενο','Other sharps object'],mucocutaneous:['Έκθεση βλεννογόνου','Mucocutaneous exposure'],non_intact_skin:['Έκθεση μη ακέραιου δέρματος','Non-intact skin exposure'],other:['Άλλο','Other']}
const FOLLOW_UP_LABELS={pending:['Εκκρεμεί','Pending'],scheduled:['Προγραμματισμένη','Scheduled'],completed:['Ολοκληρώθηκε','Completed'],closed:['Έκλεισε','Closed']}
function ExposureIncidents({rows,employeeMap,name,en,fmt,openEmployee}){
 if(!rows.length)return <div className="inline-empty">{en?'No exposure incidents recorded':'Δεν έχουν καταγραφεί περιστατικά έκθεσης'}</div>
 return <table className="data-table sticky-table"><thead><tr><th>{en?'Date':'Ημερομηνία'}</th><th>{en?'Employee':'Εργαζόμενος'}</th><th>{en?'Exposure type':'Τύπος έκθεσης'}</th><th>{en?'Follow-up':'Παρακολούθηση'}</th><th>{en?'Status':'Κατάσταση'}</th></tr></thead><tbody>{rows.map(x=>{const e=employeeMap[x.employeeId];return <tr key={x.id} className="clickable-row" tabIndex={0} onClick={()=>openEmployee(e.id)} onKeyDown={ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();openEmployee(e.id)}}}><td>{fmt(x.incidentDate)}</td><td><strong>{name(e)}</strong><small>{e.id}</small></td><td>{EXPOSURE_TYPE_LABELS[x.exposureType]?.[en?1:0]||x.exposureType}</td><td>{FOLLOW_UP_LABELS[x.followUpStatus]?.[en?1:0]||x.followUpStatus}</td><td><span className={`status-badge ${x.status==='open'?'temporary':''}`}>{x.status==='open'?(en?'Open':'Ανοικτό'):(en?'Closed':'Κλειστό')}</span></td></tr>})}</tbody></table>
}
