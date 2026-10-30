import { useCallback,useEffect,useMemo,useState } from 'react'
import { createPortal } from 'react-dom'
import { KpiFigures } from '../../design-system/KpiCard'
import { useNavigate } from 'react-router-dom'
import { Activity,AlertTriangle,CheckCircle2,ClipboardCheck,Database,Plus,RefreshCcw } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { ExportMenu } from '../../design-system/ExportMenu'
import { FilterBar,FilterDate,FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { useTableSort } from '../../design-system/useTableSort'
import { RegistryEmptyState } from '../../design-system/RegistryEmptyState'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage,translate} from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { CAPABILITIES,can,scopeFor } from '../../core/permissions/roles'
import { DATA_SCOPES } from '../../core/permissions/scopeTypes'
import { loadDepartments } from '../management/departmentsService'
import { demoLibrarySeed } from '../management/managementData'
import { printReport } from '../../core/export/reportDocument'
import { loadRiskAssessments } from '../quality/risk/riskService'
import { rememberQualitySection } from '../quality/qualityReturnSection'
import { approveIndicatorSnapshot,collectCloudIndicatorMetrics,calculateCloudDefinition,loadOperationalIndicatorDefinitions,loadIndicatorSnapshots,visibleForDepartment } from './indicatorCloudService'

