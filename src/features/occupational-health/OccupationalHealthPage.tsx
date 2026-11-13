import { InactiveEmployeeBadge, isInactiveEmployee } from '../../design-system/InactiveEmployeeBadge'
import { useEffect,useMemo,useState,useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { HeartPulse,Info,ShieldAlert } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RecordActions } from '../../design-system/RecordActions'
import { ModuleTabs } from '../../design-system/ModuleTabs'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { CAPABILITIES } from '../../core/permissions/roles'
import { useLanguage,translate} from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useEmployeesData } from '../employees/useEmployeesData'
import { loadAllOccupationalVisitsAsync } from '../employees/employeeSubRecordsService'
import { FITNESS } from './occupationalVisitModel'
import { loadAllExposureIncidentsAsync,createExposureIncidentAsync } from './exposureIncidentService'
import { ExposureIncidentEditor,EMPTY_EXPOSURE_INCIDENT } from './ExposureIncidentEditor'
import { downloadCsv } from '../../core/export/csvExport'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import './OccupationalHealthPage.css'
import { signalDemoStep } from '../demo/demoScenarioSignals'
import type { ExposureIncident } from './exposureIncidentService'
import type { EmployeeRow, OccupationalVisit, ExposureIncidentDraft } from './occupationalHealthTypes'

