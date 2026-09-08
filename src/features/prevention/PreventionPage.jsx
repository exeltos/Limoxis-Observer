import { useEffect,useMemo,useState } from 'react'
import { ClipboardCheck,Droplets,Plus,Recycle,ShieldCheck } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { ActionButton } from '../../design-system/ActionButton'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { MetricCard } from '../../design-system/MetricCard'
import { useNavigate,useSearchParams } from 'react-router-dom'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { CAPABILITIES,ROLES,can } from '../../core/permissions/roles'
import { useTenant } from '../../core/tenant/TenantContext'
import { PreventionEntryModal } from './PreventionEntryModal'
import { AntisepticEntryModal,antisepticMethodLabel } from './AntisepticEntryModal'
import { BundleExecutionModal } from './BundleExecutionModal'
import { loadHandHygieneDepartments,loadHandHygieneSessions } from './handHygieneCloudService'
import { findPatientDaysForPeriod,loadAntisepticRecords,loadAntisepticSupportData,saveAntisepticRecord } from './antisepticCloudService'
import { loadBundleAssessments,loadBundleSupportData,saveBundleAssessment } from './bundleCloudService'
import { loadWasteMeasurements,loadWasteSupportData } from './wasteCloudService'
import { readRegistryViewState,useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { wasteCategoryTone } from './wasteVisuals'

const tabs=[['handHygiene','handHygiene'],['waste','wasteManagement'],['antiseptics','antisepticConsumption'],['bundles','preventionBundles']]
const createLabels={
 handHygiene:{el:'Νέα παρατήρηση',en:'New observation'},
 waste:{el:'Νέα καταγραφή',en:'New entry'},
 antiseptics:{el:'Νέα κατανάλωση',en:'New consumption'},
 bundles:{el:'Νέα αξιολόγηση',en:'New assessment'},
}

export function PreventionPage(){
 const {t,language,locale}=useLanguage()
 const navigate=useNavigate()
 const [searchParams,setSearchParams]=useSearchParams()
 const {notify,notifyError}=useFeedback()
 const {role,membership,canAccessRecord,tenant}=useTenant()
 const addOns=membership?.capabilities??[],custom=membership?.customCapabilities??[]
 const [tab,setTab]=useState(()=>searchParams.get('tab')||'handHygiene')
 const registry=useRegistryMemory(`prevention-${tab}`)
 const savedView=registry.loadViewState({query:'',department:'all',period:'all',product:'all',method:'all'})
 const [query,setQuery]=useState(savedView.query)
 const [department,setDepartment]=useState(savedView.department)
 const [period,setPeriod]=useState(savedView.period)
 const [product,setProduct]=useState(savedView.product)
 const [method,setMethod]=useState(savedView.method)
 const [entryOpen,setEntryOpen]=useState(false)
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(15)
 const [handRows,setHandRows]=useState([]),[handDepartments,setHandDepartments]=useState([]),[handLoading,setHandLoading]=useState(false)
 const [wasteRows,setWasteRows]=useState([]),[wasteSupport,setWasteSupport]=useState({departments:[],wasteTypes:[]}),[wasteLoading,setWasteLoading]=useState(false)
 const [antisepticRows,setAntisepticRows]=useState([]),[antisepticSupport,setAntisepticSupport]=useState({departments:[],products:[]}),[antisepticLoading,setAntisepticLoading]=useState(false)
 const [bundleRows,setBundleRows]=useState([]),[bundleSupport,setBundleSupport]=useState({departments:[],templates:[]}),[bundleLoading,setBundleLoading]=useState(false)
 const ownDepartment=membership?.previewDepartment||membership?.departmentName||membership?.department||''
 const departmentScoped=[ROLES.DEPARTMENT_MANAGER,ROLES.DEPARTMENT_USER,ROLES.LINK_NURSE].includes(role)
 const createCapability=tab==='handHygiene'?CAPABILITIES.RECORD_HAND_HYGIENE:tab==='waste'?CAPABILITIES.RECORD_WASTE:tab==='antiseptics'?CAPABILITIES.RECORD_ANTISEPTIC:CAPABILITIES.RECORD_PREVENTION_BUNDLE
 const canCreateRecord=role!==ROLES.HOSPITAL_ADMIN&&can(role,createCapability,addOns,custom)
 const visibleTabs=tabs.filter(([id])=>can(role,id==='handHygiene'?CAPABILITIES.RECORD_HAND_HYGIENE:id==='waste'?CAPABILITIES.RECORD_WASTE:id==='antiseptics'?CAPABILITIES.RECORD_ANTISEPTIC:CAPABILITIES.RECORD_PREVENTION_BUNDLE,addOns,custom)||can(role,CAPABILITIES.VIEW_PREVENTION,addOns,custom))
 const source=tab==='handHygiene'?handRows:tab==='waste'?wasteRows:tab==='antiseptics'?antisepticRows:bundleRows
 const departments=useMemo(()=>{
  if(tab==='handHygiene')return handDepartments.map(x=>language==='el'?x.el:(x.en||x.el))
  if(tab==='waste')return wasteSupport.departments.map(x=>language==='el'?x.el:(x.en||x.el))
  if(tab==='antiseptics')return antisepticSupport.departments.map(x=>language==='el'?x.el:(x.en||x.el))
  return bundleSupport.departments.map(x=>language==='el'?x.el:(x.en||x.el))
 },[tab,handDepartments,wasteSupport.departments,antisepticSupport.departments,bundleSupport.departments,language])
 const rows=useMemo(()=>source
  .filter(x=>x.lifecycleStatus!=='voided')
  .filter(x=>canAccessRecord({...x,department:x.departmentEl}))
  .filter(x=>JSON.stringify(x).toLowerCase().includes(query.toLowerCase()))
  .filter(x=>department==='all'||(language==='el'?x.departmentEl:x.departmentEn)===department)
  .filter(x=>period==='all'||x.period===period)
  .filter(x=>product==='all'||x.product===product)
  .filter(x=>method==='all'||x.method===method),[source,query,department,period,product,method,language,canAccessRecord])

 useEffect(()=>{setPage(1)},[tab,query,department,period,product,method,pageSize])
 useEffect(()=>{if(tenant?.id){void reloadHandHygiene();void reloadWaste();void reloadAntiseptics();void reloadBundles()}},[tenant?.id])

 const totalPages=Math.max(1,Math.ceil(rows.length/pageSize)),safePage=Math.min(page,totalPages),pagedRows=rows.slice((safePage-1)*pageSize,safePage*pageSize)
 const avg=handRows.length?handRows.reduce((sum,x)=>sum+x.rate,0)/handRows.length:0
 const fmtDate=v=>v?new Intl.DateTimeFormat(locale).format(new Date(`${v}T12:00:00`)):'—'
 const createLabel=createLabels[tab]?.[language==='en'?'en':'el']||(language==='en'?'New record':'Νέα καταγραφή')

 async function reloadHandHygiene(){if(!tenant?.id){setHandRows([]);setHandDepartments([]);return}setHandLoading(true);try{const [records,depts]=await Promise.all([loadHandHygieneSessions(tenant.id),loadHandHygieneDepartments(tenant.id)]);setHandRows(records);setHandDepartments(depts)}catch(error){notifyError(error,'load',{operation:'hand_hygiene_load'})}finally{setHandLoading(false)}}
 async function reloadWaste(){if(!tenant?.id){setWasteRows([]);setWasteSupport({departments:[],wasteTypes:[]});return}setWasteLoading(true);try{const [records,support]=await Promise.all([loadWasteMeasurements(tenant.id),loadWasteSupportData(tenant.id)]);setWasteRows(records);setWasteSupport(support)}catch(error){notifyError(error,'load',{operation:'waste_load'})}finally{setWasteLoading(false)}}
 async function reloadAntiseptics(){if(!tenant?.id){setAntisepticRows([]);setAntisepticSupport({departments:[],products:[]});return}setAntisepticLoading(true);try{const [records,support]=await Promise.all([loadAntisepticRecords(tenant.id),loadAntisepticSupportData(tenant.id)]);setAntisepticRows(records);setAntisepticSupport(support)}catch(error){notifyError(error,'load',{operation:'antiseptic_load'})}finally{setAntisepticLoading(false)}}
 async function reloadBundles(){if(!tenant?.id){setBundleRows([]);setBundleSupport({departments:[],templates:[]});return}setBundleLoading(true);try{const [records,support]=await Promise.all([loadBundleAssessments(tenant.id),loadBundleSupportData(tenant.id)]);setBundleRows(records);setBundleSupport(support)}catch(error){notifyError(error,'load',{operation:'bundle_load'})}finally{setBundleLoading(false)}}

 function changeTab(id){
  registry.saveViewState({tab,query,department,period,product,method})
  const next=readRegistryViewState(`prevention-${id}`)
  setTab(id);setQuery(next?.query||'');setDepartment(next?.department||'all');setPeriod(next?.period||'all');setProduct(next?.product||'all');setMethod(next?.method||'all')
  setSearchParams({tab:id},{replace:true})
 }
 function openPreventionRecord(id,type){registry.saveViewState({tab:type,query,department,period,product,method});registry.openRecord(navigate,`/prevention/${type}/${id}?fromTab=${type}`,id,rows.map(x=>x.id),{returnState:{tab:type}})}
 function createRecord(){
  if(!canCreateRecord)return
  if(tab==='handHygiene'||tab==='waste'){navigate(`/prevention/${tab}/new?fromTab=${tab}`);return}
  setEntryOpen(true)
 }
 async function saveEntry(record){
  try{
   if(tab==='antiseptics')await saveAntisepticRecord(tenant.id,record)
   else if(tab==='bundles')await saveBundleAssessment(tenant.id,record)
   else return
   if(tab==='antiseptics')await reloadAntiseptics();else await reloadBundles()
   setEntryOpen(false)
   notify(t('preventionSaved'),'success')
  }catch(error){notifyError(error,'save',{operation:`${tab}_create`})}
 }
 const loading=tab==='handHygiene'?handLoading:tab==='waste'?wasteLoading:tab==='antiseptics'?antisepticLoading:bundleLoading

 return <Page fill className="prevention-registry-page" title={t('preventionCenter')} subtitle={t('preventionSubtitle')} actions={canCreateRecord?<ActionButton label={createLabel} tone="primary" onClick={createRecord}><Plus size={18}/><span>{createLabel}</span></ActionButton>:null}>
  <div className="workspace-summary prevention-summary"><div className="module-summary-strip"><Kpi icon={ShieldCheck} value={`${avg.toFixed(1)}%`} label={t('whoCompliance')}/><Kpi icon={ClipboardCheck} value={bundleRows.length} label={t('activeBundles')}/><Kpi icon={Recycle} value={`${wasteRows.reduce((s,x)=>s+x.weight,0).toFixed(1)} kg`} label={t('wasteRecorded')}/><Kpi icon={Droplets} value={`${antisepticRows.reduce((s,x)=>s+x.litres,0).toFixed(1)} L`} label={t('antisepticRecorded')}/></div></div>
  <div className="surface registry-workspace prevention-workspace workspace-fill">
   <nav className="tabs prevention-tabs canonical-module-tabs">{visibleTabs.map(([id,key])=><button key={id} className={`tab ${tab===id?'active':''}`} onClick={()=>changeTab(id)}>{t(key)}</button>)}</nav>
   <FilterBar query={query} onQueryChange={setQuery} placeholder={t('searchPrevention')} onClear={()=>{setQuery('');setDepartment('all');setPeriod('all');setProduct('all');setMethod('all')}} advanced={tab==='antiseptics'?<><FilterSelect label={t('period')} value={period} onChange={setPeriod}><option value="all">{t('all')}</option>{[...new Set(source.map(x=>x.period).filter(Boolean))].map(x=><option key={x} value={x}>{x}</option>)}</FilterSelect><FilterSelect label={t('productFilter')} value={product} onChange={setProduct}><option value="all">{t('allProducts')}</option>{[...new Set(source.map(x=>x.product).filter(Boolean))].map(x=><option key={x} value={x}>{x}</option>)}</FilterSelect><FilterSelect label={t('dataSource')} value={method} onChange={setMethod}><option value="all">{t('allDataSources')}</option>{[...new Set(source.map(x=>x.method).filter(Boolean))].map(x=><option key={x} value={x}>{antisepticMethodLabel(x,language)}</option>)}</FilterSelect></>:tab==='bundles'?<FilterSelect label={t('period')} value={period} onChange={setPeriod}><option value="all">{t('all')}</option>{[...new Set(source.map(x=>x.period).filter(Boolean))].map(x=><option key={x} value={x}>{x}</option>)}</FilterSelect>:null} activeAdvancedCount={(department!=='all'?1:0)+(period!=='all'?1:0)+(product!=='all'?1:0)+(method!=='all'?1:0)}><FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(x=><option key={x}>{x}</option>)}</FilterSelect></FilterBar>
   <div className="scroll-table" ref={registry.scrollRef}>
    {loading&&<div className="registry-empty-state"><strong>{language==='en'?'Loading records…':'Φόρτωση καταγραφών…'}</strong></div>}
    {tab==='handHygiene'&&!loading&&<HandTable rows={pagedRows} t={t} language={language} fmtDate={fmtDate} onOpen={id=>openPreventionRecord(id,'handHygiene')} registry={registry}/>}
    {tab==='waste'&&!loading&&<WasteTable rows={pagedRows} t={t} language={language} fmtDate={fmtDate} onOpen={id=>openPreventionRecord(id,'waste')} registry={registry}/>}
    {tab==='antiseptics'&&!loading&&<AntisepticTable rows={pagedRows} t={t} language={language} onOpen={id=>openPreventionRecord(id,'antiseptics')} registry={registry}/>}
    {tab==='bundles'&&!loading&&<BundleTable rows={pagedRows} t={t} language={language} onOpen={id=>openPreventionRecord(id,'bundles')} registry={registry}/>}
    {!loading&&!rows.length&&<PreventionEmpty language={language} tab={tab}/>} 
   </div>
   <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
  </div>
  {entryOpen&&canCreateRecord&&(tab==='antiseptics'?<AntisepticEntryModal departments={antisepticSupport.departments} products={antisepticSupport.products} findPatientDays={(departmentId,from,to)=>findPatientDaysForPeriod(tenant.id,departmentId,from,to)} fixedDepartment={departmentScoped?ownDepartment:''} onClose={()=>setEntryOpen(false)} onSave={saveEntry}/>:tab==='bundles'?<BundleExecutionModal departments={bundleSupport.departments} templates={bundleSupport.templates} fixedDepartment={departmentScoped?ownDepartment:''} onClose={()=>setEntryOpen(false)} onSave={saveEntry}/>:<PreventionEntryModal tab={tab} fixedDepartment={departmentScoped?ownDepartment:''} onClose={()=>setEntryOpen(false)} onSave={saveEntry}/>)}
 </Page>
}

