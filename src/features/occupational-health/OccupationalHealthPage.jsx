import { useMemo,useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock,HeartPulse,UserRoundCheck } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RecordActions } from '../../design-system/RecordActions'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { CAPABILITIES } from '../../core/permissions/roles'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useEmployeesData } from '../employees/useEmployeesData'
import { loadOccupationalVisits } from '../employees/employeeRecordsService'
import { downloadCsv } from '../../core/export/csvExport'
import { MetricCard } from '../../design-system/MetricCard'
import './OccupationalHealthPage.css'

export function OccupationalHealthPage(){
 const {t,language,locale}=useLanguage();const {notify}=useFeedback();const navigate=useNavigate();const {canAccessRecord}=useTenant()
 const {data:employeeRows}=useEmployeesData();const occupationalVisits=useMemo(loadOccupationalVisits,[])
 const [query,setQuery]=useState(''),[status,setStatus]=useState('all'),[department,setDepartment]=useState('all')
 const departments=useMemo(()=>[...new Set(employeeRows.map(x=>language==='el'?x.department:x.departmentEn).filter(Boolean))],[employeeRows,language])
 const employeeMap=useMemo(()=>{const out={};for(const x of employeeRows){out[x.id]=x;if(x.dbId)out[x.dbId]=x}return out},[employeeRows])
 const rows=useMemo(()=>occupationalVisits.filter(x=>Boolean(employeeMap[x.employeeId])).filter(x=>canAccessRecord(employeeMap[x.employeeId])).filter(x=>{const e=employeeMap[x.employeeId];const hay=`${e?.id??''} ${e?.firstName??''} ${e?.firstNameEn??''} ${e?.lastName??''} ${e?.lastNameEn??''}`.toLowerCase();return hay.includes(query.toLowerCase())}).filter(x=>department==='all'||(language==='el'?employeeMap[x.employeeId]?.department:employeeMap[x.employeeId]?.departmentEn)===department).filter(x=>status==='all'||x.status===status),[occupationalVisits,employeeMap,canAccessRecord,query,department,status,language])
 const fmt=v=>v?new Intl.DateTimeFormat(locale).format(new Date(`${v}T12:00:00`)):'—';const name=e=>!e?'—':language==='el'?`${e.lastName} ${e.firstName}`:`${e.firstNameEn||e.firstName} ${e.lastNameEn||e.lastName}`
 const scheduled=occupationalVisits.filter(x=>x.status==='scheduled').length
 function action(a){if(a===UI_ACTIONS.PRINT){window.print();return}if(a===UI_ACTIONS.EXPORT){downloadCsv('limoxis-occupational-visits.csv',[t('date'),t('employee'),t('visitType'),t('status'),t('fitnessStatus'),t('followUp')],rows.map(x=>{const e=employeeMap[x.employeeId];return [x.date,name(e),t(x.type),t(x.status),t(x.fitStatus),x.followUpDate||'']}));notify(t('currentListExported'),'success');return}notify(t(a===UI_ACTIONS.CREATE?'newOccupationalVisit':'actionCompleted'),'info')}
 return <Page fill title={t('occupationalHealth')} subtitle={t('occupationalHealthSubtitle')} actions={<RecordActions actions={[UI_ACTIONS.CREATE,UI_ACTIONS.ATTACH,UI_ACTIONS.PRINT,UI_ACTIONS.EXPORT]} actionCapabilities={{[UI_ACTIONS.CREATE]:CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH,[UI_ACTIONS.ATTACH]:CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH}} actionLabels={{[UI_ACTIONS.CREATE]:t('newOccupationalVisit')}} onAction={action}/> }>
  <div className="workspace-summary"><div className="employee-kpis"><Kpi icon={CalendarClock} value={scheduled} label={t('scheduledVisits')}/><Kpi icon={UserRoundCheck} value={occupationalVisits.filter(x=>x.fitStatus==='fit').length} label={t('fitForWork')}/></div><div className="governance-banner"><HeartPulse size={17}/><span>{t('occupationalHealthGovernance')}</span></div></div>
  <section className="surface registry-workspace occupational-workspace workspace-fill"><FilterBar query={query} onQueryChange={setQuery} placeholder={t('searchEmployees')} activeAdvancedCount={(department!=='all'?1:0)+(status!=='all'?1:0)} onClear={()=>{setQuery('');setDepartment('all');setStatus('all')}}><FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(x=><option key={x}>{x}</option>)}</FilterSelect><FilterSelect label={t('status')} value={status} onChange={setStatus}><option value="all">{t('all')}</option><option value="scheduled">{t('scheduled')}</option><option value="completed">{t('completed')}</option></FilterSelect></FilterBar><div className="occupational-content single"><div className="scroll-table"><Visits rows={rows} employeeMap={employeeMap} name={name} t={t} fmt={fmt} openEmployee={id=>navigate(`/employees/${id}`)}/></div></div></section>
 </Page>
}
function Kpi({icon:Icon,value,label}){return <MetricCard icon={Icon} value={value} label={label}/>}
function Visits({rows,employeeMap,name,t,fmt,openEmployee}){return <table className="data-table sticky-table"><thead><tr><th>{t('date')}</th><th>{t('employee')}</th><th>{t('visitType')}</th><th>{t('status')}</th><th>{t('fitnessStatus')}</th><th>{t('followUp')}</th></tr></thead><tbody>{rows.map(x=>{const e=employeeMap[x.employeeId];return <tr key={x.id} className="clickable-row" tabIndex={0} onClick={()=>openEmployee(e.id)} onKeyDown={ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();openEmployee(e.id)}}}><td>{fmt(x.date)}</td><td><strong>{name(e)}</strong><small>{e.id}</small></td><td>{t(x.type)}</td><td><span className="status-badge active">{t(x.status)}</span></td><td>{t(x.fitStatus)}</td><td>{fmt(x.followUpDate)}</td></tr>})}</tbody></table>}