const today=()=>new Date().toISOString().slice(0,10)
const monthStart=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`}
const yearStart=()=>`${new Date().getFullYear()}-01-01`
const categoryLabel=(category,t)=>({surveillance:t('surveillance'),prevention:t('prevention'),workforce:t('workforce'),laboratory:t('laboratory'),pharmacy:t('pharmacy'),quality:t('indicatorsRecords.qualityCategory')}[category]||category)
const statusText=(status,t)=>status==='onTarget'?t('indicatorsRecords.onTargetStatus'):status==='attention'?t('indicatorsRecords.attentionStatus'):t('indicatorsRecords.contextStatus')

function fmtIndicatorDay(value){const [y,m,d]=String(value||'').slice(0,10).split('-');return y&&m&&d?`${Number(d)}/${Number(m)}/${y}`:(value||'—')}
function fmtIndicatorValue(value,el){if(value==null||value==='')return '—';const n=Number(value);return Number.isFinite(n)?new Intl.NumberFormat(el?'el-GR':'en-GB',{maximumFractionDigits:2}).format(n):String(value)}
// actionsSlot: inside another page (Quality Center), the element of that page's top bar
// where «Export» and «⋯» go; that page's «Create» offers the new indicator.
export function IndicatorsPage({defaultPeriod='month',registryKey='indicators',actionsSlot=null}={}){
 const navigate=useNavigate();const registry=useRegistryMemory(registryKey);const {tenant,membership,role,isDemo}=useTenant();const {t,language}=useLanguage();const {notify}=useFeedback();const el=language==='el'
 const addOns=membership?.capabilities||[],customCapabilities=membership?.customCapabilities||[];const canManage=can(role,CAPABILITIES.MANAGE_INDICATORS,addOns,customCapabilities)
 const indicatorScope=scopeFor(CAPABILITIES.VIEW_INDICATORS,{role,scopeOverrides:membership?.scopeOverrides||{}})
 const scopedDepartmentIds=useMemo(()=>membership?.previewDepartment?[membership.previewDepartment]:(membership?.departmentIds||[]),[membership?.previewDepartment,membership?.departmentIds])
 const departmentScoped=indicatorScope===DATA_SCOPES.DEPARTMENT
 const defaultFrom=defaultPeriod==='year'?yearStart():monthStart(),defaultTo=today();const remembered=registry.loadViewState({from:defaultFrom,to:defaultTo,department:'',query:'',category:'all',page:1,pageSize:15})
 const [from,setFrom]=useState(()=>remembered.from||defaultFrom);const [to,setTo]=useState(()=>remembered.to||defaultTo);const [department,setDepartment]=useState(()=>remembered.department||'');const [departments,setDepartments]=useState([]);const [definitions,setDefinitions]=useState([]);const [rows,setRows]=useState([]);const [snapshots,setSnapshots]=useState([]);const [loading,setLoading]=useState(true);const [approvingId,setApprovingId]=useState('');const [query,setQuery]=useState(()=>remembered.query||'');const [category,setCategory]=useState(()=>remembered.category||'all');const [page,setPage]=useState(()=>Number(remembered.page)||1);const [pageSize,setPageSize]=useState(()=>Number(remembered.pageSize)||15)
 const allowedDepartments=useMemo(()=>departmentScoped?departments.filter(d=>scopedDepartmentIds.includes(d.id)):departments,[departments,departmentScoped,scopedDepartmentIds]);const effectiveDepartment=departmentScoped?(department||allowedDepartments[0]?.id||''):department
 useEffect(()=>{if(isDemo){setDepartments(demoLibrarySeed.departments.map(([name,nameEn])=>({id:name,name,nameEn})));return}if(!tenant?.id)return;loadDepartments(tenant.id).then(data=>setDepartments((data||[]).filter(x=>x.is_active!==false))).catch(()=>setDepartments([]))},[tenant?.id,isDemo])
 useEffect(()=>{if(!departmentScoped)return;if(!allowedDepartments.length){setDepartment('');return}if(!department||!allowedDepartments.some(d=>d.id===department))setDepartment(allowedDepartments[0].id)},[departmentScoped,allowedDepartments,department])
 useEffect(()=>{registry.saveViewState({from,to,department,query,category,page,pageSize})},[from,to,department,query,category,page,pageSize,registry])
 const calculate=useCallback(async()=>{if(!tenant?.id||!from||!to||to<from){setLoading(false);return}if(departmentScoped&&!effectiveDepartment){setLoading(false);return}setLoading(true);const calculatedFrom=from,calculatedTo=to,calculatedDepartment=effectiveDepartment||null;try{const [metrics,allDefs,history]=await Promise.all([collectCloudIndicatorMetrics(tenant.id,{from:calculatedFrom,to:calculatedTo,departmentId:calculatedDepartment}),loadOperationalIndicatorDefinitions(tenant.id,{from:calculatedFrom,to:calculatedTo}),loadIndicatorSnapshots(tenant.id,{departmentId:calculatedDepartment})]);const defs=allDefs.filter(def=>visibleForDepartment(def,calculatedDepartment));setDefinitions(defs);setSnapshots(history);const storedManual={};for(const snap of history.filter(s=>s.period_start===calculatedFrom&&s.period_end===calculatedTo&&s.calculation_type==='manual'))storedManual[snap.indicator_key]=String(snap.value??'');setRows(defs.map(def=>calculateCloudDefinition({...def,manualValue:storedManual[def.id]},metrics)))}catch(error){notify(error?.message||t('indicatorsRecords.calculationFailed'),'error')}finally{setLoading(false)}},[tenant?.id,from,to,effectiveDepartment,departmentScoped,notify,t])
 useEffect(()=>{void calculate()},[calculate])
 // The risks of the latest assessment that this indicator monitors.
 const [riskCounts,setRiskCounts]=useState(()=>new Map())
 useEffect(()=>{if(!tenant?.id)return;let active=true;loadRiskAssessments(tenant.id).then(list=>{if(!active)return;const latest=(list||[]).find(a=>a.status!=='archived')||(list||[])[0];const counts=new Map();for(const risk of latest?.risks||[])for(const key of risk.indicatorKeys||[])counts.set(key,(counts.get(key)||0)+1);setRiskCounts(counts)}).catch(()=>{if(active)setRiskCounts(new Map())});return()=>{active=false}},[tenant?.id])
 // Until the first calculation ends: placeholders, not 0 figures and «no active indicators».
 const firstLoad=loading&&!rows.length
 async function approveSnapshot(snapshot){if(!tenant?.id||!snapshot)return;setApprovingId(snapshot.id);try{await approveIndicatorSnapshot(tenant.id,snapshot.id);setSnapshots(await loadIndicatorSnapshots(tenant.id,{departmentId:effectiveDepartment||null}));notify(t('indicatorsRecords.indicatorApproved'),'success')}catch(error){notify(error?.message||t('indicatorsRecords.approvalFailed'),'error')}finally{setApprovingId('')}}
 const snapshotFor=useCallback(r=>snapshots.find(s=>s.indicator_key===r.id&&s.period_start===from&&s.period_end===to),[snapshots,from,to])
 const [kpi,setKpi]=useState('all')
 const kpiMatch=useCallback(r=>kpi==='all'||(kpi==='approved'?snapshotFor(r)?.status==='approved':r.status===kpi),[kpi,snapshotFor])
 const filtered=useMemo(()=>rows.filter(r=>(category==='all'||r.category===category)&&kpiMatch(r)&&`${r.titleEl} ${r.titleEn} ${r.source}`.toLowerCase().includes(query.toLowerCase())),[rows,category,query,kpiMatch]);const onTarget=rows.filter(r=>r.status==='onTarget').length,attention=rows.filter(r=>r.status==='attention').length,approvedCount=rows.filter(r=>snapshotFor(r)?.status==='approved').length
 // The arrows in the headers sort the whole filtered list; then the page is cut.
 const approvalRank={approved:2,calculated:1,reviewed:1}
 const {sorted:sortedRows,sort,onSort}=useTableSort(filtered,{
  indicator:r=>el?r.titleEl:(r.titleEn||r.titleEl),
  result:r=>(r.value==null?null:Number(r.value)),
  status:r=>r.status,
  approval:r=>approvalRank[snapshotFor(r)?.status]??0,
 })
 useEffect(()=>setPage(1),[query,category,kpi,effectiveDepartment,from,to,pageSize,sort])
 const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)),safePage=Math.min(page,totalPages),pagedRows=sortedRows.slice((safePage-1)*pageSize,safePage*pageSize);const sequenceIds=sortedRows.map(r=>r.definitionId).filter(Boolean)
 const activeFilterCount=(category!=='all'?1:0)+(kpi!=='all'?1:0)+(!departmentScoped&&department?1:0)+(from!==defaultFrom?1:0)+(to!==defaultTo?1:0)
 function clearFilters(){setQuery('');setCategory('all');setKpi('all');if(!departmentScoped)setDepartment('');setFrom(defaultFrom);setTo(defaultTo);setPage(1)}
 // A card narrows the list to its rows (like Employees and Controls); clicking it again shows them all.
 function toggleKpi(next){setKpi(current=>current===next?'all':next)}
 // Opened from the Quality Center, the back arrow returns to its Indicators view.
 function openIndicator(row){if(!row.definitionId)return;const fromQuality=registryKey==='quality.indicators';if(fromQuality)rememberQualitySection('indicators:indicators');registry.openRecord(navigate,`/indicators/${row.definitionId}`,row.definitionId,sequenceIds,{state:{indicatorPeriod:{from,to,departmentId:effectiveDepartment||null},fromQuality}})}
 const departmentLabel=effectiveDepartment?(allowedDepartments.find(d=>d.id===effectiveDepartment)?.name||effectiveDepartment):t('indicatorsRecords.wholeHospital')
 // The list as a report on the shared document layout: real text and tables, the hospital band and page numbers.
 function exportPdf(pdf){
  if(loading||to<from)return
  const approvalText=r=>{const snapshot=snapshotFor(r);return !snapshot?'—':snapshot.status==='approved'?t('indicatorsRecords.approvedLabel'):t('indicatorsRecords.pendingApproval')}
  const resultText=r=>`${fmtIndicatorValue(r.value,el)}${r.calculation!=='manual'&&r.unit?` ${el?r.unit:(r.unitEn||r.unit)}`:''}`
  const target=r=>r.target==null?'—':`${r.direction==='higher'?'≥ ':r.direction==='lower'?'≤ ':''}${fmtIndicatorValue(Number(r.target),el)}`
  const status=r=>({text:statusText(r.status,t),className:r.status==='attention'?'rd-bad':r.status==='onTarget'?'rd-good':''})
  const ok=printReport({language,orientation:'landscape',kind:t('indicators'),code:`${fmtIndicatorDay(from)} – ${fmtIndicatorDay(to)}`,title:t('indicatorsRecords.reportTitle'),
   meta:[[t('indicatorsRecords.reportPeriodLabel'),`${fmtIndicatorDay(from)} – ${fmtIndicatorDay(to)}`],[t('indicatorsRecords.reportDepartmentLabel'),departmentLabel],[t('indicatorsRecords.reportCategoryLabel'),category!=='all'?categoryLabel(category,t):(t('indicatorsRecords.allFeminine'))],[t('indicatorsRecords.reportSearchLabel'),query.trim()||'—'],
    [t('indicatorsRecords.onTargetStatus'),String(onTarget)],[t('indicatorsRecords.needAttentionLabel'),String(attention)]],
   sections:[{title:`${t('indicators')} (${filtered.length})`,table:{columns:[t('indicatorsRecords.tableIndicator'),t('category'),{text:t('indicatorsRecords.tableResult'),align:'right'},t('indicatorsRecords.numeratorDenominatorLabel'),t('indicatorsRecords.targetLabel'),t('indicatorsRecords.sourceVersionLabel'),t('status'),t('indicatorsRecords.approvalLabel')],
    rows:filtered.map(r=>[el?r.titleEl:(r.titleEn||r.titleEl),categoryLabel(r.category,t),{text:resultText(r),className:'rd-num'},r.calculation==='manual'?translate('copy.indicatorsCopy.manualEntry',language):(r.evidence||'—'),target(r),[r.source,r.version].filter(Boolean).join(' · '),status(r),approvalText(r)])}}],
   filename:`${tenant?.name||'Indicators'}_${from}_${to}${effectiveDepartment?`_${departmentLabel}`:''}`}, { pdf: pdf === true })
  if(!ok)notify(t('indicatorsRecords.allowPopups'),'error')
 }
 const exportMenu=<ExportMenu disabled={loading||to<from||!filtered.length} onPrint={()=>exportPdf(false)} onPdf={()=>exportPdf(true)}/>
 const newButton=canManage?<Button onClick={()=>navigate('/indicators/new')}><Plus size={16}/>{t('indicatorsRecords.newIndicatorTitle')}</Button>:null
 const moreMenu=<OverflowMenu label={t('indicatorsRecords.moreActions')} items={[{id:'recalculate',label:t('recalculate'),icon:RefreshCcw,disabled:loading,onClick:calculate}]}/>
 const toggle=key=>()=>key==='all'?setKpi('all'):toggleKpi(key)
 const summary=<KpiFigures label={t('indicators')} loading={firstLoad} figures={[
  {key:'all',icon:Activity,value:definitions.length,label:t('indicatorsRecords.activeDefinitions'),active:kpi==='all'&&category==='all'&&!query,go:toggle('all')},
  {key:'onTarget',icon:CheckCircle2,value:onTarget,label:t('indicatorsRecords.onTargetStatus'),active:kpi==='onTarget',go:toggle('onTarget')},
  {key:'attention',icon:AlertTriangle,value:attention,label:t('indicatorsRecords.needAttentionLabel'),tone:'warning',active:kpi==='attention',go:toggle('attention')},
  {key:'approved',icon:ClipboardCheck,value:approvedCount,label:t('indicatorsRecords.approvedResults'),active:kpi==='approved',go:toggle('approved')},
 ]}/>
 return <Page fill className="indicators-page" title={t('indicators')} subtitle={t('indicatorsRecords.operationalSubtitle')} actions={actionsSlot?null:<div className="row-actions">{exportMenu}{newButton}{moreMenu}</div>}>
  {actionsSlot&&createPortal(<>{exportMenu}{moreMenu}</>,actionsSlot)}
  {summary}
  {departmentScoped&&<div className="governance-banner"><Database size={16}/><span>{t('indicatorsRecords.departmentScopedBanner')}</span></div>}
  <section className="surface registry-workspace workspace-column workspace-fill indicator-registry">
   <FilterBar query={query} onQueryChange={setQuery} placeholder={t('indicatorsRecords.searchPlaceholder')} activeAdvancedCount={activeFilterCount} onClear={clearFilters} end={null} advanced={<><FilterDate label={t('indicatorsRecords.fromDate')} value={from} onChange={setFrom}/><FilterDate label={t('indicatorsRecords.toDate')} value={to} onChange={setTo}/></>}><FilterSelect label={t('category')} value={category} onChange={setCategory}><option value="all">{t('indicatorsRecords.allFeminine')}</option>{[...new Set(rows.map(r=>r.category))].map(x=><option key={x} value={x}>{categoryLabel(x,t)}</option>)}</FilterSelect><FilterSelect label={t('department')} value={effectiveDepartment} onChange={setDepartment}>{!departmentScoped&&<option value="">{t('indicatorsRecords.wholeHospital')}</option>}{allowedDepartments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</FilterSelect></FilterBar>
   {to<from&&<div className="inline-empty">{t('indicatorsRecords.endDateAfterStart')}</div>}
   {firstLoad?<TableSkeleton/>:loading&&<div className="inline-empty">{t('indicatorsRecords.calculatingEllipsis')}</div>}
   <div className="scroll-table" ref={registry.scrollRef}><RegistryTable bare className="indicator-click-table" sort={sort} onSort={onSort} rows={pagedRows} rowKey={r=>r.definitionId||r.id} columns={[{key:'indicator',label:t('indicatorsRecords.tableIndicator'),sortable:true},{key:'result',label:t('indicatorsRecords.tableResult'),sortable:true},{key:'status',label:t('status'),sortable:true},{key:'approval',label:t('indicatorsRecords.approvalLabel'),sortable:true}]} renderRow={r=>{const snapshot=snapshotFor(r);return <tr {...registry.rowProps(r.definitionId,()=>openIndicator(r))}><td><strong>{el?r.titleEl:r.titleEn}</strong><small>{categoryLabel(r.category,t)} · {fmtIndicatorDay(from)} – {fmtIndicatorDay(to)}{r.calculation==='manual'?(translate('copy.indicatorsCopy.manual',el?'el':'en')):''}{riskCounts.get(r.id)?` · ${t('indicatorsRecords.risksLabel')}: ${riskCounts.get(r.id)}`:''}</small></td><td className={`indicator-result-cell ${r.status}`}><strong>{fmtIndicatorValue(r.value,el)}</strong><small>{r.calculation==='manual'?(translate('copy.indicatorsCopy.enterInsideIndicator',el?'el':'en')):[el?r.unit:(r.unitEn||r.unit),r.evidence].filter(Boolean).join(' · ')}</small>{r.target!=null&&<small className="indicator-target">{t('indicatorsRecords.targetLabel')} {r.direction==='higher'?'≥':r.direction==='lower'?'≤':''} {fmtIndicatorValue(Number(r.target),el)}</small>}</td><td><span className={`indicator-status ${r.status}`}>{statusText(r.status,t)}</span></td><td onClick={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()}>{(()=>{
    const pendingReview=snapshot&&(snapshot.status==='calculated'||snapshot.status==='reviewed')
    const stale=pendingReview&&r.value!=null&&Number(snapshot.value)!==Number(r.value)
    if(!snapshot)return <span className="indicator-approval-none" title={t('indicatorsRecords.notSaved')} aria-label={t('indicatorsRecords.notSaved')}>—</span>
    if(snapshot.status==='approved')return <span className="indicator-approval-approved"><ClipboardCheck size={14}/>{t('indicatorsRecords.approvedLabel')}</span>
    if(pendingReview&&stale)return <span className="indicator-approval-pending">{t('indicatorsRecords.valueChangedResaveRequired')}</span>
    if(pendingReview)return canManage?<IconButton size="sm" label={t('indicatorsRecords.approveIndicatorAction')} disabled={approvingId===snapshot.id} onClick={()=>approveSnapshot(snapshot)}><ClipboardCheck size={15}/></IconButton>:<span className="indicator-approval-pending">{t('indicatorsRecords.pendingApproval')}</span>
    return null
  })()}</td></tr>}}/>{!loading&&!filtered.length&&(rows.length?<RegistryEmptyState filtered onClearFilters={clearFilters}/>:<RegistryEmptyState icon={Activity} title={t('indicatorsRecords.noActiveIndicators')} text={t('indicatorsRecords.emptyRegistryText')} action={canManage?{label:t('indicatorsRecords.newIndicatorTitle'),icon:Plus,onClick:()=>navigate('/indicators/new')}:null}/>)}</div>
   <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
  </section>
 </Page>
}
