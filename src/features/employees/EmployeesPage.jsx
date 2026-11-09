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
import { ExcelFieldsDialog } from '../../design-system/ExcelFieldsDialog'
import { EmployeeAvatar, useEmployeePhotoUrls } from './EmployeePhoto'
import { STAFF_CATEGORIES, isStaffEmployee, staffCategoryLabel, staffCategoryOf } from './staffCategory'
import { RegistryTotals } from '../../design-system/RegistryTotals'
import { loadDepartments } from '../management/departmentsService'

export function EmployeesPage(){
  const {t,language}=useLanguage(); const navigate=useNavigate(); const {canAccessRecord,role,membership,tenant,isDemo}=useTenant()
  const {data:employeeRows,loading,error,reload}=useEmployeesData()
  const registry=useRegistryMemory('employees')
  const {notify}=useFeedback()
  const saved=registry.loadViewState({query:'',department:'all',status:'all',category:'all'})
  const [query,setQuery]=useState(saved.query); const [department,setDepartment]=useState(saved.department); const [status,setStatus]=useState(saved.status); const [category,setCategory]=useState(saved.category||'all')
  const [importOpen,setImportOpen]=useState(false)
  const [excelMode,setExcelMode]=useState(null)
  // The occupational physician sees each employee's latest completed visit and its fitness in the list.
  const showHealth=role===ROLES.OCCUPATIONAL_PHYSICIAN
  const [visits,setVisits]=useState([])
  useEffect(()=>{if(!showHealth)return;let live=true;loadAllOccupationalVisitsAsync(tenant?.id).then(rows=>{if(live)setVisits(rows)}).catch(()=>{});return()=>{live=false}},[showHealth,tenant?.id])
  const lastVisitOf=useMemo(()=>{const latest=new Map();for(const v of visits){if(v.status!=='completed')continue;const prev=latest.get(v.employeeId);if(!prev||String(v.date)>String(prev.date))latest.set(v.employeeId,v)}return x=>latest.get(x.dbId)||latest.get(x.id)||null},[visits])
  const canImport=can(role,CAPABILITIES.MANAGE_STAFF_ADMIN,membership?.capabilities??[],membership?.customCapabilities??[])
  const [page,setPage]=useState(1); const [pageSize,setPageSize]=useState(15)
  // Every department of the hospital, also those without employees yet, and in alphabetical order (owner, 9/11/2026).
  const [hospitalDepartments,setHospitalDepartments]=useState([])
  useEffect(()=>{if(isDemo||!tenant?.id)return;let live=true;loadDepartments(tenant.id).then(rows=>{if(live)setHospitalDepartments((rows||[]).filter(row=>row.is_active!==false).map(row=>row.name))}).catch(()=>{});return()=>{live=false}},[isDemo,tenant?.id])
  const departments=useMemo(()=>{const names=new Map();for(const name of [...employeeRows.map(x=>language==='el'?x.department:x.departmentEn),...(language==='el'?hospitalDepartments:[])].filter(Boolean)){const key=String(name).trim().toLocaleLowerCase('el');if(!names.has(key))names.set(key,String(name).trim())}return [...names.values()].sort((a,b)=>a.localeCompare(b,language==='el'?'el':'en',{sensitivity:'base'}))},[employeeRows,language,hospitalDepartments])
  const rows=useMemo(()=>employeeRows.filter(x=>canAccessRecord(x)).filter(x=>`${x.id} ${x.firstName} ${x.firstNameEn} ${x.lastName} ${x.lastNameEn} ${x.email}`.toLowerCase().includes(query.toLowerCase())).filter(x=>department==='all'||String((language==='el'?x.department:x.departmentEn)||'').trim().toLocaleLowerCase('el')===department.toLocaleLowerCase('el')).filter(x=>status==='all'||(status==='new'?isNewHire(x):x.employmentStatus===status)).filter(x=>category==='all'||staffCategoryOf(x)===category),[employeeRows,query,department,status,category,language,canAccessRecord])
  useEffect(()=>setPage(1),[query,department,status,category,pageSize])
  const photoUrls=useEmployeePhotoUrls(useMemo(()=>rows.slice((page-1)*pageSize,page*pageSize),[rows,page,pageSize]))
  if(loading)return <RouteLoading/>
  if(error)return <div className="data-access-state error" role="alert"><span>{t('employeesLoadFailed')}</span><button type="button" onClick={reload}>{t('retry')}</button></div>
  const displayName=x=>language==='el'?`${x.lastName} ${x.firstName}`:`${x.firstNameEn} ${x.lastNameEn}`
  const scopedEmployees=employeeRows.filter(x=>canAccessRecord(x))
  const totalPages=Math.max(1,Math.ceil(rows.length/pageSize)); const safePage=Math.min(page,totalPages); const pagedRows=rows.slice((safePage-1)*pageSize,safePage*pageSize)
  function openEmployee(row){registry.saveViewState({query,department,status,category});registry.openRecord(navigate,`/employees/${encodeURIComponent(row.id)}`,row.id,rows.map(item=>item.id))}
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
    {key:'staffCategory',label:t('employeesRecords.staffCategory'),initial:false,value:x=>staffCategoryLabel(staffCategoryOf(x),language)},
    {key:'mobile',label:t('employeesRecords.exportMobile'),initial:true,value:x=>x.phone||''},
    {key:'email',label:t('employeesRecords.exportEmail'),initial:false,value:x=>x.email||''},
    {key:'hrDepartment',label:t('employeesRecords.exportHrDepartment'),initial:false,value:x=>x.hrDepartment||''},
    {key:'directorate',label:t('employeesRecords.exportDirectorate'),initial:false,value:x=>x.directorate||''},
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
    {id:'grouped-print',kind:'print',label:t('employeesRecords.exportPrintByDepartment'),onClick:()=>printGrouped(false)},
    {id:'employees-excel',kind:'excel',label:t('exportFields.menuLabel'),onClick:()=>setExcelMode(true)},
  ]}/>
  // The counts of the list as filtered, beside the search; each one sets (or clears) its filter.
  const toggleStatus=value=>setStatus(current=>current===value?'all':value)
  const toggleCategory=value=>setCategory(current=>current===value?'all':value)
  const totals=<RegistryTotals label={t('employeesRecords.totals')} items={[
    {key:'all',always:true,value:rows.length,label:t('employeesRecords.totalPeople')},
    {key:'active',value:rows.filter(x=>x.employmentStatus==='active').length,label:t('employeesRecords.totalActive'),active:status==='active',onClick:()=>toggleStatus('active')},
    {key:'inactive',value:rows.filter(x=>x.employmentStatus==='inactive').length,label:t('employeesRecords.totalInactive'),active:status==='inactive',onClick:()=>toggleStatus('inactive')},
    {key:'new',value:rows.filter(isNewHire).length,label:t('employeesRecords.totalNew'),active:status==='new',onClick:()=>toggleStatus('new')},
    {key:'physician',value:rows.filter(x=>staffCategoryOf(x)==='physician').length,label:t('employeesRecords.totalPhysicians'),active:category==='physician',onClick:()=>toggleCategory('physician')},
    {key:'external',value:rows.filter(x=>staffCategoryOf(x)==='external').length,label:t('employeesRecords.totalExternal'),active:category==='external',onClick:()=>toggleCategory('external')},
  ]}/>
  function clearFilters(){setQuery('');setDepartment('all');setStatus('all');setCategory('all')}
  function action(a){if(a===UI_ACTIONS.CREATE){registry.saveViewState({query,department,status,category});navigate('/employees/new')}}
  return <Page fill className="employees-registry-page" title={t('employees')} subtitle={t(showHealth?'employeesRecords.registrySubtitlePhysician':'employeesRecords.employeesRegistrySubtitle')} actions={<div className="row-actions">{exportMenu}{canImport&&<Button variant="secondary" onClick={()=>setImportOpen(true)}><Upload size={15}/>{t('employeesImportAction')}</Button>}<RecordActions actions={[UI_ACTIONS.CREATE]} actionCapabilities={{[UI_ACTIONS.CREATE]:CAPABILITIES.MANAGE_STAFF_ADMIN}} onAction={action}/></div> }>
    <section className="surface registry-workspace workspace-column workspace-fill employee-registry-shell">
      <FilterBar query={query} onQueryChange={setQuery} placeholder={t('searchEmployees')} end={totals} activeAdvancedCount={(department!=='all'?1:0)+(status!=='all'?1:0)+(category!=='all'?1:0)} onClear={clearFilters}>
        <FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(x=><option key={x}>{x}</option>)}</FilterSelect>
        <FilterSelect label={t('status')} value={status} onChange={setStatus}><option value="all">{t('all')}</option><option value="active">{t('active')}</option><option value="inactive">{t('inactive')}</option><option value="new">{t('employeesRecords.newHires')}</option></FilterSelect>
        <FilterSelect label={t('employeesRecords.staffCategory')} value={category} onChange={setCategory}><option value="all">{t('all')}</option>{STAFF_CATEGORIES.map(item=><option key={item.value} value={item.value}>{staffCategoryLabel(item.value,language)}</option>)}</FilterSelect>
      </FilterBar>
      <div className="scroll-table" ref={registry.scrollRef}>
        <table className="data-table sticky-table"><thead><tr><th>{t('name')}</th><th>{t('employeeCode')}</th><th>{t('department')}</th><th>{t('professionalCategory')}</th>{showHealth&&<th>{t('employeesRecords.lastVisit')}</th>}{showHealth&&<th>{t('employeesRecords.fitnessForWork')}</th>}<th>{t('status')}</th></tr></thead><tbody>{pagedRows.map(x=><tr key={x.id} {...registry.rowProps(x.id)} onClick={()=>openEmployee(x)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openEmployee(x)}}}><td><div className="employee-registry-person"><EmployeeAvatar employee={x} url={x.photoPath?photoUrls[x.photoPath]:''}/><div><strong className="employee-registry-name">{displayName(x)}</strong>{!isStaffEmployee(x)&&<span className="status-badge">{staffCategoryLabel(staffCategoryOf(x),language)}</span>}<small>{x.email}</small></div></div></td><td className="nowrap-cell"><strong>{x.id}</strong></td><td>{language==='el'?x.department:x.departmentEn}</td><td>{language==='el'?x.profession:x.professionEn}{x.position&&<small>{language==='el'?x.position:(x.positionEn||x.position)}</small>}</td>{showHealth&&<td className="nowrap-cell">{lastVisitOf(x)?new Intl.DateTimeFormat(language==='en'?'en-GB':'el-GR').format(new Date(`${String(lastVisitOf(x).date).slice(0,10)}T12:00:00`)):'—'}</td>}{showHealth&&<td>{lastVisitOf(x)?fitnessLabel(lastVisitOf(x).fitStatus,language):'—'}</td>}<td><span className={`status-badge ${x.employmentStatus==='active'?'active':''}`}>{t(x.employmentStatus)}</span></td></tr>)}</tbody></table>
        {!rows.length&&(scopedEmployees.length
          ?<RegistryEmptyState filtered onClearFilters={clearFilters}/>
          :<RegistryEmptyState icon={Users} title={t('employeesEmptyTitle')} text={t('employeesEmptyDescription')} action={canImport?{label:t('create'),icon:Plus,onClick:()=>action(UI_ACTIONS.CREATE)}:null}/>)}
      </div>
      <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
    </section>
    {excelMode&&<ExcelFieldsDialog storageKey="limoxis.employees.excel" fields={excelFields} layouts={[{value:'list',label:t('exportFields.layoutList')},{value:'grouped',label:t('employeesRecords.exportByDepartment')}]} onClose={()=>setExcelMode(null)} onConfirm={(keys,layout)=>{excelFile(keys,layout==='grouped');setExcelMode(null)}}/>}
    {importOpen&&<EmployeeImportDialog existing={employeeRows} language={language} onClose={()=>setImportOpen(false)} onImported={reload}/>}
  </Page>
}
// Hired in the last 12 months (by the hire date, in Athens time as a calendar day).
function isNewHire(row){if(!row.hireDate)return false;const from=new Date();from.setFullYear(from.getFullYear()-1);return String(row.hireDate).slice(0,10)>=`${from.getFullYear()}-${String(from.getMonth()+1).padStart(2,'0')}-${String(from.getDate()).padStart(2,'0')}`}
