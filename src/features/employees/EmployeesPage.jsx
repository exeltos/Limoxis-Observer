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
import { EmployeeCreateDialog } from './EmployeeCreatePage'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { downloadCsv } from '../../core/export/csvExport'
import { MetricCard } from '../../design-system/MetricCard'
import { useEmployeesData } from './useEmployeesData'
import { createEmployeeAsync } from './employeeService'
import { RouteLoading } from '../../design-system/RouteLoading'

export function EmployeesPage(){
  const {t,language}=useLanguage(); const {notify}=useFeedback(); const navigate=useNavigate(); const {canAccessRecord,tenant}=useTenant(); const actor=useAuditActor()
  const {data:employeeRows,setData:setEmployeeRows,loading,error,reload}=useEmployeesData(); const [createOpen,setCreateOpen]=useState(false)
  const registry=useRegistryMemory('employees')
  const saved=registry.loadViewState({query:'',department:'all',status:'all'})
  const [query,setQuery]=useState(saved.query); const [department,setDepartment]=useState(saved.department); const [status,setStatus]=useState(saved.status)
  const departments=useMemo(()=>[...new Set(employeeRows.map(x=>language==='el'?x.department:x.departmentEn))],[employeeRows,language])
  const rows=useMemo(()=>employeeRows.filter(x=>canAccessRecord(x)).filter(x=>`${x.id} ${x.firstName} ${x.firstNameEn} ${x.lastName} ${x.lastNameEn} ${x.email}`.toLowerCase().includes(query.toLowerCase())).filter(x=>department==='all'||(language==='el'?x.department:x.departmentEn)===department).filter(x=>status==='all'||x.employmentStatus===status),[employeeRows,query,department,status,language,canAccessRecord])
  if(loading)return <RouteLoading/>
  if(error)return <div className="data-access-state error" role="alert"><span>{t('employeesLoadFailed')}</span><button type="button" onClick={reload}>{t('retry')}</button></div>
  const displayName=x=>language==='el'?`${x.lastName} ${x.firstName}`:`${x.firstNameEn} ${x.lastNameEn}`
  const scopedEmployees=employeeRows.filter(x=>canAccessRecord(x))
  const employeeSummary={
    total:scopedEmployees.length,
    active:scopedEmployees.filter(x=>x.employmentStatus==='active').length,
    inactive:scopedEmployees.filter(x=>x.employmentStatus==='inactive').length,
    departments:new Set(scopedEmployees.map(x=>language==='el'?x.department:x.departmentEn).filter(Boolean)).size,
  }
  function openEmployee(row){
    registry.saveViewState({query,department,status})
    registry.openRecord(navigate,`/employees/${encodeURIComponent(row.id)}`,row.id,rows.map(item=>item.id))
  }

  function action(a){if(a===UI_ACTIONS.CREATE){registry.saveViewState({query,department,status});setCreateOpen(true)} else if(a===UI_ACTIONS.PRINT)window.print(); else if(a===UI_ACTIONS.EXPORT){downloadCsv('limoxis-employees.csv',[t('employeeCode'),t('name'),t('department'),t('professionalCategory'),t('status'),t('employeesRecords.email')],rows.map(x=>[x.id,displayName(x),language==='el'?x.department:x.departmentEn,language==='el'?x.profession:x.professionEn,t(x.employmentStatus),x.email||'']));notify(t('currentListExported'),'success')} else notify(t('actionCompleted'),'success')}
  return <Page fill title={t('employees')} subtitle={t('employeesRecords.employeesRegistrySubtitle')} actions={<RecordActions actions={[UI_ACTIONS.CREATE,UI_ACTIONS.PRINT,UI_ACTIONS.EXPORT]} actionCapabilities={{[UI_ACTIONS.CREATE]:CAPABILITIES.MANAGE_STAFF_ADMIN}} onAction={action}/> }>
    <div className="workspace-summary employee-registry-summary">
      <div className="employee-kpis">
        <Kpi icon={Users} value={employeeSummary.total} label={t('all')}/>
        <Kpi icon={Users} value={employeeSummary.active} label={t('employeesRecords.activeEmployees')} kind="active"/>
        <Kpi icon={Users} value={employeeSummary.inactive} label={t('inactive')}/>
        <Kpi icon={Users} value={employeeSummary.departments} label={t('employeesRecords.departments')}/>
      </div>
      <div className="governance-banner compact-governance"><ShieldCheck size={16}/><span>{t('employeesRecords.employeeAdminGovernance')}</span></div>
    </div>
    <section className="surface registry-workspace workspace-column workspace-fill employee-registry-shell"><FilterBar query={query} onQueryChange={setQuery} placeholder={t('searchEmployees')} activeAdvancedCount={(department!=='all'?1:0)+(status!=='all'?1:0)} onClear={()=>{setQuery('');setDepartment('all');setStatus('all')}}><FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(x=><option key={x}>{x}</option>)}</FilterSelect><FilterSelect label={t('status')} value={status} onChange={setStatus}><option value="all">{t('all')}</option><option value="active">{t('active')}</option><option value="inactive">{t('inactive')}</option></FilterSelect></FilterBar>
      <div className="scroll-table" ref={registry.scrollRef}><table className="data-table sticky-table"><thead><tr><th>{t('employeeCode')}</th><th>{t('name')}</th><th>{t('department')}</th><th>{t('professionalCategory')}</th><th>{t('status')}</th></tr></thead><tbody>{rows.map(x=><tr key={x.id} {...registry.rowProps(x.id)} onClick={()=>openEmployee(x)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openEmployee(x)}}}><td><strong>{x.id}</strong></td><td>{displayName(x)}<small>{x.email}</small></td><td>{language==='el'?x.department:x.departmentEn}</td><td>{language==='el'?x.profession:x.professionEn}</td><td><span className={`status-badge ${x.employmentStatus==='active'?'active':''}`}>{t(x.employmentStatus)}</span></td></tr>)}</tbody></table></div>
    </section>
    {createOpen&&<EmployeeCreateDialog rows={employeeRows} actor={actor} onClose={()=>setCreateOpen(false)} onSave={async row=>{try{const created=await createEmployeeAsync(tenant?.id??null,row);setEmployeeRows([created,...employeeRows]);setCreateOpen(false);notify(t('employeeCreated'),'success');navigate(`/employees/${created.id}`)}catch(err){if(err.message==='DUPLICATE_EMPLOYEE_CODE'){notify(t('duplicateEmployeeCode'),'danger')}else{notify(t('employeeSaveFailed'),'danger')}}}}/>}
  </Page>
}
function Kpi({icon:Icon,value,label,kind=''}){return <MetricCard icon={Icon} value={value} label={label} tone={kind||'neutral'}/>}