export function OccupationalHealthPage(){
 const {t,language,locale}=useLanguage();const {notify,notifyError}=useFeedback();const navigate=useNavigate();const registry=useRegistryMemory('occupational-health');const {canAccessRecord,tenant}=useTenant()
 const {data:employeeRows,loading:employeesLoading}=useEmployeesData() as unknown as { data: EmployeeRow[], loading: boolean };const [occupationalVisits,setOccupationalVisits]=useState<OccupationalVisit[]>([]);const [visitsLoading,setVisitsLoading]=useState(true)
 const en=language==='en'
 useEffect(()=>{let active=true;loadAllOccupationalVisitsAsync(tenant?.id).then(rows=>{if(active)setOccupationalVisits(rows)}).catch(error=>{if(active)notifyError(error,'load',{operation:'occupational_visits_load'})}).finally(()=>{if(active)setVisitsLoading(false)});return()=>{active=false}},[tenant?.id,notifyError])
 const [section,setSection]=useState('visits')
 const [query,setQuery]=useState(''),[status,setStatus]=useState('all'),[department,setDepartment]=useState('all')
 const [exposureRows,setExposureRows]=useState<ExposureIncident[]>([]),[exposureLoading,setExposureLoading]=useState(true),[exposureEditor,setExposureEditor]=useState<ExposureIncidentDraft|null>(null)
 const departments=useMemo(()=>[...new Set(employeeRows.map(x=>language==='el'?x.department:x.departmentEn).filter(Boolean))],[employeeRows,language])
 const employeeMap=useMemo(()=>{const out: Record<string, EmployeeRow>={};for(const x of employeeRows){out[x.id]=x;if(x.dbId)out[x.dbId]=x}return out},[employeeRows])
 const reloadExposureIncidents=useCallback(async()=>{if(!tenant?.id){setExposureLoading(false);return}setExposureLoading(true);try{setExposureRows(await loadAllExposureIncidentsAsync(tenant.id))}catch(error){notify((error as Error|null)?.message||(translate('copy.occupationalCopy.couldNotLoadExposureIncidents',en?'en':'el')),'error')}finally{setExposureLoading(false)}},[tenant?.id,notify,en])
 useEffect(()=>{void reloadExposureIncidents()},[reloadExposureIncidents])
 // Until the first reads end: placeholders, not 0 figures and empty lists.
 const visitsFirstLoad=visitsLoading||(employeesLoading&&!employeeRows.length)
 const exposureFirstLoad=exposureLoading&&!exposureRows.length
 const visitRows=useMemo(()=>occupationalVisits.filter(x=>Boolean(employeeMap[x.employeeId])).filter(x=>canAccessRecord(employeeMap[x.employeeId])).filter(x=>{const e=employeeMap[x.employeeId];const hay=`${e?.id??''} ${e?.firstName??''} ${e?.firstNameEn??''} ${e?.lastName??''} ${e?.lastNameEn??''}`.toLowerCase();return hay.includes(query.toLowerCase())}).filter(x=>department==='all'||(language==='el'?employeeMap[x.employeeId]?.department:employeeMap[x.employeeId]?.departmentEn)===department).filter(x=>status==='all'||x.status===status),[occupationalVisits,employeeMap,canAccessRecord,query,department,status,language])
 const exposureFiltered=useMemo(()=>exposureRows.filter(x=>Boolean(employeeMap[x.employeeId])).filter(x=>canAccessRecord(employeeMap[x.employeeId])).filter(x=>{const e=employeeMap[x.employeeId];const hay=`${e?.id??''} ${e?.firstName??''} ${e?.firstNameEn??''} ${e?.lastName??''} ${e?.lastNameEn??''}`.toLowerCase();return hay.includes(query.toLowerCase())}).filter(x=>department==='all'||(language==='el'?employeeMap[x.employeeId]?.department:employeeMap[x.employeeId]?.departmentEn)===department),[exposureRows,employeeMap,canAccessRecord,query,department,language])
 const fmt=(v: string | null | undefined)=>v?new Intl.DateTimeFormat(locale).format(new Date(`${v}T12:00:00`)):'—';const name=(e: EmployeeRow | null | undefined)=>!e?'—':language==='el'?`${e.lastName} ${e.firstName}`:`${e.firstNameEn||e.firstName} ${e.lastNameEn||e.lastName}`
 async function saveExposureIncident(draft: ExposureIncidentDraft){try{const employee=employeeRows.find(x=>x.id===draft.employeeId);await createExposureIncidentAsync(tenant?.id,employee,draft);signalDemoStep('occupational_exposure','record');notify(translate('copy.occupationalCopy.exposureIncidentSaved',en?'en':'el'),'success');setExposureEditor(null);await reloadExposureIncidents()}catch(error){notify((error as Error|null)?.message||(translate('copy.occupationalCopy.couldNotSaveTheExposureIncident',en?'en':'el')),'error')}}
 function action(a: string){
  if(a===UI_ACTIONS.PRINT){window.print();return}
  if(a===UI_ACTIONS.EXPORT){
   if(section==='exposure'){downloadCsv('limoxis-occupational-exposure-incidents.csv',[t('date'),t('employee'),translate('copy.occupationalCopy.exposureType',en?'en':'el'),translate('copy.occupationalCopy.followUp',en?'en':'el'),t('status')],exposureFiltered.map(x=>{const e=employeeMap[x.employeeId];return [x.incidentDate,name(e),x.exposureType,x.followUpStatus,x.status]}));notify(t('currentListExported'),'success');return}
   downloadCsv('limoxis-occupational-visits.csv',[t('date'),t('employee'),t('visitType'),t('status'),t('fitnessStatus'),t('followUp')],visitRows.map(x=>{const e=employeeMap[x.employeeId];return [x.date,name(e),t(x.type),t(x.status),t(x.fitStatus),x.followUpDate||'']}));notify(t('currentListExported'),'success');return
  }
  if(a===UI_ACTIONS.CREATE){
   if(section==='exposure'){setExposureEditor({...EMPTY_EXPOSURE_INCIDENT});return}
   navigate('/occupational-health/visits/new');return
  }
  notify(t('actionCompleted'),'info')
 }
 const sectionTabs=[{id:'visits',label:t('occupationalHealth'),icon:HeartPulse},{id:'exposure',label:translate('copy.occupationalCopy.exposureIncidents',en?'en':'el'),icon:ShieldAlert}]
 const createLabel=section==='exposure'?(translate('copy.occupationalCopy.newExposureIncident',en?'en':'el')):t('newOccupationalVisit')
 return <Page fill title={t('occupationalHealth')} subtitle={t('occupationalHealthSubtitle')} actions={<RecordActions actions={[UI_ACTIONS.CREATE,UI_ACTIONS.PRINT,UI_ACTIONS.EXPORT]} actionCapabilities={{[UI_ACTIONS.CREATE]:CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH}} actionLabels={{[UI_ACTIONS.CREATE]:createLabel}} onAction={action}/> }>
  <ModuleTabs tabs={sectionTabs} activeId={section} onChange={setSection} ariaLabel={translate('copy.occupationalCopy.occupationalHealthSections',en?'en':'el')}/>
  <section className="surface registry-workspace occupational-workspace workspace-fill"><FilterBar query={query} onQueryChange={setQuery} placeholder={t('searchEmployees')} activeAdvancedCount={(department!=='all'?1:0)+(section==='visits'&&status!=='all'?1:0)} onClear={()=>{setQuery('');setDepartment('all');setStatus('all')}} end={<span className="occupational-governance-tip" role="img" tabIndex={0} title={t('occupationalHealthGovernance')} aria-label={t('occupationalHealthGovernance')}><Info size={16} aria-hidden="true"/></span>}><FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(x=><option key={x}>{x}</option>)}</FilterSelect>{section==='visits'&&<FilterSelect label={t('status')} value={status} onChange={setStatus}><option value="all">{t('all')}</option><option value="scheduled">{t('scheduled')}</option><option value="completed">{t('completed')}</option></FilterSelect>}</FilterBar><div className="occupational-content single"><div className="scroll-table">{section==='visits'?visitsFirstLoad?<TableSkeleton/>:<Visits rows={visitRows} employeeMap={employeeMap} name={name} t={t} en={en} fmt={fmt} openEmployee={(id: string,rowId: string)=>registry.openRecord(navigate,`/occupational-health/visits/${encodeURIComponent(rowId)}`,rowId,[])} highlightId={registry.highlightId}/>:exposureFirstLoad?<TableSkeleton/>:<ExposureIncidents rows={exposureFiltered} employeeMap={employeeMap} name={name} en={en} fmt={fmt} openEmployee={(id: string,rowId: string)=>registry.openRecord(navigate,`/employees/${id}`,rowId,[],{state:{limoxisRestore:{tab:'exposureIncidents'}}})} highlightId={registry.highlightId}/>}</div></div></section>
  {exposureEditor&&<ExposureIncidentEditor language={language} employees={employeeRows.filter(x=>x.employmentStatus==='active'&&canAccessRecord(x))} draft={exposureEditor} onChange={setExposureEditor} onClose={()=>setExposureEditor(null)} onSave={saveExposureIncident}/>}
 </Page>
}
function Visits({rows,employeeMap,name,t,en,fmt,openEmployee,highlightId}: { rows: OccupationalVisit[], employeeMap: Record<string, EmployeeRow>, name: (employee: EmployeeRow | null | undefined) => string, en: boolean, fmt: (value: string | null | undefined) => string, openEmployee: (id: string, rowId: string) => void, highlightId?: string | null, t: (key: string) => string }){return <table className="data-table sticky-table"><thead><tr><th>{t('date')}</th><th>{t('employee')}</th><th>{t('visitType')}</th><th>{t('status')}</th><th>{t('fitnessStatus')}</th><th>{t('followUp')}</th></tr></thead><tbody>{rows.map(x=>{const e=employeeMap[x.employeeId];return <tr key={x.id} data-record-id={x.id} className={`clickable-row${highlightId===x.id?' registry-row-returned':''}${isInactiveEmployee(e)?' inactive-employee-row':''}`} tabIndex={0} onClick={()=>openEmployee(e.id,x.id)} onKeyDown={ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();openEmployee(e.id,x.id)}}}><td>{fmt(x.date)}</td><td><strong>{name(e)}</strong><InactiveEmployeeBadge inactive={isInactiveEmployee(e)}/><small>{e.id}</small></td><td>{t(x.type)}</td><td><span className="status-badge active">{t(x.status)}</span></td><td>{FITNESS.find(([value])=>value===x.fitStatus)?.[en?2:1]||t(x.fitStatus)}</td><td>{fmt(x.followUpDate)}</td></tr>})}</tbody></table>}
const EXPOSURE_TYPE_LABELS: Record<string, [string, string]>={needlestick:['Τρύπημα βελόνας','Needlestick'],sharps_object:['Άλλο αιχμηρό αντικείμενο','Other sharps object'],mucocutaneous:['Έκθεση βλεννογόνου','Mucocutaneous exposure'],non_intact_skin:['Έκθεση μη ακέραιου δέρματος','Non-intact skin exposure'],other:['Άλλο','Other']}
const FOLLOW_UP_LABELS: Record<string, [string, string]>={pending:['Εκκρεμεί','Pending'],scheduled:['Προγραμματισμένη','Scheduled'],completed:['Ολοκληρώθηκε','Completed'],closed:['Έκλεισε','Closed']}
function ExposureIncidents({rows,employeeMap,name,en,fmt,openEmployee,highlightId}: { rows: ExposureIncident[], employeeMap: Record<string, EmployeeRow>, name: (employee: EmployeeRow | null | undefined) => string, en: boolean, fmt: (value: string | null | undefined) => string, openEmployee: (id: string, rowId: string) => void, highlightId?: string | null }){
 if(!rows.length)return <div className="inline-empty">{translate('copy.occupationalCopy.noExposureIncidentsRecorded',en?'en':'el')}</div>
 return <table className="data-table sticky-table"><thead><tr><th>{translate('copy.occupationalCopy.date',en?'en':'el')}</th><th>{translate('copy.occupationalCopy.employee',en?'en':'el')}</th><th>{translate('copy.occupationalCopy.exposureType',en?'en':'el')}</th><th>{translate('copy.occupationalCopy.followUp',en?'en':'el')}</th><th>{translate('copy.occupationalCopy.status',en?'en':'el')}</th></tr></thead><tbody>{rows.map(x=>{const e=employeeMap[x.employeeId];return <tr key={x.id} data-record-id={x.id} className={`clickable-row${highlightId===x.id?' registry-row-returned':''}${isInactiveEmployee(e)?' inactive-employee-row':''}`} tabIndex={0} onClick={()=>openEmployee(e.id,x.id)} onKeyDown={ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();openEmployee(e.id,x.id)}}}><td>{fmt(x.incidentDate)}</td><td><strong>{name(e)}</strong><InactiveEmployeeBadge inactive={isInactiveEmployee(e)}/><small>{e.id}</small></td><td>{EXPOSURE_TYPE_LABELS[x.exposureType]?.[en?1:0]||x.exposureType}</td><td>{FOLLOW_UP_LABELS[x.followUpStatus]?.[en?1:0]||x.followUpStatus}</td><td><span className={`status-badge ${x.status==='open'?'temporary':''}`}>{x.status==='open'?(translate('copy.occupationalCopy.open',en?'en':'el')):(translate('copy.occupationalCopy.closed',en?'en':'el'))}</span></td></tr>})}</tbody></table>
}
