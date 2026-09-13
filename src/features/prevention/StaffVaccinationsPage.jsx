import { useEffect,useMemo,useState } from 'react'
import { useLocation,useNavigate } from 'react-router-dom'
import { UserRoundCheck,Users } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { BackButton } from '../../design-system/BackButton'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RecordActions } from '../../design-system/RecordActions'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { ManualDateField } from '../../design-system/ManualDateField'
import { Button } from '../../design-system/Button'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { CAPABILITIES } from '../../core/permissions/roles'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useEmployeesData } from '../employees/useEmployeesData'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { createVaccinationsBulkAsync,loadAllVaccinationsAsync } from '../occupational-health/vaccinationService'
import { downloadCsv } from '../../core/export/csvExport'
import '../occupational-health/OccupationalHealthPage.css'

const VACCINES=['Εποχική γρίπη','Ηπατίτιδα Β','COVID-19','MMR','Ανεμευλογιά','Td/Tdap','Ηπατίτιδα Α','Μηνιγγιτιδόκοκκος','Άλλο']
const emptyVaccination={vaccine:'',dose:'',date:'',lotNumber:'',validUntil:'',status:'complete',clinicalNotes:''}

export function StaffVaccinationsPage(){
 const {t,language,locale}=useLanguage()
 const {notify,notifyError}=useFeedback()
 const {tenant,canAccessRecord}=useTenant()
 const navigate=useNavigate();const location=useLocation();const registry=useRegistryMemory('staff-vaccinations')
 const {data:employeeRows}=useEmployeesData()
 const [vaccinations,setVaccinations]=useState([]),[loading,setLoading]=useState(false),[editor,setEditor]=useState(null)
 const [query,setQuery]=useState(''),[department,setDepartment]=useState('all'),[status,setStatus]=useState('all')
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(15)
 const employeeMap=useMemo(()=>{const out={};for(const x of employeeRows){out[x.id]=x;if(x.dbId)out[x.dbId]=x}return out},[employeeRows])
 const departments=useMemo(()=>[...new Set(employeeRows.map(x=>language==='el'?x.department:x.departmentEn).filter(Boolean))],[employeeRows,language])
 const name=e=>!e?'—':language==='el'?`${e.lastName} ${e.firstName}`:`${e.firstNameEn||e.firstName} ${e.lastNameEn||e.lastName}`
 const fmt=v=>v?new Intl.DateTimeFormat(locale).format(new Date(`${String(v).slice(0,10)}T12:00:00`)):'—'
 const rows=useMemo(()=>vaccinations.filter(x=>Boolean(employeeMap[x.employeeId])).filter(x=>canAccessRecord(employeeMap[x.employeeId])).filter(x=>{const e=employeeMap[x.employeeId];const hay=`${e?.id??''} ${e?.firstName??''} ${e?.firstNameEn??''} ${e?.lastName??''} ${e?.lastNameEn??''} ${x.vaccine??''}`.toLowerCase();return hay.includes(query.toLowerCase())}).filter(x=>department==='all'||(language==='el'?employeeMap[x.employeeId]?.department:employeeMap[x.employeeId]?.departmentEn)===department).filter(x=>status==='all'||x.status===status),[vaccinations,employeeMap,canAccessRecord,query,department,status,language])
 const totalPages=Math.max(1,Math.ceil(rows.length/pageSize)),safePage=Math.min(page,totalPages),paged=rows.slice((safePage-1)*pageSize,safePage*pageSize)
 useEffect(()=>{setPage(1)},[query,department,status,pageSize])
 useEffect(()=>{if(!tenant?.id)return;let active=true;setLoading(true);loadAllVaccinationsAsync(tenant.id).then(data=>{if(active)setVaccinations(data)}).catch(error=>{if(active)notifyError(error,'load',{operation:'staff_vaccinations_load'})}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[tenant?.id])
 async function reload(){if(!tenant?.id)return;setLoading(true);try{setVaccinations(await loadAllVaccinationsAsync(tenant.id))}catch(error){notifyError(error,'load',{operation:'staff_vaccinations_load'})}finally{setLoading(false)}}
 function openEmployee(row){const employee=employeeMap[row.employeeId];if(!employee)return;registry.openRecord(navigate,`/employees/${encodeURIComponent(employee.id)}`,row.id,rows.map(x=>x.id),{returnState:{returnTo:'/prevention/vaccinations'}})}
 function exportRows(){downloadCsv('limoxis-staff-vaccinations.csv',[t('employee'),t('vaccine'),t('dose'),t('date'),t('validUntil'),t('status')],rows.map(x=>[name(employeeMap[x.employeeId]),x.vaccine,x.dose,x.date,x.validUntil||'',t(x.status)]));notify(t('currentListExported'),'success')}
 function pageAction(action){if(action===UI_ACTIONS.CREATE)setEditor({mode:'individual',draft:{...emptyVaccination},selectedEmployeeIds:[]});if(action===UI_ACTIONS.EXPORT)exportRows()}
 async function saveEditor(payload){try{const selected=employeeRows.filter(x=>payload.selectedEmployeeIds.includes(x.id));await createVaccinationsBulkAsync(tenant.id,selected,payload.draft);notify(language==='en'?`${selected.length} vaccination record${selected.length===1?'':'s'} saved.`:`Αποθηκεύτηκαν ${selected.length} ${selected.length===1?'εμβολιασμός':'εμβολιασμοί'}.`,'success');setEditor(null);await reload()}catch(error){notifyError(error,'save',{operation:'staff_vaccinations_create'})}}
 const returnTo=location.state?.returnTo||'/prevention'
 return <Page fill className="registry-fill-page prevention-registry-page" navigation={<BackButton onClick={()=>navigate(returnTo)} label={t('back')}/>} title={language==='en'?'Staff vaccinations':'Εμβολιασμοί προσωπικού'} subtitle={language==='en'?'Vaccination register and staff vaccination entries.':'Μητρώο και καταχώρηση εμβολιασμών προσωπικού.'} actions={<RecordActions actions={[UI_ACTIONS.CREATE,UI_ACTIONS.EXPORT]} actionCapabilities={{[UI_ACTIONS.CREATE]:CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH}} actionLabels={{[UI_ACTIONS.CREATE]:language==='en'?'Vaccination entry':'Καταχώρηση εμβολιασμού'}} onAction={pageAction}/> }>
  <section className="surface registry-workspace prevention-workspace workspace-column workspace-fill">
   <FilterBar query={query} onQueryChange={setQuery} placeholder={t('searchEmployees')} onClear={()=>{setQuery('');setDepartment('all');setStatus('all')}} activeAdvancedCount={(department!=='all'?1:0)+(status!=='all'?1:0)}><FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(x=><option key={x}>{x}</option>)}</FilterSelect><FilterSelect label={t('status')} value={status} onChange={setStatus}><option value="all">{t('all')}</option><option value="complete">{t('complete')}</option><option value="renewSoon">{t('renewSoon')}</option></FilterSelect></FilterBar>
   <div className="scroll-table" ref={registry.scrollRef}>{loading?<div className="registry-empty-state"><strong>{language==='en'?'Loading vaccinations…':'Φόρτωση εμβολιασμών…'}</strong></div>:<RegistryTable bare columns={[{key:'employee',label:t('employee')},{key:'vaccine',label:t('vaccine')},{key:'dose',label:t('dose')},{key:'date',label:t('date')},{key:'validUntil',label:t('validUntil')},{key:'status',label:t('status')}]} rows={paged} rowKey={x=>x.id} rowProps={x=>{const rp=registry.rowProps(x.id);return {...rp,className:`${rp.className} clickable-row`,onClick:()=>openEmployee(x)}}} renderRow={x=>{const e=employeeMap[x.employeeId];return <><td><strong>{name(e)}</strong><small>{e?.id||'—'}</small></td><td>{x.vaccine||'—'}</td><td>{x.dose||'—'}</td><td>{fmt(x.date)}</td><td>{fmt(x.validUntil)}</td><td><span className={`status-badge ${x.status==='complete'?'active':''}`}>{t(x.status)}</span></td></>}} emptyTitle={language==='en'?'No vaccination records':'Δεν υπάρχουν εμβολιασμοί'}/>}</div>
   <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
  </section>
  {editor&&<VaccinationEditor language={language} employees={employeeRows.filter(x=>x.employmentStatus==='active'&&canAccessRecord(x))} value={editor} onChange={setEditor} onClose={()=>setEditor(null)} onSave={saveEditor}/>} 
 </Page>
}

function VaccinationEditor({language,employees,value,onChange,onClose,onSave}){
 const en=language==='en';const {mode,draft,selectedEmployeeIds}=value;const [search,setSearch]=useState('');const [dept,setDept]=useState('all');const departments=[...new Set(employees.map(x=>en?x.departmentEn:x.department).filter(Boolean))];const filtered=employees.filter(x=>{const label=`${x.id} ${x.firstName} ${x.lastName} ${x.firstNameEn} ${x.lastNameEn}`.toLowerCase();const d=en?x.departmentEn:x.department;return label.includes(search.toLowerCase())&&(dept==='all'||d===dept)});const valid=selectedEmployeeIds.length>0&&draft.vaccine.trim()&&draft.date
 const patchDraft=patch=>onChange({...value,draft:{...draft,...patch}});const setMode=next=>onChange({...value,mode:next,selectedEmployeeIds:[]});const toggle=id=>onChange({...value,selectedEmployeeIds:selectedEmployeeIds.includes(id)?selectedEmployeeIds.filter(x=>x!==id):[...selectedEmployeeIds,id]});const selectVisible=()=>onChange({...value,selectedEmployeeIds:[...new Set([...selectedEmployeeIds,...filtered.map(x=>x.id)])]});const clearVisible=()=>onChange({...value,selectedEmployeeIds:selectedEmployeeIds.filter(id=>!filtered.some(x=>x.id===id))})
 return <ObserverDialog width="workspace" eyebrow={en?'Staff vaccination':'Εμβολιασμός προσωπικού'} title={en?'Vaccination entry':'Καταχώρηση εμβολιασμού'} subtitle={en?'Choose one employee or register the same vaccine for several selected employees.':'Επιλέξτε έναν εργαζόμενο ή καταχωρήστε το ίδιο εμβόλιο σε πολλούς επιλεγμένους εργαζομένους.'} onClose={onClose} footer={<DialogActions showCancel onCancel={onClose} onSave={()=>onSave(value)} disabled={!valid} saveLabel={en?(mode==='bulk'?`Save ${selectedEmployeeIds.length} vaccinations`:'Save vaccination'):(mode==='bulk'?`Αποθήκευση ${selectedEmployeeIds.length} εμβολιασμών`:'Αποθήκευση εμβολιασμού')}/>}>
  <div className="vaccination-editor"><div className="vaccination-entry-mode" role="group" aria-label={en?'Entry mode':'Τρόπος καταχώρησης'}><Button variant={mode==='individual'?'primary':'secondary'} onClick={()=>setMode('individual')}><UserRoundCheck size={17}/>{en?'Individual':'Μεμονωμένα'}</Button><Button variant={mode==='bulk'?'primary':'secondary'} onClick={()=>setMode('bulk')}><Users size={17}/>{en?'Bulk vaccination':'Μαζικός εμβολιασμός'}</Button></div>
   <section className="vaccination-editor-card"><h4>{en?'Vaccine details':'Στοιχεία εμβολίου'}</h4><div className="vaccination-fields"><label><span>{en?'Vaccine':'Εμβόλιο'} *</span><select value={draft.vaccine} onChange={e=>patchDraft({vaccine:e.target.value})}><option value="">{en?'Select vaccine':'Επιλέξτε εμβόλιο'}</option>{VACCINES.map(v=><option key={v} value={v}>{v}</option>)}</select></label><label><span>{en?'Dose':'Δόση'}</span><input value={draft.dose} onChange={e=>patchDraft({dose:e.target.value})} placeholder={en?'e.g. 1, 2, booster':'π.χ. 1, 2, αναμνηστική'}/></label><ManualDateField label={en?'Vaccination date *':'Ημερομηνία εμβολιασμού *'} value={draft.date} onChange={date=>patchDraft({date})}/><label><span>{en?'Lot number':'Παρτίδα'}</span><input value={draft.lotNumber} onChange={e=>patchDraft({lotNumber:e.target.value})}/></label><ManualDateField label={en?'Valid until':'Ισχύει έως'} value={draft.validUntil} onChange={validUntil=>patchDraft({validUntil})} optional/><label className="vaccination-notes"><span>{en?'Notes':'Σημειώσεις'}</span><input value={draft.clinicalNotes} onChange={e=>patchDraft({clinicalNotes:e.target.value})}/></label></div></section>
   <section className="vaccination-editor-card vaccination-employee-picker"><div className="vaccination-picker-heading"><div><h4>{mode==='bulk'?(en?'Employees to vaccinate':'Εργαζόμενοι προς εμβολιασμό'):(en?'Employee':'Εργαζόμενος')}</h4><small>{en?`${selectedEmployeeIds.length} selected`:`${selectedEmployeeIds.length} επιλεγμένοι`}</small></div>{mode==='bulk'&&<div className="vaccination-picker-actions"><Button variant="secondary" onClick={selectVisible}>{en?'Select visible':'Επιλογή εμφανιζόμενων'}</Button><Button variant="secondary" onClick={clearVisible}>{en?'Clear visible':'Καθαρισμός εμφανιζόμενων'}</Button></div>}</div>
    {mode==='individual'?<label><span>{en?'Select employee':'Επιλέξτε εργαζόμενο'}</span><select value={selectedEmployeeIds[0]||''} onChange={e=>onChange({...value,selectedEmployeeIds:e.target.value?[e.target.value]:[]})}><option value="">{en?'Select employee':'Επιλέξτε εργαζόμενο'}</option>{employees.map(e=><option key={e.id} value={e.id}>{en?`${e.firstNameEn||e.firstName} ${e.lastNameEn||e.lastName}`:`${e.lastName} ${e.firstName}`} · {en?e.departmentEn:e.department}</option>)}</select></label>:<><div className="vaccination-picker-filters"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={en?'Search employees…':'Αναζήτηση εργαζομένων…'}/><select value={dept} onChange={e=>setDept(e.target.value)}><option value="all">{en?'All departments':'Όλα τα τμήματα'}</option>{departments.map(d=><option key={d}>{d}</option>)}</select></div><div className="vaccination-employee-list">{filtered.map(e=><label key={e.id} className={selectedEmployeeIds.includes(e.id)?'selected':''}><input type="checkbox" checked={selectedEmployeeIds.includes(e.id)} onChange={()=>toggle(e.id)}/><span><strong>{en?`${e.firstNameEn||e.firstName} ${e.lastNameEn||e.lastName}`:`${e.lastName} ${e.firstName}`}</strong><small>{e.id} · {en?e.departmentEn:e.department} · {en?e.professionEn:e.profession}</small></span></label>)}</div></>}
   </section>
  </div>
 </ObserverDialog>
}
