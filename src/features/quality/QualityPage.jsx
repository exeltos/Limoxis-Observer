import { useMemo, useState } from 'react'
import { AlertTriangle, CheckSquare2, ClipboardCheck, Plus, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can, CAPABILITIES } from '../../core/permissions/roles'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { qualityCollections } from './qualityDemoData'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'

const sections=[
  {id:'incidents',label:'qualityIncidents',icon:AlertTriangle},
  {id:'findings',label:'qualityFindings',icon:ShieldCheck},
  {id:'capas',label:'qualityCapas',icon:CheckSquare2},
  {id:'audits',label:'qualityAudits',icon:ClipboardCheck},
]

export function QualityPage(){
  const {t,language,locale}=useLanguage()
  const {role,membership}=useTenant()
  const navigate=useNavigate()
  const {goTo}=useContextualNavigation('/quality')
  const initialSection=sessionStorage.getItem('limoxis.quality.section')||'incidents'
  const [section,setSection]=useState(initialSection)
  const registry=useRegistryMemory(`quality.${section}`)
  const saved=registry.loadViewState({query:'',status:'all',department:'all'})
  const [query,setQuery]=useState(saved.query)
  const [status,setStatus]=useState(saved.status)
  const [department,setDepartment]=useState(saved.department)
  const addOns=membership?.capabilities??[]; const custom=membership?.customCapabilities??[]
  const canManage=can(role,CAPABILITIES.MANAGE_QUALITY,addOns,custom)
  const canReportIncident=can(role,CAPABILITIES.REPORT_INCIDENT,addOns,custom)
  const rows=qualityCollections[section]||[]
  const departments=[...new Set(rows.map(x=>language==='el'?x.department:x.departmentEn).filter(Boolean))]
  const filtered=useMemo(()=>rows.filter(row=>`${row.id} ${row.title} ${row.titleEn} ${row.owner||''}`.toLowerCase().includes(query.toLowerCase())).filter(row=>status==='all'||row.status===status).filter(row=>department==='all'||(language==='el'?row.department:row.departmentEn)===department),[rows,query,status,department,language])
  const canCreate=canManage||(section==='incidents'&&canReportIncident)
  return <Page fill title={t('quality')} subtitle={t('qualitySubtitle')} actions={canCreate?<Button onClick={()=>{sessionStorage.setItem('limoxis.quality.section',section);registry.saveViewState({query,status,department});goTo(`/quality/${section}/new`,{registry:`quality.${section}`})}}><Plus size={15}/>{t(section==='incidents'?'newIncident':section==='findings'?'newFinding':section==='capas'?'newCapa':'newAudit')}</Button>:null}>
    <div className="quality-workspace workspace-fill">
      <nav className="quality-tabs">{sections.map(({id,label,icon:Icon})=><button key={id} className={section===id?'active':''} onClick={()=>{registry.saveViewState({query,status,department});sessionStorage.setItem('limoxis.quality.section',id);setSection(id);const next=JSON.parse(sessionStorage.getItem(`limoxis.registry.quality.${id}.view`)||'{}');setQuery(next.query||'');setStatus(next.status||'all');setDepartment(next.department||'all')}}><Icon size={15}/><span>{t(label)}</span><b>{qualityCollections[id]?.length||0}</b></button>)}</nav>
      <section className="surface quality-registry">
        <FilterBar query={query} onQueryChange={setQuery} placeholder={t('searchQuality')} activeAdvancedCount={(status!=='all'?1:0)+(department!=='all'?1:0)} onClear={()=>{setQuery('');setStatus('all');setDepartment('all')}}>
          <FilterSelect label={t('status')} value={status} onChange={setStatus}><option value="all">{t('all')}</option>{[...new Set(rows.map(x=>x.status))].map(x=><option key={x} value={x}>{t(x)}</option>)}</FilterSelect>
          <FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(x=><option key={x} value={x}>{x}</option>)}</FilterSelect>
        </FilterBar>
        <div className="scroll-table" ref={registry.scrollRef}><table className="data-table sticky-table quality-table"><thead><tr><th>{t('code')}</th><th>{t('title')}</th><th>{t('department')}</th><th>{t(section==='capas'?'dueDate':'date')}</th><th>{t('owner')}</th><th>{t('status')}</th></tr></thead><tbody>{filtered.map(row=><tr key={row.id} {...registry.rowProps(row.id)} onClick={()=>{sessionStorage.setItem('limoxis.quality.section',section);registry.saveViewState({query,status,department});sessionStorage.setItem('limoxis.quality.section',section);registry.saveViewState({query,status,department});registry.openRecord(navigate,`/quality/${section}/${row.id}`,row.id)}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();sessionStorage.setItem('limoxis.quality.section',section);registry.saveViewState({query,status,department});registry.openRecord(navigate,`/quality/${section}/${row.id}`,row.id)}}}><td><strong>{row.id}</strong>{row.severity&&<small>{t(row.severity)}</small>}</td><td>{language==='el'?row.title:row.titleEn}</td><td>{language==='el'?row.department:row.departmentEn}</td><td>{fmtDate(row.dueDate||row.date||row.plannedDate,locale)}</td><td>{row.owner||row.leadAuditor||'—'}</td><td><span className={`status-badge ${['closed','completed'].includes(row.status)?'active':''}`}>{t(row.status)}</span></td></tr>)}</tbody></table></div>
      </section>
    </div>
  </Page>
}
function fmtDate(value,locale){return value?new Intl.DateTimeFormat(locale).format(new Date(`${value}T12:00:00`)):'—'}
