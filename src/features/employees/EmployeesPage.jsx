import { useMemo, useState } from 'react'
import { ShieldCheck, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { Page } from '../../design-system/Page'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { RecordActions } from '../../design-system/RecordActions'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { CAPABILITIES } from '../../core/permissions/roles'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { employeeRows } from './employeeDemoData'

export function EmployeesPage(){
  const {t,language}=useLanguage(); const {notify}=useFeedback(); const navigate=useNavigate(); const {canAccessRecord}=useTenant()
  const registry=useRegistryMemory('employees')
  const saved=registry.loadViewState({query:'',department:'all',status:'all'})
  const [query,setQuery]=useState(saved.query); const [department,setDepartment]=useState(saved.department); const [status,setStatus]=useState(saved.status)
  const departments=useMemo(()=>[...new Set(employeeRows.map(x=>language==='el'?x.department:x.departmentEn))],[language])
  const rows=useMemo(()=>employeeRows.filter(x=>canAccessRecord(x)).filter(x=>`${x.id} ${x.firstName} ${x.firstNameEn} ${x.lastName} ${x.lastNameEn} ${x.email}`.toLowerCase().includes(query.toLowerCase())).filter(x=>department==='all'||(language==='el'?x.department:x.departmentEn)===department).filter(x=>status==='all'||x.employmentStatus===status),[query,department,status,language,canAccessRecord])
  const displayName=x=>language==='el'?`${x.lastName} ${x.firstName}`:`${x.firstNameEn} ${x.lastNameEn}`
  function action(a){if(a===UI_ACTIONS.CREATE)notify(t('employeesRecords.newEmployee'),'info'); else if(a===UI_ACTIONS.PRINT)window.print(); else notify(t('actionCompleted'),'success')}
  return <Page fill title={t('employees')} subtitle={t('employeesRecords.employeesRegistrySubtitle')} actions={<RecordActions actions={[UI_ACTIONS.CREATE,UI_ACTIONS.PRINT,UI_ACTIONS.EXPORT]} actionCapabilities={{[UI_ACTIONS.CREATE]:CAPABILITIES.MANAGE_STAFF_ADMIN}} onAction={action}/> }>
    <div className="workspace-summary"><div className="employee-kpis"><Kpi icon={Users} value={employeeRows.filter(x=>x.employmentStatus==='active').length} label={t('employeesRecords.activeEmployees')}/><Kpi icon={Users} value={departments.length} label={t('employeesRecords.departments')}/></div><div className="governance-banner"><ShieldCheck size={17}/><span>{t('employeesRecords.employeeAdminGovernance')}</span></div></div>
    <section className="surface workspace-column workspace-fill"><FilterBar query={query} onQueryChange={setQuery} placeholder={t('searchEmployees')} activeAdvancedCount={(department!=='all'?1:0)+(status!=='all'?1:0)} onClear={()=>{setQuery('');setDepartment('all');setStatus('all')}}><FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(x=><option key={x}>{x}</option>)}</FilterSelect><FilterSelect label={t('status')} value={status} onChange={setStatus}><option value="all">{t('all')}</option><option value="active">{t('active')}</option><option value="inactive">{t('inactive')}</option></FilterSelect></FilterBar>
      <div className="scroll-table" ref={registry.scrollRef}><table className="data-table sticky-table"><thead><tr><th>{t('employeeCode')}</th><th>{t('name')}</th><th>{t('department')}</th><th>{t('professionalCategory')}</th><th>{t('status')}</th></tr></thead><tbody>{rows.map(x=><tr key={x.id} {...registry.rowProps(x.id)} onClick={()=>{registry.saveViewState({query,department,status});registry.openRecord(navigate,`/employees/${x.id}`,x.id,rows.map(item=>item.id))}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();registry.saveViewState({query,department,status});registry.openRecord(navigate,`/employees/${x.id}`,x.id,rows.map(item=>item.id))}}}><td><strong>{x.id}</strong></td><td>{displayName(x)}<small>{x.email}</small></td><td>{language==='el'?x.department:x.departmentEn}</td><td>{language==='el'?x.profession:x.professionEn}</td><td><span className={`status-badge ${x.employmentStatus==='active'?'active':''}`}>{t(x.employmentStatus)}</span></td></tr>)}</tbody></table></div>
    </section>
  </Page>
}
function Kpi({icon:Icon,value,label}){return <div className="employee-kpi"><Icon size={18}/><div><strong>{value}</strong><span>{label}</span></div></div>}
