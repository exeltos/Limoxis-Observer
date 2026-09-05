import { useCallback,useEffect,useMemo,useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity,CheckCircle2,Database,Plus,RefreshCcw,Target,TrendingUp } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { MetricCard } from '../../design-system/MetricCard'
import { FilterBar,FilterDate,FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { CAPABILITIES,can,scopeFor } from '../../core/permissions/roles'
import { DATA_SCOPES } from '../../core/permissions/scopeTypes'
import { loadDepartments } from '../management/departmentsService'
import { collectCloudIndicatorMetrics,calculateCloudDefinition,loadOperationalIndicatorDefinitions,loadIndicatorSnapshots } from './indicatorCloudService'

const today=()=>new Date().toISOString().slice(0,10)
const monthStart=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`}
const categoryLabel=(category,el)=>({surveillance:el?'Επιτήρηση':'Surveillance',prevention:el?'Πρόληψη':'Prevention',workforce:el?'Προσωπικό':'Workforce',laboratory:el?'Εργαστήριο':'Laboratory',quality:el?'Ποιότητα':'Quality'}[category]||category)
const statusText=(status,el)=>status==='onTarget'?(el?'Εντός στόχου':'On target'):status==='attention'?(el?'Χρειάζεται προσοχή':'Needs attention'):(el?'Πληροφοριακό':'Context')

export function IndicatorsCloudPage(){
 const navigate=useNavigate();const {tenant,membership,role}=useTenant();const {language}=useLanguage();const {notify}=useFeedback();const el=language==='el'
 const addOns=membership?.capabilities||[],customCapabilities=membership?.customCapabilities||[];const canManage=can(role,CAPABILITIES.MANAGE_INDICATORS,addOns,customCapabilities)
 const indicatorScope=scopeFor(CAPABILITIES.VIEW_INDICATORS,{role,scopeOverrides:membership?.scopeOverrides||{}})
 const scopedDepartmentIds=membership?.previewDepartment?[membership.previewDepartment]:(membership?.departmentIds||[]),departmentScoped=indicatorScope===DATA_SCOPES.DEPARTMENT
 const defaultFrom=monthStart(),defaultTo=today()
 const [from,setFrom]=useState(defaultFrom);const [to,setTo]=useState(defaultTo);const [department,setDepartment]=useState('');const [departments,setDepartments]=useState([]);const [definitions,setDefinitions]=useState([]);const [manualValues,setManualValues]=useState({});const [rows,setRows]=useState([]);const [snapshots,setSnapshots]=useState([]);const [loading,setLoading]=useState(false);const [query,setQuery]=useState('');const [category,setCategory]=useState('all');const [page,setPage]=useState(1);const [pageSize,setPageSize]=useState(15)
 const allowedDepartments=useMemo(()=>departmentScoped?departments.filter(d=>scopedDepartmentIds.includes(d.id)):departments,[departments,departmentScoped,scopedDepartmentIds]);const effectiveDepartment=departmentScoped?(department||allowedDepartments[0]?.id||''):department
 useEffect(()=>{if(!tenant?.id)return;loadDepartments(tenant.id).then(data=>setDepartments((data||[]).filter(x=>x.is_active!==false))).catch(()=>setDepartments([]))},[tenant?.id])
 useEffect(()=>{if(!departmentScoped)return;if(!allowedDepartments.length){setDepartment('');return}if(!department||!allowedDepartments.some(d=>d.id===department))setDepartment(allowedDepartments[0].id)},[departmentScoped,allowedDepartments,department])
 const calculate=useCallback(async()=>{if(!tenant?.id||!from||!to||to<from)return;if(departmentScoped&&!effectiveDepartment)return;setLoading(true);try{const [metrics,defs,history]=await Promise.all([collectCloudIndicatorMetrics(tenant.id,{from,to,departmentId:effectiveDepartment||null}),loadOperationalIndicatorDefinitions(tenant.id,{from,to}),loadIndicatorSnapshots(tenant.id,{departmentId:effectiveDepartment||null})]);setDefinitions(defs);setSnapshots(history);const currentManual={...manualValues};for(const snap of history.filter(s=>s.period_start===from&&s.period_end===to&&s.calculation_type==='manual'))currentManual[snap.indicator_key]=String(snap.value??'');setManualValues(currentManual);setRows(defs.map(def=>calculateCloudDefinition({...def,manualValue:currentManual[def.id]},metrics)))}catch(error){notify(error?.message||(el?'Αποτυχία υπολογισμού δεικτών.':'Indicator calculation failed.'),'error')}finally{setLoading(false)}},[tenant?.id,from,to,effectiveDepartment,departmentScoped,notify,el,manualValues])
 useEffect(()=>{void calculate()},[tenant?.id,from,to,effectiveDepartment,departmentScoped])
 const filtered=useMemo(()=>rows.filter(r=>(category==='all'||r.category===category)&&`${r.titleEl} ${r.titleEn} ${r.source}`.toLowerCase().includes(query.toLowerCase())),[rows,category,query]);const onTarget=rows.filter(r=>r.status==='onTarget').length,attention=rows.filter(r=>r.status==='attention').length
 useEffect(()=>setPage(1),[query,category,effectiveDepartment,from,to,pageSize])
 const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)),safePage=Math.min(page,totalPages),pagedRows=filtered.slice((safePage-1)*pageSize,safePage*pageSize)
 const activeFilterCount=(category!=='all'?1:0)+(!departmentScoped&&department?1:0)+(from!==defaultFrom?1:0)+(to!==defaultTo?1:0)
 function clearFilters(){setQuery('');setCategory('all');if(!departmentScoped)setDepartment('');setFrom(defaultFrom);setTo(defaultTo);setPage(1)}
 return <Page fill title={el?'Δείκτες':'Indicators'} subtitle={el?'Λειτουργικοί δείκτες από εγκεκριμένους ορισμούς και πραγματικά δεδομένα.':'Operational indicators from approved definitions and live data.'} actions={<div className="row-actions"><Button variant="secondary" onClick={calculate} disabled={loading}><RefreshCcw size={15}/>{el?'Επανυπολογισμός':'Recalculate'}</Button>{canManage&&<Button onClick={()=>navigate('/indicators/new')}><Plus size={16}/>{el?'Νέος δείκτης':'New indicator'}</Button>}</div>}>
  <div className="indicator-summary-strip module-summary-strip"><MetricCard icon={Activity} value={definitions.length} label={el?'Ενεργοί ορισμοί':'Active definitions'}/><MetricCard icon={CheckCircle2} value={onTarget} label={el?'Εντός στόχου':'On target'} tone="active"/><MetricCard icon={Target} value={attention} label={el?'Χρειάζονται προσοχή':'Need attention'} tone={attention?'warning':'neutral'}/><MetricCard icon={TrendingUp} value={snapshots.filter(s=>s.status==='approved').length} label={el?'Εγκεκριμένα αποτελέσματα':'Approved results'}/></div>
  {departmentScoped&&<div className="governance-banner"><Database size={16}/><span>{el?'Οι δείκτες περιορίζονται στα τμήματα που έχουν ανατεθεί στον ρόλο σας.':'Indicators are limited to departments assigned to your role.'}</span></div>}
  <section className="surface registry-workspace workspace-column workspace-fill indicator-registry">
   <FilterBar query={query} onQueryChange={setQuery} placeholder={el?'Αναζήτηση δείκτη…':'Search indicator…'} activeAdvancedCount={activeFilterCount} onClear={clearFilters} advanced={<><FilterDate label={el?'Από':'From'} value={from} onChange={setFrom}/><FilterDate label={el?'Έως':'To'} value={to} onChange={setTo}/></>}><FilterSelect label={el?'Κατηγορία':'Category'} value={category} onChange={setCategory}><option value="all">{el?'Όλες':'All'}</option>{[...new Set(rows.map(r=>r.category))].map(x=><option key={x} value={x}>{categoryLabel(x,el)}</option>)}</FilterSelect><FilterSelect label={el?'Τμήμα':'Department'} value={effectiveDepartment} onChange={setDepartment}>{!departmentScoped&&<option value="">{el?'Όλο το νοσοκομείο':'Whole hospital'}</option>}{allowedDepartments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</FilterSelect></FilterBar>
   {to<from&&<div className="inline-empty">{el?'Η τελική ημερομηνία πρέπει να είναι μετά την αρχική.':'End date must be after start date.'}</div>}
   {loading&&<div className="inline-empty">{el?'Υπολογισμός από Supabase…':'Calculating from Supabase…'}</div>}
   <div className="scroll-table"><table className="data-table sticky-table indicator-click-table"><thead><tr><th>{el?'Δείκτης':'Indicator'}</th><th>{el?'Κατηγορία':'Category'}</th><th>{el?'Αποτέλεσμα':'Result'}</th><th>{el?'Αριθμητής / Παρονομαστής':'Numerator / denominator'}</th><th>{el?'Πηγή / Έκδοση':'Source / Version'}</th><th>{el?'Κατάσταση':'Status'}</th></tr></thead><tbody>{pagedRows.map(r=><tr key={r.definitionId||r.id} tabIndex="0" role="button" onClick={()=>r.definitionId&&navigate(`/indicators/${r.definitionId}`)} onKeyDown={e=>{if((e.key==='Enter'||e.key===' ')&&r.definitionId){e.preventDefault();navigate(`/indicators/${r.definitionId}`)}}}><td><strong>{el?r.titleEl:r.titleEn}</strong><small>{from} – {to}{r.calculation==='manual'?' · manual':''}</small></td><td>{categoryLabel(r.category,el)}</td><td className="indicator-result-cell"><strong>{r.value??'—'}</strong><small>{el?r.unit:(r.unitEn||r.unit)}</small></td><td>{r.evidence}</td><td>{r.source}<small>{r.version}</small></td><td><span className={`indicator-status ${r.status}`}>{statusText(r.status,el)}</span></td></tr>)}</tbody></table>{!loading&&!filtered.length&&<div className="registry-empty-state"><strong>{el?'Δεν υπάρχουν ενεργοί δείκτες':'No active indicators'}</strong><span>{el?'Δεν υπάρχουν δείκτες για τα ενεργά φίλτρα.':'No indicators match the active filters.'}</span></div>}</div>
   <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
  </section>
 </Page>
}
