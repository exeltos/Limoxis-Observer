import { useEffect,useMemo,useState } from 'react'
import { Plus,Upload,Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { Page } from '../../design-system/Page'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { RecordActions } from '../../design-system/RecordActions'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryEmptyState } from '../../design-system/RegistryEmptyState'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { CAPABILITIES, ROLES } from '../../core/permissions/roles'
import { loadAllOccupationalVisitsAsync } from './employeeSubRecordsService'
import { fitnessLabel } from '../occupational-health/occupationalVisitModel'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useEmployeesData } from './useEmployeesData'
import { RouteLoading } from '../../design-system/RouteLoading'
import { Button } from '../../design-system/Button'
import { ExportMenu } from '../../design-system/ExportMenu'
import { printReport } from '../../core/export/reportDocument'
import { exportRegistry,printRegistry } from '../../core/export/registryExports'
import { can } from '../../core/permissions/roles'
import { EmployeeImportDialog } from './EmployeeImportDialog'
import { EmployeeExcelDialog } from './EmployeeExcelDialog'
import { EmployeeAvatar, useEmployeePhotoUrls } from './EmployeePhoto'

export function EmployeesPage(){
  const {t,language}=useLanguage(); const navigate=useNavigate(); const {canAccessRecord,role,membership,tenant}=useTenant()
  const {data:employeeRows,loading,error,reload}=useEmployeesData()
  const registry=useRegistryMemory('employees')
  const {notify}=useFeedback()
  const saved=registry.loadViewState({query:'',department:'all',status:'all'})
  const [query,setQuery]=useState(saved.query); const [department,setDepartment]=useState(saved.department); const [status,setStatus]=useState(saved.status)
  const [importOpen,setImportOpen]=useState(false)
  const [excelMode,setExcelMode]=useState(null)
  // The occupational physician sees each employee's latest completed visit and its fitness in the list.
  const showHealth=role===ROLES.OCCUPATIONAL_PHYSICIAN
  const [visits,setVisits]=useState([])
  useEffect(()=>{if(!showHealth)return;let live=true;loadAllOccupationalVisitsAsync(tenant?.id).then(rows=>{if(live)setVisits(rows)}).catch(()=>{});return()=>{live=false}},[showHealth,tenant?.id])
  const lastVisitOf=useMemo(()=>{const latest=new Map();for(const v of visits){if(v.status!=='completed')continue;const prev=latest.get(v.employeeId);if(!prev||String(v.date)>String(prev.date))latest.set(v.employeeId,v)}return x=>latest.get(x.dbId)||latest.get(x.id)||null},[visits])
  const canImport=can(role,CAPABILITIES.MANAGE_STAFF_ADMIN,membership?.capabilities??[],membership?.customCapabilities??[])
  const [page,setPage]=useState(1); const [pageSize,setPageSize]=useState(15)
  const departments=useMemo(()=>[...new Set(employeeRows.map(x=>language==='el'?x.department:x.departmentEn).filter(Boolean))],[employeeRows,language])
  const rows=useMemo(()=>employeeRows.filter(x=>canAccessRecord(x)).filter(x=>`${x.id} ${x.firstName} ${x.firstNameEn} ${x.lastName} ${x.lastNameEn} ${x.email}`.toLowerCase().includes(query.toLowerCase())).filter(x=>department==='all'||(language==='el'?x.department:x.departmentEn)===department).filter(x=>status==='all'||(status==='new'?isNewHire(x):x.employmentStatus===status)),[employeeRows,query,department,status,language,canAccessRecord])
  useEffect(()=>setPage(1),[query,department,status,pageSize])
  const photoUrls=useEmployeePhotoUrls(useMemo(()=>rows.slice((page-1)*pageSize,page*pageSize),[rows,page,pageSize]))
  if(loading)return <RouteLoading/>
  if(error)return <div className="data-access-state error" role="alert"><span>{t('employeesLoadFailed')}</span><button type="button" onClick={reload}>{t('retry')}</button></div>
  const displayName=x=>language==='el'?`${x.lastName} ${x.firstName}`:`${x.firstNameEn} ${x.lastNameEn}`
  const scopedEmployees=employeeRows.filter(x=>canAccessRecord(x))
  const totalPages=Math.max(1,Math.ceil(rows.length/pageSize)); const safePage=Math.min(page,totalPages); const pagedRows=rows.slice((safePage-1)*pageSize,safePage*pageSize)
  function openEmployee(row){registry.saveViewState({query,department,status});registry.openRecord(navigate,`/employees/${encodeURIComponent(row.id)}`,row.id,rows.map(item=>item.id))}
  // The list as filtered (print / Excel), and the same people grouped by department (print / PDF / Excel).
  // Excel asks which fields the file has; the print and the PDF carry the fixed set below.
  const unit=x=>(language==='el'?x.department:x.departmentEn)||'—'
  const excelFields=[
    {key:'name',label:t('name'),initial:true,value:displayName},
    {key:'code',label:t('employeeCode'),initial:true,value:x=>x.id},
    {key:'department',label:t('department'),initial:true,value:unit},
    {key:'category',label:t('professionalCategory'),initial:true,value:x=>(language==='el'?x.profession:x.professionEn)||'—'},
    {key:'position',label:t('employeesRecords.exportPosition'),initial:false,value:x=>(language==='el'?x.position:(x.positionEn||x.position))||''},
    {key:'status',label:t('status'),initial:true,value:x=>t(x.employmentStatus)},
    {key:'mobile',label:t('employeesRecords.exportMobile'),initial:true,value:x=>x.phone||''},
    {key:'email',label:t('employeesRecords.exportEmail'),initial:false,value:x=>x.email||''},
    {key:'hireDate',label:t('employeesRecords.exportHireDate'),initial:false,value:x=>x.hireDate?String(x.hireDate).slice(0,10).split('-').reverse().join('/'):''},
  ]
  const printKeys=['name','code','department','category','mobile','status']
  const tableOf=(keys,list)=>{const used=excelFields.filter(field=>keys.includes(field.key));return {headers:used.map(field=>field.label),rows:list.map(x=>used.map(field=>field.value(x)))}}
  const departmentLabel=department==='all'?t('allDepartments'):department
  const byDepartment=()=>{const groups=new Map();for(const x of rows){const key=unit(x);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(x)}return [...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0],language==='en'?'en':'el'))}
  const listBuild=()=>({name:`${language==='en'?'employees':'ergazomenoi'}${department==='all'?'':`_${department}`}`,...tableOf(printKeys,rows)})
  const printGrouped=pdf=>{const ok=printReport({language,orientation:'landscape',kind:t('employees'),code:departmentLabel,title:`${t('employees')} · ${t('employeesRecords.exportByDepartment')}`,
    meta:[[t('department'),departmentLabel],[t('status'),status==='all'?t('all'):t(status==='new'?'employeesRecords.newHires':status)],[t('employees'),String(rows.length)]],
    sections:byDepartment().map(([name,list])=>({title:`${name} (${list.length})`,table:{columns:tableOf(printKeys,list).headers,rows:tableOf(printKeys,list).rows}})),filename:`${t('employees')}_${t('employeesRecords.exportByDepartment')}`},{pdf:pdf===true});if(!ok)notify(t('indicatorsRecords.allowPopups'),'error')}
  // The Excel file: one sheet with everyone, or one sheet per department, with the chosen fields.
  const excelFile=(keys,grouped)=>exportRegistry(grouped
    ?{name:language==='en'?'employees-by-department':'ergazomenoi-ana-tmima',sheets:byDepartment().map(([name,list])=>({name,...tableOf(keys,list)}))}
    :{name:`${language==='en'?'employees':'ergazomenoi'}${department==='all'?'':`_${department}`}`,...tableOf(keys,rows)})
  const exportMenu=<ExportMenu disabled={!rows.length} items={[
    {id:'employees-print',kind:'print',label:t('employeesRecords.exportPrintList'),onClick:()=>{if(!printRegistry(listBuild(),{language,kind:t('employees'),title:t('employees')}))notify(t('indicatorsRecords.allowPopups'),'error')}},
    {id:'employees-excel',kind:'excel',label:t('employeesRecords.exportExcelList'),onClick:()=>setExcelMode('list')},
    {id:'grouped-print',kind:'print',label:t('employeesRecords.exportPrintByDepartment'),onClick:()=>printGrouped(false)},
    {id:'grouped-pdf',kind:'pdf',label:t('employeesRecords.exportPdfByDepartment'),onClick:()=>printGrouped(true)},
    {id:'grouped-excel',kind:'excel',label:t('employeesRecords.exportExcelByDepartment'),onClick:()=>setExcelMode('grouped')},
  ]}/>
  function clearFilters(){setQuery('');setDepartment('all');setStatus('all')}
  function action(a){if(a===UI_ACTIONS.CREATE){registry.saveViewState({query,department,status});navigate('/employees/new')}}
  return <Page fill className="employees-registry-page" title={t('employees')} subtitle={t(showHealth?'employeesRecords.registrySubtitlePhysician':'employeesRecords.employeesRegistrySubtitle')} actions={<div className="row-actions">{exportMenu}{canImport&&<Button variant="secondary" onClick={()=>setImportOpen(true)}><Upload size={15}/>{t('employeesImportAction')}</Button>}<RecordActions actions={[UI_ACTIONS.CREATE]} actionCapabilities={{[UI_ACTIONS.CREATE]:CAPABILITIES.MANAGE_STAFF_ADMIN}} onAction={action}/></div> }>
    <section className="surface registry-workspace workspace-column workspace-fill employee-registry-shell">
      <FilterBar query={query} onQueryChange={setQuery} placeholder={t('searchEmployees')} activeAdvancedCount={(department!=='all'?1:0)+(status!=='all'?1:0)} onClear={clearFilters}>
        <FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(x=><option key={x}>{x}</option>)}</FilterSelect>
        <FilterSelect label={t('status')} value={status} onChange={setStatus}><option value="all">{t('all')}</option><option value="active">{t('active')}</option><option value="inactive">{t('inactive')}</option><option value="new">{t('employeesRecords.newHires')}</option></FilterSelect>
      </FilterBar>
      <div className="scroll-table" ref={registry.scrollRef}>
        <table className="data-table sticky-table"><thead><tr><th>{t('name')}</th><th>{t('employeeCode')}</th><th>{t('department')}</th><th>{t('professionalCategory')}</th>{showHealth&&<th>{t('employeesRecords.lastVisit')}</th>}{showHealth&&<th>{t('employeesRecords.fitnessForWork')}</th>}<th>{t('status')}</th></tr></thead><tbody>{pagedRows.map(x=><tr key={x.id} {...registry.rowProps(x.id)} onClick={()=>openEmployee(x)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openEmployee(x)}}}><td><div className="employee-registry-person"><EmployeeAvatar employee={x} url={x.photoPath?photoUrls[x.photoPath]:''}/><div><strong className="employee-registry-name">{displayName(x)}</strong><small>{x.email}</small></div></div></td><td className="nowrap-cell"><strong>{x.id}</strong></td><td>{language==='el'?x.department:x.departmentEn}</td><td>{language==='el'?x.profession:x.professionEn}{x.position&&<small>{language==='el'?x.position:(x.positionEn||x.position)}</small>}</td>{showHealth&&<td className="nowrap-cell">{lastVisitOf(x)?new Intl.DateTimeFormat(language==='en'?'en-GB':'el-GR').format(new Date(`${String(lastVisitOf(x).date).slice(0,10)}T12:00:00`)):'—'}</td>}{showHealth&&<td>{lastVisitOf(x)?fitnessLabel(lastVisitOf(x).fitStatus,language):'—'}</td>}<td><span className={`status-badge ${x.employmentStatus==='active'?'active':''}`}>{t(x.employmentStatus)}</span></td></tr>)}</tbody></table>
        {!rows.length&&(scopedEmployees.length
          ?<RegistryEmptyState filtered onClearFilters={clearFilters}/>
          :<RegistryEmptyState icon={Users} title={t('employeesEmptyTitle')} text={t('employeesEmptyDescription')} action={canImport?{label:t('create'),icon:Plus,onClick:()=>action(UI_ACTIONS.CREATE)}:null}/>)}
      </div>
      <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
    </section>
    {excelMode&&<EmployeeExcelDialog fields={excelFields} onClose={()=>setExcelMode(null)} onConfirm={keys=>{excelFile(keys,excelMode==='grouped');setExcelMode(null)}}/>}
    {importOpen&&<EmployeeImportDialog existing={employeeRows} language={language} onClose={()=>setImportOpen(false)} onImported={reload}/>}
  </Page>
}
// Hired in the last 12 months (by the hire date, in Athens time as a calendar day).
function isNewHire(row){if(!row.hireDate)return false;const from=new Date();from.setFullYear(from.getFullYear()-1);return String(row.hireDate).slice(0,10)>=`${from.getFullYear()}-${String(from.getMonth()+1).padStart(2,'0')}-${String(from.getDate()).padStart(2,'0')}`}
