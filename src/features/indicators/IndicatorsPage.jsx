import { useCallback,useEffect,useMemo,useRef,useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity,CheckCircle2,ClipboardCheck,Database,Download,Plus,RefreshCcw,Target,TrendingUp } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { MetricCard } from '../../design-system/MetricCard'
import { FilterBar,FilterDate,FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { CAPABILITIES,can,scopeFor } from '../../core/permissions/roles'
import { DATA_SCOPES } from '../../core/permissions/scopeTypes'
import { loadDepartments } from '../management/departmentsService'
import { demoLibrarySeed } from '../management/managementData'
import { exportElementAsPdf } from '../../core/export/pdfReportExport'
import { approveIndicatorSnapshot,collectCloudIndicatorMetrics,calculateCloudDefinition,loadOperationalIndicatorDefinitions,loadIndicatorSnapshots } from './indicatorCloudService'

const today=()=>new Date().toISOString().slice(0,10)
const monthStart=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`}
const categoryLabel=(category,t)=>({surveillance:t('surveillance'),prevention:t('prevention'),workforce:t('workforce'),laboratory:t('laboratory'),quality:t('indicatorsRecords.qualityCategory')}[category]||category)
const statusText=(status,t)=>status==='onTarget'?t('indicatorsRecords.onTargetStatus'):status==='attention'?t('indicatorsRecords.attentionStatus'):t('indicatorsRecords.contextStatus')

export function IndicatorsPage(){
 const navigate=useNavigate();const registry=useRegistryMemory('indicators');const {tenant,membership,role,isDemo}=useTenant();const {t,language}=useLanguage();const {notify,notifyError}=useFeedback();const el=language==='el'
 const reportRef=useRef(null);const [exporting,setExporting]=useState(false)
 const addOns=membership?.capabilities||[],customCapabilities=membership?.customCapabilities||[];const canManage=can(role,CAPABILITIES.MANAGE_INDICATORS,addOns,customCapabilities)
 const indicatorScope=scopeFor(CAPABILITIES.VIEW_INDICATORS,{role,scopeOverrides:membership?.scopeOverrides||{}})
 const scopedDepartmentIds=useMemo(()=>membership?.previewDepartment?[membership.previewDepartment]:(membership?.departmentIds||[]),[membership?.previewDepartment,membership?.departmentIds])
 const departmentScoped=indicatorScope===DATA_SCOPES.DEPARTMENT
 const defaultFrom=monthStart(),defaultTo=today();const remembered=registry.loadViewState({from:defaultFrom,to:defaultTo,department:'',query:'',category:'all',page:1,pageSize:15})
 const [from,setFrom]=useState(()=>remembered.from||defaultFrom);const [to,setTo]=useState(()=>remembered.to||defaultTo);const [department,setDepartment]=useState(()=>remembered.department||'');const [departments,setDepartments]=useState([]);const [definitions,setDefinitions]=useState([]);const [rows,setRows]=useState([]);const [snapshots,setSnapshots]=useState([]);const [loading,setLoading]=useState(false);const [approvingId,setApprovingId]=useState('');const [query,setQuery]=useState(()=>remembered.query||'');const [category,setCategory]=useState(()=>remembered.category||'all');const [page,setPage]=useState(()=>Number(remembered.page)||1);const [pageSize,setPageSize]=useState(()=>Number(remembered.pageSize)||15)
 const allowedDepartments=useMemo(()=>departmentScoped?departments.filter(d=>scopedDepartmentIds.includes(d.id)):departments,[departments,departmentScoped,scopedDepartmentIds]);const effectiveDepartment=departmentScoped?(department||allowedDepartments[0]?.id||''):department
 useEffect(()=>{if(isDemo){setDepartments(demoLibrarySeed.departments.map(([name,nameEn])=>({id:name,name,nameEn})));return}if(!tenant?.id)return;loadDepartments(tenant.id).then(data=>setDepartments((data||[]).filter(x=>x.is_active!==false))).catch(()=>setDepartments([]))},[tenant?.id,isDemo])
 useEffect(()=>{if(!departmentScoped)return;if(!allowedDepartments.length){setDepartment('');return}if(!department||!allowedDepartments.some(d=>d.id===department))setDepartment(allowedDepartments[0].id)},[departmentScoped,allowedDepartments,department])
 useEffect(()=>{registry.saveViewState({from,to,department,query,category,page,pageSize})},[from,to,department,query,category,page,pageSize,registry])
 const calculate=useCallback(async()=>{if(!tenant?.id||!from||!to||to<from)return;if(departmentScoped&&!effectiveDepartment)return;setLoading(true);const calculatedFrom=from,calculatedTo=to,calculatedDepartment=effectiveDepartment||null;try{const [metrics,defs,history]=await Promise.all([collectCloudIndicatorMetrics(tenant.id,{from:calculatedFrom,to:calculatedTo,departmentId:calculatedDepartment}),loadOperationalIndicatorDefinitions(tenant.id,{from:calculatedFrom,to:calculatedTo}),loadIndicatorSnapshots(tenant.id,{departmentId:calculatedDepartment})]);setDefinitions(defs);setSnapshots(history);const storedManual={};for(const snap of history.filter(s=>s.period_start===calculatedFrom&&s.period_end===calculatedTo&&s.calculation_type==='manual'))storedManual[snap.indicator_key]=String(snap.value??'');setRows(defs.map(def=>calculateCloudDefinition({...def,manualValue:storedManual[def.id]},metrics)))}catch(error){notify(error?.message||t('indicatorsRecords.calculationFailed'),'error')}finally{setLoading(false)}},[tenant?.id,from,to,effectiveDepartment,departmentScoped,notify,t])
 useEffect(()=>{void calculate()},[calculate])
 async function approveSnapshot(snapshot){if(!tenant?.id||!snapshot)return;setApprovingId(snapshot.id);try{await approveIndicatorSnapshot(tenant.id,snapshot.id);setSnapshots(await loadIndicatorSnapshots(tenant.id,{departmentId:effectiveDepartment||null}));notify(t('indicatorsRecords.indicatorApproved'),'success')}catch(error){notify(error?.message||t('indicatorsRecords.approvalFailed'),'error')}finally{setApprovingId('')}}
 const snapshotFor=useCallback(r=>snapshots.find(s=>s.indicator_key===r.id&&s.period_start===from&&s.period_end===to),[snapshots,from,to])
 const filtered=useMemo(()=>rows.filter(r=>(category==='all'||r.category===category)&&`${r.titleEl} ${r.titleEn} ${r.source}`.toLowerCase().includes(query.toLowerCase())),[rows,category,query]);const onTarget=rows.filter(r=>r.status==='onTarget').length,attention=rows.filter(r=>r.status==='attention').length
 useEffect(()=>setPage(1),[query,category,effectiveDepartment,from,to,pageSize])
 const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)),safePage=Math.min(page,totalPages),pagedRows=filtered.slice((safePage-1)*pageSize,safePage*pageSize);const sequenceIds=filtered.map(r=>r.definitionId).filter(Boolean)
 const activeFilterCount=(category!=='all'?1:0)+(!departmentScoped&&department?1:0)+(from!==defaultFrom?1:0)+(to!==defaultTo?1:0)
 function clearFilters(){setQuery('');setCategory('all');if(!departmentScoped)setDepartment('');setFrom(defaultFrom);setTo(defaultTo);setPage(1)}
 function openIndicator(row){if(!row.definitionId)return;registry.openRecord(navigate,`/indicators/${row.definitionId}`,row.definitionId,sequenceIds,{state:{indicatorPeriod:{from,to,departmentId:effectiveDepartment||null}}})}
 const departmentLabel=effectiveDepartment?(allowedDepartments.find(d=>d.id===effectiveDepartment)?.name||effectiveDepartment):t('indicatorsRecords.wholeHospital')
 async function exportPdf(){
  if(exporting||!reportRef.current)return
  setExporting(true)
  try{
   await exportElementAsPdf({element:reportRef.current,filename:`${tenant?.name||'Indicators'}_${from}_${to}${effectiveDepartment?`_${departmentLabel}`:''}`})
  }catch(error){notifyError(error,'export',{operation:'indicators_pdf_export'})}
  finally{setExporting(false)}
 }
 return <Page fill title={t('indicators')} subtitle={t('indicatorsRecords.operationalSubtitle')} actions={<div className="row-actions"><IconButton label={t('indicatorsRecords.exportPdfReport')} disabled={exporting||!filtered.length} onClick={exportPdf}><Download size={16}/></IconButton><Button variant="secondary" onClick={calculate} disabled={loading}><RefreshCcw size={15}/>{t('recalculate')}</Button>{canManage&&<Button onClick={()=>navigate('/indicators/new')}><Plus size={16}/>{t('indicatorsRecords.newIndicatorTitle')}</Button>}</div>}>
  <div className="indicator-summary-strip module-summary-strip"><MetricCard icon={Activity} value={definitions.length} label={t('indicatorsRecords.activeDefinitions')}/><MetricCard icon={CheckCircle2} value={onTarget} label={t('indicatorsRecords.onTargetStatus')} tone="active"/><MetricCard icon={Target} value={attention} label={t('indicatorsRecords.needAttentionLabel')} tone={attention?'warning':'neutral'}/><MetricCard icon={TrendingUp} value={snapshots.filter(s=>s.status==='approved').length} label={t('indicatorsRecords.approvedResults')}/></div>
  {departmentScoped&&<div className="governance-banner"><Database size={16}/><span>{t('indicatorsRecords.departmentScopedBanner')}</span></div>}
  <section className="surface registry-workspace workspace-column workspace-fill indicator-registry">
   <FilterBar query={query} onQueryChange={setQuery} placeholder={t('indicatorsRecords.searchPlaceholder')} activeAdvancedCount={activeFilterCount} onClear={clearFilters} advanced={<><FilterDate label={t('indicatorsRecords.fromDate')} value={from} onChange={setFrom}/><FilterDate label={t('indicatorsRecords.toDate')} value={to} onChange={setTo}/></>}><FilterSelect label={t('category')} value={category} onChange={setCategory}><option value="all">{t('indicatorsRecords.allFeminine')}</option>{[...new Set(rows.map(r=>r.category))].map(x=><option key={x} value={x}>{categoryLabel(x,t)}</option>)}</FilterSelect><FilterSelect label={t('department')} value={effectiveDepartment} onChange={setDepartment}>{!departmentScoped&&<option value="">{t('indicatorsRecords.wholeHospital')}</option>}{allowedDepartments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</FilterSelect></FilterBar>
   {to<from&&<div className="inline-empty">{t('indicatorsRecords.endDateAfterStart')}</div>}
   {loading&&<div className="inline-empty">{t('indicatorsRecords.calculatingEllipsis')}</div>}
   <div className="scroll-table" ref={registry.scrollRef}><table className="data-table sticky-table indicator-click-table"><thead><tr><th>{t('indicatorsRecords.tableIndicator')}</th><th>{t('category')}</th><th>{t('indicatorsRecords.tableResult')}</th><th>{t('indicatorsRecords.numeratorDenominatorLabel')}</th><th>{t('indicatorsRecords.sourceVersionLabel')}</th><th>{t('status')}</th><th>{t('indicatorsRecords.approvalLabel')}</th></tr></thead><tbody>{pagedRows.map(r=>{const snapshot=snapshotFor(r);return <tr key={r.definitionId||r.id} {...registry.rowProps(r.definitionId,()=>openIndicator(r))}><td><strong>{el?r.titleEl:r.titleEn}</strong><small>{from} – {to}{r.calculation==='manual'?(el?' · χειροκίνητος':' · manual'):''}</small></td><td>{categoryLabel(r.category,t)}</td><td className="indicator-result-cell"><strong>{r.value??'—'}</strong><small>{r.calculation==='manual'?(el?'Καταχώρηση μέσα στον δείκτη':'Enter inside indicator'):(el?r.unit:(r.unitEn||r.unit))}</small></td><td>{r.calculation==='manual'?(el?'Χειροκίνητη καταχώρηση':'Manual entry'):r.evidence}</td><td>{r.source}<small>{r.version}</small></td><td><span className={`indicator-status ${r.status}`}>{statusText(r.status,t)}</span></td><td onClick={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()}>{(()=>{
    const pendingReview=snapshot&&(snapshot.status==='calculated'||snapshot.status==='reviewed')
    const stale=pendingReview&&r.value!=null&&Number(snapshot.value)!==Number(r.value)
    if(!snapshot)return <span className="indicator-approval-pending">{t('indicatorsRecords.notSaved')}</span>
    if(snapshot.status==='approved')return <span className="indicator-approval-approved"><ClipboardCheck size={14}/>{t('indicatorsRecords.approvedLabel')}</span>
    if(pendingReview&&stale)return <span className="indicator-approval-pending">{t('indicatorsRecords.valueChangedResaveRequired')}</span>
    if(pendingReview)return canManage?<IconButton size="sm" label={t('indicatorsRecords.approveIndicatorAction')} disabled={approvingId===snapshot.id} onClick={()=>approveSnapshot(snapshot)}><ClipboardCheck size={15}/></IconButton>:<span className="indicator-approval-pending">{t('indicatorsRecords.pendingApproval')}</span>
    return null
  })()}</td></tr>})}</tbody></table>{!loading&&!filtered.length&&<div className="registry-empty-state"><strong>{t('indicatorsRecords.noActiveIndicators')}</strong><span>{t('indicatorsRecords.noIndicatorsMatchFilters')}</span></div>}</div>
   <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
  </section>
  <div style={{position:'fixed',top:0,left:'-10000px',width:'1200px'}} aria-hidden="true"><IndicatorsPdfReport reportRef={reportRef} t={t} el={el} tenant={tenant} from={from} to={to} departmentLabel={effectiveDepartment?departmentLabel:null} category={category!=='all'?categoryLabel(category,t):null} query={query} rows={filtered}/></div>
 </Page>
}
function IndicatorsPdfReport({reportRef,t,el,tenant,from,to,departmentLabel,category,query,rows}){
 const filters=[[t('indicatorsRecords.reportPeriodLabel'),`${from} – ${to}`],departmentLabel?[t('indicatorsRecords.reportDepartmentLabel'),departmentLabel]:null,category?[t('indicatorsRecords.reportCategoryLabel'),category]:null,query.trim()?[t('indicatorsRecords.reportSearchLabel'),query.trim()]:null].filter(Boolean)
 return <div ref={reportRef} className="indicators-pdf-report">
  <header><h1>{tenant?.name||t('indicators')}</h1><h2>{t('indicators')}</h2><span>{t('indicatorsRecords.reportGeneratedAt')} {new Intl.DateTimeFormat(el?'el-GR':'en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date())}</span></header>
  <section className="indicators-pdf-filters"><strong>{t('indicatorsRecords.reportActiveFilters')}</strong><div>{filters.map(([label,value])=><span key={label}>{label}: <b>{value}</b></span>)}</div></section>
  <table><thead><tr><th>{t('indicatorsRecords.tableIndicator')}</th><th>{t('category')}</th><th>{t('indicatorsRecords.tableResult')}</th><th>{t('indicatorsRecords.sourceVersionLabel')}</th><th>{t('status')}</th></tr></thead><tbody>{rows.map(r=><tr key={r.definitionId||r.id}><td>{el?r.titleEl:r.titleEn}</td><td>{categoryLabel(r.category,t)}</td><td>{r.value??'—'} {r.calculation!=='manual'?(el?r.unit:(r.unitEn||r.unit)):''}</td><td>{r.source}</td><td>{statusText(r.status,t)}</td></tr>)}</tbody></table>
 </div>
}
