import { useEffect,useMemo,useState } from 'react'
import { AlertTriangle,CheckCircle2,CheckSquare2,ClipboardCheck,Clock3,ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can,CAPABILITIES } from '../../core/permissions/roles'
import { readRegistryViewState,useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { RecordActions } from '../../design-system/RecordActions'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { MetricCard } from '../../design-system/MetricCard'
import { readSessionValue,writeSessionValue } from '../../core/storage/browserStorage'
import { loadQualityRecords } from './qualityService'

const sections=[
  {id:'incidents',label:'qualityIncidents'},
  {id:'findings',label:'qualityFindings'},
  {id:'capas',label:'qualityCapas'},
  {id:'audits',label:'qualityAudits'},
]
const PAGE_SIZE_OPTIONS=[15,25,50]

export function QualityPage(){
  const {t,language,locale}=useLanguage()
  const {role,membership,tenant}=useTenant()
  const navigate=useNavigate()
  const {goTo}=useContextualNavigation('/quality')
  const savedSection=readSessionValue('limoxis.quality.section','incidents')
  const initialSection=sections.some(({id})=>id===savedSection)?savedSection:'incidents'
  const [section,setSection]=useState(initialSection)
  const registry=useRegistryMemory(`quality.${section}`)
  const saved=registry.loadViewState({query:'',status:'all',department:'all'})
  const [query,setQuery]=useState(saved.query)
  const [status,setStatus]=useState(saved.status)
  const [department,setDepartment]=useState(saved.department)
  const [rows,setRows]=useState([])
  const [loading,setLoading]=useState(true)
  const [page,setPage]=useState(1)
  const [pageSize,setPageSize]=useState(15)
  const addOns=membership?.capabilities??[];const custom=membership?.customCapabilities??[]
  const canManage=can(role,CAPABILITIES.MANAGE_QUALITY,addOns,custom)
  const canReportIncident=can(role,CAPABILITIES.REPORT_INCIDENT,addOns,custom)
  const canCreate=canManage||(section==='incidents'&&canReportIncident)

  useEffect(()=>{let active=true;setLoading(true);loadQualityRecords(section,tenant?.id).then(data=>{if(active)setRows(data)}).catch(()=>{if(active)setRows([])}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[section,tenant?.id])
  const departments=useMemo(()=>[...new Set(rows.map(x=>language==='el'?x.department:x.departmentEn).filter(Boolean))],[rows,language])
  const filtered=useMemo(()=>rows.filter(row=>`${row.id} ${row.title} ${row.titleEn} ${row.owner||''}`.toLowerCase().includes(query.toLowerCase())).filter(row=>status==='all'||row.status===status).filter(row=>department==='all'||(language==='el'?row.department:row.departmentEn)===department),[rows,query,status,department,language])
  useEffect(()=>setPage(1),[section,query,status,department,pageSize])
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));const safePage=Math.min(page,totalPages);const pagedRows=filtered.slice((safePage-1)*pageSize,safePage*pageSize)
  const openCount=rows.filter(x=>!['closed','completed'].includes(x.status)).length
  const closedCount=rows.filter(x=>['closed','completed'].includes(x.status)).length
  const highCount=rows.filter(x=>['high','critical'].includes(x.severity||x.priority)).length

  function createRecord(){if(!canCreate)return;writeSessionValue('limoxis.quality.section',section);registry.saveViewState({query,status,department});goTo(`/quality/${section}/new`,{registry:`quality.${section}`})}
  function changeSection(id){registry.saveViewState({query,status,department});writeSessionValue('limoxis.quality.section',id);setSection(id);const next=readRegistryViewState(`quality.${id}`);setQuery(next?.query||'');setStatus(next?.status||'all');setDepartment(next?.department||'all')}

  return <Page fill className="quality-registry-page" title={t('quality')} subtitle={t('qualityRecords.qualitySubtitle')} actions={canCreate?<RecordActions actions={[UI_ACTIONS.CREATE]} onAction={action=>action===UI_ACTIONS.CREATE&&createRecord()}/>:null}>
    <div className="workspace-summary quality-summary"><div className="module-summary-strip">
      <SummaryMetric icon={ClipboardCheck} label={language==='en'?'Total':'Σύνολο'} value={rows.length}/>
      <SummaryMetric icon={Clock3} label={language==='en'?'Open / active':'Ανοικτά / ενεργά'} value={openCount}/>
      <SummaryMetric icon={CheckCircle2} label={language==='en'?'Completed':'Ολοκληρωμένα'} value={closedCount}/>
      <SummaryMetric icon={AlertTriangle} label={language==='en'?'High priority':'Υψηλής προτεραιότητας'} value={highCount}/>
    </div></div>
    <div className="surface registry-workspace workspace-column workspace-fill quality-workspace">
      <nav className="tabs quality-tabs canonical-module-tabs">{sections.map(({id,label})=><button key={id} className={`tab ${section===id?'active':''}`} onClick={()=>changeSection(id)}>{t(label)}</button>)}</nav>
      <FilterBar query={query} onQueryChange={setQuery} placeholder={t('qualityRecords.searchQuality')} activeAdvancedCount={(status!=='all'?1:0)+(department!=='all'?1:0)} onClear={()=>{setQuery('');setStatus('all');setDepartment('all')}}>
        <FilterSelect label={t('status')} value={status} onChange={setStatus}><option value="all">{t('all')}</option>{[...new Set(rows.map(x=>x.status).filter(Boolean))].map(x=><option key={x} value={x}>{t(x)}</option>)}</FilterSelect>
        <FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(x=><option key={x} value={x}>{x}</option>)}</FilterSelect>
      </FilterBar>
      <div className="scroll-table" ref={registry.scrollRef}>
        <table className="data-table sticky-table quality-table"><thead><tr><th>{t('code')}</th><th>{t('title')}</th><th>{t('department')}</th><th>{t(section==='capas'?'dueDate':'date')}</th><th>{t('owner')}</th><th>{t('status')}</th></tr></thead><tbody>{pagedRows.map(row=><tr key={row.id} {...registry.rowProps(row.id)} onClick={()=>registry.openRecord(navigate,`/quality/${section}/${row.id}`,row.id,filtered.map(x=>x.id))}><td><strong>{row.id}</strong>{row.severity&&<small>{t(row.severity)}</small>}</td><td>{language==='el'?row.title:row.titleEn}</td><td>{language==='el'?row.department:row.departmentEn||'—'}</td><td>{fmtDate(row.dueDate||row.date||row.plannedDate,locale)}</td><td>{row.owner||row.leadAuditor||'—'}</td><td><span className={`status-badge ${['closed','completed'].includes(row.status)?'active':''}`}>{t(row.status)}</span></td></tr>)}</tbody></table>
        {!loading&&!filtered.length&&<div className="registry-empty-state"><strong>{language==='en'?'No quality records':'Δεν υπάρχουν καταγραφές ποιότητας'}</strong><span>{language==='en'?'No records have been created for this organization yet.':'Δεν έχουν δημιουργηθεί ακόμη εγγραφές για τον συγκεκριμένο οργανισμό.'}</span></div>}
      </div>
      <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
    </div>
  </Page>
}
function fmtDate(value,locale){return value?new Intl.DateTimeFormat(locale).format(new Date(`${value}T12:00:00`)):'—'}
function SummaryMetric({icon:Icon,label,value}){return <MetricCard icon={Icon} value={value} label={label}/>}
function RegistryPagination({language,page,totalPages,totalItems,pageSize,onPageChange,onPageSizeChange}){const en=language==='en';const start=totalItems?((page-1)*pageSize)+1:0;const end=Math.min(page*pageSize,totalItems);return <div className="registry-pagination"><div>{totalItems?`${start}–${end} ${en?'of':'από'} ${totalItems}`:(en?'0 records':'0 εγγραφές')}</div><div className="registry-pagination-controls"><label><span>{en?'Rows':'Γραμμές'}</span><select value={pageSize} onChange={e=>onPageSizeChange(Number(e.target.value))}>{PAGE_SIZE_OPTIONS.map(v=><option key={v}>{v}</option>)}</select></label><button type="button" disabled={page<=1} onClick={()=>onPageChange(page-1)}>‹</button><span>{en?'Page':'Σελίδα'} {page} / {totalPages}</span><button type="button" disabled={page>=totalPages} onClick={()=>onPageChange(page+1)}>›</button></div></div>}
