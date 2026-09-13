import { useEffect,useMemo,useState } from 'react'
import { ClipboardCheck,Droplets,Recycle,ShieldCheck } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { RecordActions } from '../../design-system/RecordActions'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { MetricCard } from '../../design-system/MetricCard'
import { RegistryTable } from '../../design-system/RegistryTable'
import { useNavigate,useSearchParams } from 'react-router-dom'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { CAPABILITIES,can } from '../../core/permissions/roles'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { useTenant } from '../../core/tenant/TenantContext'
import { useEmployeesData } from '../employees/useEmployeesData'
import { createVaccinationsBulkAsync,loadAllVaccinationsAsync } from '../occupational-health/vaccinationService'
import { StaffVaccinationEditor,EMPTY_VACCINATION } from './StaffVaccinationEditor'
import { antisepticMethodLabel } from './AntisepticEntryModal'
import { loadHandHygieneDepartments,loadHandHygieneSessions } from './handHygieneCloudService'
import { loadAntisepticRecords,loadAntisepticSupportData } from './antisepticCloudService'
import { loadBundleAssessments,loadBundleSupportData } from './bundleCloudService'
import { loadWasteMeasurements,loadWasteSupportData } from './wasteCloudService'
import { readRegistryViewState,useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { wasteCategoryTone } from './wasteVisuals'

const tabs=[['handHygiene','handHygiene'],['waste','wasteManagement'],['antiseptics','antisepticConsumption'],['bundles','preventionBundles'],['vaccinations','vaccinations']]
const tabCapabilities={handHygiene:CAPABILITIES.RECORD_HAND_HYGIENE,waste:CAPABILITIES.RECORD_WASTE,antiseptics:CAPABILITIES.RECORD_ANTISEPTIC,bundles:CAPABILITIES.RECORD_PREVENTION_BUNDLE,vaccinations:CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH}
const createCapabilities={handHygiene:CAPABILITIES.RECORD_HAND_HYGIENE,waste:CAPABILITIES.RECORD_WASTE,antiseptics:CAPABILITIES.RECORD_ANTISEPTIC,bundles:CAPABILITIES.RECORD_PREVENTION_BUNDLE,vaccinations:CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH}
const createLabelKeys={handHygiene:'preventionNewHandHygieneLabel',waste:'preventionNewWasteLabel',antiseptics:'preventionNewAntisepticsLabel',bundles:'preventionNewBundlesLabel'}

export function PreventionPage(){
 const {t,language,locale}=useLanguage()
 const navigate=useNavigate()
 const [searchParams,setSearchParams]=useSearchParams()
 const {notify,notifyError}=useFeedback()
 const {role,membership,canAccessRecord,tenant}=useTenant()
 const {data:employeeRows}=useEmployeesData()
 const addOns=membership?.capabilities??[],custom=membership?.customCapabilities??[]
 const broadPreventionView=can(role,CAPABILITIES.VIEW_PREVENTION,[],custom)
 const tabAccess=useMemo(()=>Object.fromEntries(tabs.map(([id])=>[id,id==='vaccinations'?can(role,CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH,addOns,custom):(broadPreventionView||can(role,tabCapabilities[id],addOns,custom))])),[role,broadPreventionView,addOns,custom])
 const visibleTabs=useMemo(()=>tabs.filter(([id])=>tabAccess[id]),[tabAccess])
 const [tab,setTab]=useState(()=>searchParams.get('tab')||'handHygiene')
 const registry=useRegistryMemory(`prevention-${tab}`)
 const savedView=registry.loadViewState({query:'',department:'all',period:'all',product:'all',method:'all',status:'all'})
 const [query,setQuery]=useState(savedView.query)
 const [department,setDepartment]=useState(savedView.department)
 const [period,setPeriod]=useState(savedView.period)
 const [product,setProduct]=useState(savedView.product)
 const [method,setMethod]=useState(savedView.method)
 const [status,setStatus]=useState(savedView.status)
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(15)
 const [handRows,setHandRows]=useState([]),[handDepartments,setHandDepartments]=useState([]),[handLoading,setHandLoading]=useState(false)
 const [wasteRows,setWasteRows]=useState([]),[wasteSupport,setWasteSupport]=useState({departments:[],wasteTypes:[]}),[wasteLoading,setWasteLoading]=useState(false)
 const [antisepticRows,setAntisepticRows]=useState([]),[antisepticSupport,setAntisepticSupport]=useState({departments:[],products:[]}),[antisepticLoading,setAntisepticLoading]=useState(false)
 const [bundleRows,setBundleRows]=useState([]),[bundleSupport,setBundleSupport]=useState({departments:[],templates:[]}),[bundleLoading,setBundleLoading]=useState(false)
 const [vaccinationRows,setVaccinationRows]=useState([]),[vaccinationLoading,setVaccinationLoading]=useState(false),[vaccinationEditor,setVaccinationEditor]=useState(null)
 const employeeMap=useMemo(()=>{const out={};for(const x of employeeRows){out[x.id]=x;if(x.dbId)out[x.dbId]=x}return out},[employeeRows])
 const createCapability=createCapabilities[tab]
 const canCreateRecord=Boolean(createCapability)&&can(role,createCapability,addOns,custom)
 const source=tab==='handHygiene'?handRows:tab==='waste'?wasteRows:tab==='antiseptics'?antisepticRows:tab==='bundles'?bundleRows:vaccinationRows
 const departments=useMemo(()=>{
  if(tab==='handHygiene')return handDepartments.map(x=>language==='el'?x.el:(x.en||x.el))
  if(tab==='waste')return wasteSupport.departments.map(x=>language==='el'?x.el:(x.en||x.el))
  if(tab==='antiseptics')return antisepticSupport.departments.map(x=>language==='el'?x.el:(x.en||x.el))
  if(tab==='bundles')return bundleSupport.departments.map(x=>language==='el'?x.el:(x.en||x.el))
  return [...new Set(employeeRows.map(x=>language==='el'?x.department:x.departmentEn).filter(Boolean))]
 },[tab,handDepartments,wasteSupport.departments,antisepticSupport.departments,bundleSupport.departments,employeeRows,language])
 const rows=useMemo(()=>{
  if(tab==='vaccinations')return source.filter(x=>Boolean(employeeMap[x.employeeId])).filter(x=>canAccessRecord(employeeMap[x.employeeId])).filter(x=>{const e=employeeMap[x.employeeId];const hay=`${e?.id??''} ${e?.firstName??''} ${e?.firstNameEn??''} ${e?.lastName??''} ${e?.lastNameEn??''} ${x.vaccine??''}`.toLowerCase();return hay.includes(query.toLowerCase())}).filter(x=>department==='all'||(language==='el'?employeeMap[x.employeeId]?.department:employeeMap[x.employeeId]?.departmentEn)===department).filter(x=>status==='all'||x.status===status)
  return source.filter(x=>x.lifecycleStatus!=='voided').filter(x=>canAccessRecord({...x,department:x.departmentEl})).filter(x=>JSON.stringify(x).toLowerCase().includes(query.toLowerCase())).filter(x=>department==='all'||(language==='el'?x.departmentEl:x.departmentEn)===department).filter(x=>period==='all'||x.period===period).filter(x=>product==='all'||x.product===product).filter(x=>method==='all'||x.method===method)
 },[tab,source,employeeMap,query,department,period,product,method,status,language,canAccessRecord])

 useEffect(()=>{setPage(1)},[tab,query,department,period,product,method,status,pageSize])
 useEffect(()=>{if(!visibleTabs.length)return;if(visibleTabs.some(([id])=>id===tab))return;const nextTab=visibleTabs[0][0];setTab(nextTab);setSearchParams({tab:nextTab},{replace:true})},[tab,visibleTabs,setSearchParams])
 useEffect(()=>{if(!tenant?.id)return;if(tabAccess.handHygiene)void reloadHandHygiene();else{setHandRows([]);setHandDepartments([])}if(tabAccess.waste)void reloadWaste();else{setWasteRows([]);setWasteSupport({departments:[],wasteTypes:[]})}if(tabAccess.antiseptics)void reloadAntiseptics();else{setAntisepticRows([]);setAntisepticSupport({departments:[],products:[]})}if(tabAccess.bundles)void reloadBundles();else{setBundleRows([]);setBundleSupport({departments:[],templates:[]})}if(tabAccess.vaccinations)void reloadVaccinations();else setVaccinationRows([])},[tenant?.id,tabAccess.handHygiene,tabAccess.waste,tabAccess.antiseptics,tabAccess.bundles,tabAccess.vaccinations])
 const totalPages=Math.max(1,Math.ceil(rows.length/pageSize)),safePage=Math.min(page,totalPages),pagedRows=rows.slice((safePage-1)*pageSize,safePage*pageSize)
 const avg=handRows.length?handRows.reduce((sum,x)=>sum+x.rate,0)/handRows.length:0
 const fmtDate=v=>v?new Intl.DateTimeFormat(locale).format(new Date(`${String(v).slice(0,10)}T12:00:00`)):'—'
 const createLabel=tab==='vaccinations'?(language==='en'?'New vaccination entry':'Νέα καταχώρηση εμβολιασμού'):((createLabelKeys[tab]&&t(createLabelKeys[tab]))||t('preventionNewRecordFallback'))
 async function reloadHandHygiene(){if(!tenant?.id||!tabAccess.handHygiene){setHandRows([]);setHandDepartments([]);return}setHandLoading(true);try{const [records,depts]=await Promise.all([loadHandHygieneSessions(tenant.id),loadHandHygieneDepartments(tenant.id)]);setHandRows(records);setHandDepartments(depts)}catch(error){notifyError(error,'load',{operation:'hand_hygiene_load'})}finally{setHandLoading(false)}}
 async function reloadWaste(){if(!tenant?.id||!tabAccess.waste){setWasteRows([]);setWasteSupport({departments:[],wasteTypes:[]});return}setWasteLoading(true);try{const [records,support]=await Promise.all([loadWasteMeasurements(tenant.id),loadWasteSupportData(tenant.id)]);setWasteRows(records);setWasteSupport(support)}catch(error){notifyError(error,'load',{operation:'waste_load'})}finally{setWasteLoading(false)}}
 async function reloadAntiseptics(){if(!tenant?.id||!tabAccess.antiseptics){setAntisepticRows([]);setAntisepticSupport({departments:[],products:[]});return}setAntisepticLoading(true);try{const [records,support]=await Promise.all([loadAntisepticRecords(tenant.id),loadAntisepticSupportData(tenant.id)]);setAntisepticRows(records);setAntisepticSupport(support)}catch(error){notifyError(error,'load',{operation:'antiseptic_load'})}finally{setAntisepticLoading(false)}}
 async function reloadBundles(){if(!tenant?.id||!tabAccess.bundles){setBundleRows([]);setBundleSupport({departments:[],templates:[]});return}setBundleLoading(true);try{const [records,support]=await Promise.all([loadBundleAssessments(tenant.id),loadBundleSupportData(tenant.id)]);setBundleRows(records);setBundleSupport(support)}catch(error){notifyError(error,'load',{operation:'bundle_load'})}finally{setBundleLoading(false)}}
 async function reloadVaccinations(){if(!tenant?.id||!tabAccess.vaccinations){setVaccinationRows([]);return}setVaccinationLoading(true);try{setVaccinationRows(await loadAllVaccinationsAsync(tenant.id))}catch(error){notifyError(error,'load',{operation:'staff_vaccinations_load'})}finally{setVaccinationLoading(false)}}
 function changeTab(id){if(!tabAccess[id])return;registry.saveViewState({tab,query,department,period,product,method,status});const next=readRegistryViewState(`prevention-${id}`);setTab(id);setQuery(next?.query||'');setDepartment(next?.department||'all');setPeriod(next?.period||'all');setProduct(next?.product||'all');setMethod(next?.method||'all');setStatus(next?.status||'all');setSearchParams({tab:id},{replace:true})}
 function openPreventionRecord(id,type){if(!tabAccess[type])return;registry.saveViewState({tab:type,query,department,period,product,method,status});registry.openRecord(navigate,`/prevention/${type}/${id}?fromTab=${type}`,id,rows.map(x=>x.id),{returnState:{tab:type}})}
 function openVaccinationEmployee(row){const employee=employeeMap[row.employeeId];if(!employee)return;registry.saveViewState({tab:'vaccinations',query,department,period,product,method,status});registry.openRecord(navigate,`/employees/${encodeURIComponent(employee.id)}`,row.id,rows.map(x=>x.id),{returnState:{returnTo:'/prevention?tab=vaccinations'}})}
 function createRecord(){if(!canCreateRecord)return;if(tab==='vaccinations'){setVaccinationEditor({mode:'individual',draft:{...EMPTY_VACCINATION},selectedEmployeeIds:[]});return}navigate(`/prevention/${tab}/new?fromTab=${tab}`)}
 function pageAction(action){if(action===UI_ACTIONS.CREATE)createRecord()}
 async function saveVaccination(payload){try{const selected=employeeRows.filter(x=>payload.selectedEmployeeIds.includes(x.id));await createVaccinationsBulkAsync(tenant.id,selected,payload.draft);notify(language==='en'?`${selected.length} vaccination record${selected.length===1?'':'s'} saved.`:`Αποθηκεύτηκαν ${selected.length} ${selected.length===1?'εμβολιασμός':'εμβολιασμοί'}.`,'success');setVaccinationEditor(null);await reloadVaccinations()}catch(error){notifyError(error,'save',{operation:'staff_vaccinations_create'})}}
 const loading=tab==='handHygiene'?handLoading:tab==='waste'?wasteLoading:tab==='antiseptics'?antisepticLoading:tab==='bundles'?bundleLoading:vaccinationLoading
 const pageActions=canCreateRecord?[UI_ACTIONS.CREATE]:[]
 const actionCapabilities={[UI_ACTIONS.CREATE]:createCapability}
 return <Page fill className="prevention-registry-page" title={t('preventionCenter')} subtitle={t('preventionSubtitle')} actions={pageActions.length?<RecordActions actions={pageActions} actionCapabilities={actionCapabilities} actionLabels={{[UI_ACTIONS.CREATE]:createLabel}} onAction={pageAction}/>:null}>
  <div className="workspace-summary prevention-summary"><div className="module-summary-strip">{tabAccess.handHygiene&&<Kpi icon={ShieldCheck} value={`${avg.toFixed(1)}%`} label={t('whoCompliance')}/>} {tabAccess.bundles&&<Kpi icon={ClipboardCheck} value={bundleRows.length} label={t('activeBundles')}/>} {tabAccess.waste&&<Kpi icon={Recycle} value={`${wasteRows.reduce((s,x)=>s+x.weight,0).toFixed(1)} kg`} label={t('wasteRecorded')}/>} {tabAccess.antiseptics&&<Kpi icon={Droplets} value={`${antisepticRows.reduce((s,x)=>s+x.litres,0).toFixed(1)} L`} label={t('antisepticRecorded')}/>}</div></div>
  <div className="surface registry-workspace prevention-workspace workspace-fill"><nav className="tabs prevention-tabs canonical-module-tabs">{visibleTabs.map(([id,key])=><button key={id} className={`tab ${tab===id?'active':''}`} onClick={()=>changeTab(id)}>{t(key)}</button>)}</nav>
   <FilterBar query={query} onQueryChange={setQuery} placeholder={tab==='vaccinations'?t('searchEmployees'):t('searchPrevention')} onClear={()=>{setQuery('');setDepartment('all');setPeriod('all');setProduct('all');setMethod('all');setStatus('all')}} advanced={tab==='antiseptics'?<><FilterSelect label={t('period')} value={period} onChange={setPeriod}><option value="all">{t('all')}</option>{[...new Set(source.map(x=>x.period).filter(Boolean))].map(x=><option key={x} value={x}>{x}</option>)}</FilterSelect><FilterSelect label={t('productFilter')} value={product} onChange={setProduct}><option value="all">{t('allProducts')}</option>{[...new Set(source.map(x=>x.product).filter(Boolean))].map(x=><option key={x} value={x}>{x}</option>)}</FilterSelect><FilterSelect label={t('dataSource')} value={method} onChange={setMethod}><option value="all">{t('allDataSources')}</option>{[...new Set(source.map(x=>x.method).filter(Boolean))].map(x=><option key={x} value={x}>{antisepticMethodLabel(x,language)}</option>)}</FilterSelect></>:tab==='bundles'?<FilterSelect label={t('period')} value={period} onChange={setPeriod}><option value="all">{t('all')}</option>{[...new Set(source.map(x=>x.period).filter(Boolean))].map(x=><option key={x} value={x}>{x}</option>)}</FilterSelect>:tab==='vaccinations'?<FilterSelect label={t('status')} value={status} onChange={setStatus}><option value="all">{t('all')}</option><option value="complete">{t('complete')}</option><option value="renewSoon">{t('renewSoon')}</option></FilterSelect>:null} activeAdvancedCount={(department!=='all'?1:0)+(period!=='all'?1:0)+(product!=='all'?1:0)+(method!=='all'?1:0)+(status!=='all'?1:0)}><FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(x=><option key={x}>{x}</option>)}</FilterSelect></FilterBar>
   <div className="scroll-table" ref={registry.scrollRef}>{loading&&<div className="registry-empty-state"><strong>{tab==='vaccinations'?(language==='en'?'Loading vaccinations…':'Φόρτωση εμβολιασμών…'):t('preventionLoadingRecords')}</strong></div>}{tab==='handHygiene'&&!loading&&<HandTable rows={pagedRows} t={t} language={language} fmtDate={fmtDate} onOpen={id=>openPreventionRecord(id,'handHygiene')} registry={registry}/>} {tab==='waste'&&!loading&&<WasteTable rows={pagedRows} t={t} language={language} fmtDate={fmtDate} onOpen={id=>openPreventionRecord(id,'waste')} registry={registry}/>} {tab==='antiseptics'&&!loading&&<AntisepticTable rows={pagedRows} t={t} language={language} onOpen={id=>openPreventionRecord(id,'antiseptics')} registry={registry}/>} {tab==='bundles'&&!loading&&<BundleTable rows={pagedRows} t={t} language={language} onOpen={id=>openPreventionRecord(id,'bundles')} registry={registry}/>} {tab==='vaccinations'&&!loading&&<VaccinationTable rows={pagedRows} t={t} language={language} fmtDate={fmtDate} employeeMap={employeeMap} onOpen={openVaccinationEmployee} registry={registry}/>} {!loading&&!rows.length&&<PreventionEmpty t={t} tab={tab} language={language}/>}</div>
   <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
  </div>
  {vaccinationEditor&&<StaffVaccinationEditor language={language} employees={employeeRows.filter(x=>x.employmentStatus==='active'&&canAccessRecord(x))} value={vaccinationEditor} onChange={setVaccinationEditor} onClose={()=>setVaccinationEditor(null)} onSave={saveVaccination}/>} 
 </Page>
}
function Kpi({icon:Icon,value,label}){return <MetricCard icon={Icon} value={value} label={label}/>}
const preventionEmptyTitleKeys={handHygiene:'preventionEmptyHandHygieneTitle',waste:'preventionEmptyWasteTitle',antiseptics:'preventionEmptyAntisepticsTitle',bundles:'preventionEmptyBundlesTitle'}
function PreventionEmpty({t,tab,language}){return <div className="registry-empty-state"><strong>{tab==='vaccinations'?(language==='en'?'No vaccination records':'Δεν υπάρχουν εμβολιασμοί'):t(preventionEmptyTitleKeys[tab])}</strong><span>{t('preventionEmptyGenericText')}</span></div>}
function rowPropsWithOpen(registry,id,onOpen){const rp=registry.rowProps(id);return {...rp,className:`${rp.className} clickable-row`,onClick:()=>onOpen(id)}}
function HandTable({rows,t,language,fmtDate,onOpen,registry}){return <RegistryTable bare
  columns={[{key:'date',label:t('date')},{key:'department',label:t('department')},{key:'profession',label:t('professionalCategory')},{key:'observations',label:t('observations')},{key:'compliant',label:t('compliant')},{key:'compliance',label:t('compliance')},{key:'observer',label:t('observer')}]}
  rows={rows} rowKey={x=>x.id} rowProps={x=>rowPropsWithOpen(registry,x.id,onOpen)}
  renderRow={x=><><td>{fmtDate(x.date)}</td><td>{language==='el'?x.departmentEl:x.departmentEn}</td><td>{t(x.profession)}</td><td>{x.observations}</td><td>{x.compliant}</td><td><strong>{x.rate}%</strong></td><td>{x.observer}</td></>}
/>}
function WasteTable({rows,t,language,fmtDate,onOpen,registry}){return <RegistryTable bare
  columns={[{key:'date',label:t('date')},{key:'department',label:t('department')},{key:'category',label:t('exportCategory')},{key:'weight',label:t('weight')},{key:'containers',label:t('containers')},{key:'indicator',label:t('indicator')},{key:'document',label:t('documentNumber')}]}
  rows={rows} rowKey={x=>x.id} rowProps={x=>rowPropsWithOpen(registry,x.id,onOpen)}
  renderRow={x=>{const category=x.wasteType||x.type;return <><td>{fmtDate(x.date)}</td><td>{language==='el'?x.departmentEl:x.departmentEn}</td><td><span className={`waste-category-badge ${wasteCategoryTone(category)}`}>{language==='el'?category:(x.typeEn||category)}</span></td><td>{Number(x.weight).toLocaleString(localeFromLanguage(language))} kg</td><td>{x.containers}</td><td>{x.indicator!=null?<><strong>{Number(x.indicator).toLocaleString(localeFromLanguage(language))}</strong><small className="table-cell-unit"> kg / 1.000</small></>:'—'}</td><td>{x.documentNumber||'—'}</td></>}}
/>}
function AntisepticTable({rows,t,language,onOpen,registry}){return <RegistryTable bare
  columns={[{key:'period',label:t('period')},{key:'department',label:t('department')},{key:'product',label:t('product')},{key:'litres',label:t('consumptionLitres')},{key:'patientDays',label:t('patientDays')},{key:'indicator',label:`${t('indicator')} ABHR`},{key:'source',label:t('dataSourceShort')}]}
  rows={rows} rowKey={x=>x.id} rowProps={x=>rowPropsWithOpen(registry,x.id,onOpen)}
  renderRow={x=><><td>{x.period}</td><td>{language==='el'?x.departmentEl:x.departmentEn}</td><td><strong>{language==='el'?x.product:(x.productEn||x.product)}</strong>{x.indicatorEligible===false&&<small className="table-cell-unit">{t('notApplicable')} ABHR</small>}</td><td><strong>{Number(x.litres).toLocaleString(localeFromLanguage(language))} L</strong></td><td>{x.patientDays||'—'}</td><td>{x.indicator!=null?<><strong>{Number(x.indicator).toLocaleString(localeFromLanguage(language))}</strong><small className="table-cell-unit"> L / 1.000</small></>:'—'}</td><td><span className={`antiseptic-method-badge ${x.method||'other'}`}>{antisepticMethodLabel(x.method,language)}</span></td></>}
/>}
function BundleTable({rows,t,language,onOpen,registry}){return <RegistryTable bare
  columns={[{key:'date',label:t('date')},{key:'bundle',label:t('bundle')},{key:'department',label:t('department')},{key:'context',label:t('context')},{key:'score',label:t('score')},{key:'allOrNone',label:t('allOrNone')},{key:'deviations',label:t('deviations')}]}
  rows={rows} rowKey={x=>x.id} rowProps={x=>rowPropsWithOpen(registry,x.id,onOpen)}
  renderRow={x=><><td>{x.date||x.period}</td><td><strong>{x.templateName||x.bundle}</strong><small className="table-cell-unit">v{x.templateVersion||'1.0'}</small></td><td>{language==='el'?x.departmentEl:x.departmentEn}</td><td>{x.shift||'—'}</td><td><strong>{x.score==null?'—':`${x.score}%`}</strong></td><td><span className={`bundle-all-badge ${x.allOrNone?'passed':'failed'}`}>{x.allOrNone?t('yes'):t('no')}</span></td><td>{(x.failedCount??x.findings?.length??0)>0?<span className="bundle-finding-count">{x.failedCount??x.findings?.length}</span>:'—'}</td></>}
/>}
function VaccinationTable({rows,t,language,fmtDate,employeeMap,onOpen,registry}){const name=e=>!e?'—':language==='el'?`${e.lastName} ${e.firstName}`:`${e.firstNameEn||e.firstName} ${e.lastNameEn||e.lastName}`;return <RegistryTable bare
  columns={[{key:'employee',label:t('employee')},{key:'vaccine',label:t('vaccine')},{key:'dose',label:t('dose')},{key:'date',label:t('date')},{key:'validUntil',label:t('validUntil')},{key:'status',label:t('status')}]}
  rows={rows} rowKey={x=>x.id} rowProps={x=>{const rp=registry.rowProps(x.id);return {...rp,className:`${rp.className} clickable-row`,onClick:()=>onOpen(x)}}}
  renderRow={x=>{const e=employeeMap[x.employeeId];return <><td><strong>{name(e)}</strong><small>{e?.id||'—'}</small></td><td>{x.vaccine||'—'}</td><td>{x.dose||'—'}</td><td>{fmtDate(x.date)}</td><td>{fmtDate(x.validUntil)}</td><td><span className={`status-badge ${x.status==='complete'?'active':''}`}>{t(x.status)}</span></td></>}}
/>}
function localeFromLanguage(language){return language==='en'?'en-GB':'el-GR'}