function Kpi({icon:Icon,value,label}){return <MetricCard icon={Icon} value={value} label={label}/>}
function PreventionEmpty({language,tab}){const en=language==='en';const names={handHygiene:en?'hand hygiene':'υγιεινής χεριών',waste:en?'waste':'αποβλήτων',antiseptics:en?'antiseptic consumption':'κατανάλωσης αντισηπτικών',bundles:en?'prevention bundles':'bundles πρόληψης'};return <div className="registry-empty-state"><strong>{en?`No ${names[tab]} records`:`Δεν υπάρχουν καταγραφές ${names[tab]}`}</strong><span>{en?'No records have been entered for this organization yet.':'Δεν έχουν καταχωριστεί ακόμη δεδομένα για τον συγκεκριμένο οργανισμό.'}</span></div>}
function HandTable({rows,t,language,fmtDate,onOpen,registry}){return <table className="data-table sticky-table"><thead><tr><th>{t('date')}</th><th>{t('department')}</th><th>{t('professionalCategory')}</th><th>{t('observations')}</th><th>{t('compliant')}</th><th>{t('compliance')}</th><th>{t('observer')}</th></tr></thead><tbody>{rows.map(x=>{const rp=registry.rowProps(x.id);return <tr key={x.id} {...rp} className={`${rp.className} clickable-row`} onClick={()=>onOpen(x.id)}><td>{fmtDate(x.date)}</td><td>{language==='el'?x.departmentEl:x.departmentEn}</td><td>{t(x.profession)}</td><td>{x.observations}</td><td>{x.compliant}</td><td><strong>{x.rate}%</strong></td><td>{x.observer}</td></tr>})}</tbody></table>}
function WasteTable({rows,t,language,fmtDate,onOpen,registry}){return <table className="data-table sticky-table"><thead><tr><th>{t('date')}</th><th>{t('department')}</th><th>{t('exportCategory')}</th><th>{t('weight')}</th><th>{t('containers')}</th><th>{t('indicator')}</th><th>{t('documentNumber')}</th></tr></thead><tbody>{rows.map(x=>{const rp=registry.rowProps(x.id);const category=x.wasteType||x.type;return <tr key={x.id} {...rp} className={`${rp.className} clickable-row`} onClick={()=>onOpen(x.id)}><td>{fmtDate(x.date)}</td><td>{language==='el'?x.departmentEl:x.departmentEn}</td><td><span className={`waste-category-badge ${wasteCategoryTone(category)}`}>{language==='el'?category:(x.typeEn||category)}</span></td><td>{Number(x.weight).toLocaleString(localeFromLanguage(language))} kg</td><td>{x.containers}</td><td>{x.indicator!=null?<><strong>{Number(x.indicator).toLocaleString(localeFromLanguage(language))}</strong><small className="table-cell-unit"> kg / 1.000</small></>:'—'}</td><td>{x.documentNumber||'—'}</td></tr>})}</tbody></table>}
function AntisepticTable({rows,t,language,onOpen,registry}){return <table className="data-table sticky-table"><thead><tr><th>{t('period')}</th><th>{t('department')}</th><th>{t('product')}</th><th>{t('consumptionLitres')}</th><th>{t('patientDays')}</th><th>{t('indicator')} ABHR</th><th>{t('dataSourceShort')}</th></tr></thead><tbody>{rows.map(x=>{const rp=registry.rowProps(x.id);return <tr key={x.id} {...rp} className={`${rp.className} clickable-row`} onClick={()=>onOpen(x.id)}><td>{x.period}</td><td>{language==='el'?x.departmentEl:x.departmentEn}</td><td><strong>{language==='el'?x.product:(x.productEn||x.product)}</strong>{x.indicatorEligible===false&&<small className="table-cell-unit">{t('notApplicable')} ABHR</small>}</td><td><strong>{Number(x.litres).toLocaleString(localeFromLanguage(language))} L</strong></td><td>{x.patientDays||'—'}</td><td>{x.indicator!=null?<><strong>{Number(x.indicator).toLocaleString(localeFromLanguage(language))}</strong><small className="table-cell-unit"> L / 1.000</small></>:'—'}</td><td><span className={`antiseptic-method-badge ${x.method||'other'}`}>{antisepticMethodLabel(x.method,language)}</span></td></tr>})}</tbody></table>}
function BundleTable({rows,t,language,onOpen,registry}){return <table className="data-table sticky-table"><thead><tr><th>{t('date')}</th><th>{t('bundle')}</th><th>{t('department')}</th><th>{t('context')}</th><th>{t('score')}</th><th>{t('allOrNone')}</th><th>{t('deviations')}</th></tr></thead><tbody>{rows.map(x=>{const rp=registry.rowProps(x.id);return <tr key={x.id} {...rp} className={`${rp.className} clickable-row`} onClick={()=>onOpen(x.id)}><td>{x.date||x.period}</td><td><strong>{x.templateName||x.bundle}</strong><small className="table-cell-unit">v{x.templateVersion||'1.0'}</small></td><td>{language==='el'?x.departmentEl:x.departmentEn}</td><td>{x.shift||'—'}</td><td><strong>{x.score==null?'—':`${x.score}%`}</strong></td><td><span className={`bundle-all-badge ${x.allOrNone?'passed':'failed'}`}>{x.allOrNone?t('yes'):t('no')}</span></td><td>{(x.failedCount??x.findings?.length??0)>0?<span className="bundle-finding-count">{x.failedCount??x.findings?.length}</span>:'—'}</td></tr>})}</tbody></table>}
function localeFromLanguage(language){return language==='en'?'en-GB':'el-GR'}