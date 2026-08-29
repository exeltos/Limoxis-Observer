import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, CheckSquare2, ClipboardCheck, Clock3, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can, CAPABILITIES } from '../../core/permissions/roles'
import { readRegistryViewState, useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { qualityCollections } from './qualityDemoData'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { RecordActions } from '../../design-system/RecordActions'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { downloadCsv } from '../../core/export/csvExport'
import { MetricCard } from '../../design-system/MetricCard'
import { readSessionValue, writeSessionValue } from '../../core/storage/browserStorage'

const sections=[
  {id:'incidents',label:'qualityIncidents',icon:AlertTriangle},
  {id:'findings',label:'qualityFindings',icon:ShieldCheck},
  {id:'capas',label:'qualityCapas',icon:CheckSquare2},
  {id:'audits',label:'qualityAudits',icon:ClipboardCheck},
]

export function QualityPage(){
  const {t,language,locale}=useLanguage()
  const {role,membership}=useTenant()
  const {notify}=useFeedback()
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
  const addOns=membership?.capabilities??[]; const custom=membership?.customCapabilities??[]
  const canManage=can(role,CAPABILITIES.MANAGE_QUALITY,addOns,custom)
  const canReportIncident=can(role,CAPABILITIES.REPORT_INCIDENT,addOns,custom)
  const rows=useMemo(()=>(qualityCollections[section]||[]).filter(x=>x.lifecycleStatus!=='voided'),[section])
  const departments=[...new Set(rows.map(x=>language==='el'?x.department:x.departmentEn).filter(Boolean))]
  const filtered=useMemo(()=>rows.filter(row=>`${row.id} ${row.title} ${row.titleEn} ${row.owner||''}`.toLowerCase().includes(query.toLowerCase())).filter(row=>status==='all'||row.status===status).filter(row=>department==='all'||(language==='el'?row.department:row.departmentEn)===department),[rows,query,status,department,language])
  const canCreate=canManage||(section==='incidents'&&canReportIncident)
  const openCount=rows.filter(x=>!['closed','completed'].includes(x.status)).length
  const closedCount=rows.filter(x=>['closed','completed'].includes(x.status)).length
  const highCount=rows.filter(x=>['high','critical'].includes(x.severity)).length
  function pageAction(action){
    if(action===UI_ACTIONS.CREATE&&canCreate){
      writeSessionValue('limoxis.quality.section',section);registry.saveViewState({query,status,department});goTo(`/quality/${section}/new`,{registry:`quality.${section}`});return
    }
    if(action===UI_ACTIONS.PRINT){window.print();notify(language==='en'?'View is ready to print.':'Η προβολή είναι έτοιμη για εκτύπωση.','success');return}
    if(action===UI_ACTIONS.EXPORT){
      downloadCsv(`limoxis-quality-${section}.csv`,language==='en'?['Code','Title','Department','Date','Owner','Status']:['Κωδικός','Τίτλος','Τμήμα','Ημερομηνία','Υπεύθυνος','Κατάσταση'],
        filtered.map(row=>[row.id,language==='el'?row.title:row.titleEn,language==='el'?row.department:row.departmentEn,row.dueDate||row.date||row.plannedDate||'',row.owner||row.leadAuditor||'',t(row.status)]))
      notify(language==='en'?'Current Quality list exported.':'Η τρέχουσα λίστα Ποιότητας εξήχθη.','success')
    }
  }
  return <Page fill title={t('quality')} subtitle={t('qualityRecords.qualitySubtitle')} actions={<RecordActions actions={[...(canCreate?[UI_ACTIONS.CREATE]:[]),UI_ACTIONS.PRINT,UI_ACTIONS.EXPORT]} onAction={pageAction}/>}>
    <div className="workspace-summary quality-summary">
      <div className="module-summary-strip">
        <SummaryMetric icon={ClipboardCheck} label={language==='en'?'Total':'Σύνολο'} value={rows.length}/>
        <SummaryMetric icon={Clock3} label={language==='en'?'Open / active':'Ανοικτά / ενεργά'} value={openCount}/>
        <SummaryMetric icon={CheckCircle2} label={language==='en'?'Completed':'Ολοκληρωμένα'} value={closedCount}/>
        <SummaryMetric icon={AlertTriangle} label={language==='en'?'High priority':'Υψηλής προτεραιότητας'} value={highCount}/>
      </div>
    </div>
    <div className="quality-workspace workspace-fill">
      <nav className="tabs quality-tabs canonical-module-tabs">{sections.map(({id,label,icon:Icon})=><button key={id} className={`tab ${section===id?'active':''}`} onClick={()=>{registry.saveViewState({query,status,department});writeSessionValue('limoxis.quality.section',id);setSection(id);const next=readRegistryViewState(`quality.${id}`);setQuery(next?.query||'');setStatus(next?.status||'all');setDepartment(next?.department||'all')}}><Icon size={15}/><span>{t(label)}</span><b className="tab-count">{qualityCollections[id]?.length||0}</b></button>)}</nav>
      <section className="surface registry-workspace quality-registry">
        <FilterBar query={query} onQueryChange={setQuery} placeholder={t('qualityRecords.searchQuality')} activeAdvancedCount={(status!=='all'?1:0)+(department!=='all'?1:0)} onClear={()=>{setQuery('');setStatus('all');setDepartment('all')}}>
          <FilterSelect label={t('status')} value={status} onChange={setStatus}><option value="all">{t('all')}</option>{[...new Set(rows.map(x=>x.status))].map(x=><option key={x} value={x}>{t(x)}</option>)}</FilterSelect>
          <FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(x=><option key={x} value={x}>{x}</option>)}</FilterSelect>
        </FilterBar>
        <div className="scroll-table" ref={registry.scrollRef}><table className="data-table sticky-table quality-table"><thead><tr><th>{t('code')}</th><th>{t('title')}</th><th>{t('department')}</th><th>{t(section==='capas'?'dueDate':'date')}</th><th>{t('owner')}</th><th>{t('status')}</th></tr></thead><tbody>{filtered.map(row=><tr key={row.id} {...registry.rowProps(row.id)} onClick={()=>{writeSessionValue('limoxis.quality.section',section);registry.saveViewState({query,status,department});registry.openRecord(navigate,`/quality/${section}/${row.id}`,row.id,filtered.map(x=>x.id))}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();writeSessionValue('limoxis.quality.section',section);registry.saveViewState({query,status,department});registry.openRecord(navigate,`/quality/${section}/${row.id}`,row.id,filtered.map(x=>x.id))}}}><td><strong>{row.id}</strong>{row.severity&&<small>{t(row.severity)}</small>}</td><td>{language==='el'?row.title:row.titleEn}</td><td>{language==='el'?row.department:row.departmentEn}</td><td>{fmtDate(row.dueDate||row.date||row.plannedDate,locale)}</td><td>{row.owner||row.leadAuditor||'—'}</td><td><span className={`status-badge ${['closed','completed'].includes(row.status)?'active':''}`}>{t(row.status)}</span></td></tr>)}</tbody></table></div>
      </section>
    </div>
  </Page>
}
function fmtDate(value,locale){return value?new Intl.DateTimeFormat(locale).format(new Date(`${value}T12:00:00`)):'—'}

function SummaryMetric({icon:Icon,label,value}){return <MetricCard icon={Icon} value={value} label={label}/>}
