import { useEffect,useMemo,useState } from 'react'
import { AlertTriangle,UserRound,CheckCircle2,ClipboardCheck,Clock3,Plus,ShieldCheck,CheckSquare2,ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { ActionButton } from '../../design-system/ActionButton'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can,CAPABILITIES,ROLES } from '../../core/permissions/roles'
import { readRegistryViewState,useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { MetricCard } from '../../design-system/MetricCard'
import { RegistryTable } from '../../design-system/RegistryTable'
import { StatusBadge } from '../../design-system/StatusBadge'
import { formatDay } from '../../core/i18n/formatDay'
import { AUDIT_TYPES,qualityStatusTone,vocabularyLabel } from './qualityVocabulary'
import { recordOwners } from './qualityRecordRules'
import { readSessionValue,writeSessionValue } from '../../core/storage/browserStorage'
import { QUALITY_RETURN_KEY as RETURN_KEY } from './qualityReturnSection'
import { loadQualityRecords } from './qualityService'
import { ReportRegister,ReportRegisterSummary,reportRegisterExport,useDeviationQueue,useReportRegister } from './QualityReportRegister'
import { subActionProgress } from './qualityDeviations'
import { useLibraries } from '../management/useLibraries'
import { DownloadMenu } from '../../design-system/DownloadMenu'
import { exportRegistry,qualityExport } from '../../core/export/registryExports'
import { RiskAssessmentsPanel } from './risk/RiskAssessmentsPanel'
import { RiskSummaryStrip } from './risk/RiskSummaryStrip'
import { useRiskAssessmentList } from './risk/useRiskAssessmentList'
import './quality.css'

const sections=[
  {id:'incidents',label:'qualityIncidents',icon:AlertTriangle},
  {id:'findings',label:'qualityFindings',icon:ShieldCheck},
  {id:'capas',label:'qualityCapas',icon:CheckSquare2},
  {id:'audits',label:'qualityAudits',icon:ClipboardCheck},
  {id:'risks',label:'qualityRisks',icon:ShieldAlert},
]


const createLabels={
  incidents:{el:'Νέο συμβάν',en:'New incident'},
  findings:{el:'Νέο εύρημα',en:'New finding'},
  capas:{el:'Νέα διορθωτική ενέργεια',en:'New CAPA'},
  audits:{el:'Νέα επιθεώρηση',en:'New audit'},
}

export function QualityPage(){
  const {t,language,locale}=useLanguage()
  const {role,membership,tenant,actualRole,isRolePreview}=useTenant()
  const navigate=useNavigate()
  const {goTo}=useContextualNavigation('/quality')
  // Entering Quality always starts on Incidents; the last tab is restored only
  // when coming back from a record opened here (the flag is consumed once).
  const [section,setSection]=useState(()=>{const saved=readSessionValue(RETURN_KEY,'');return sections.some(({id})=>id===saved)?saved:'incidents'})
  useEffect(()=>{writeSessionValue(RETURN_KEY,'')},[])
  const registry=useRegistryMemory(`quality.${section}`)
  const saved=registry.loadViewState({query:'',status:'all',department:'all'})
  const [query,setQuery]=useState(saved.query)
  const [status,setStatus]=useState(saved.status)
  // Summary cards filter the list (open / completed / high priority); clicking again clears.
  const [quick,setQuick]=useState(null)
  const quickToggle=key=>()=>setQuick(current=>current===key?null:key)
  const [department,setDepartment]=useState(saved.department)
  const [rows,setRows]=useState([])
  const [loading,setLoading]=useState(true)
  const [page,setPage]=useState(1)
  const [pageSize,setPageSize]=useState(15)
  const addOns=membership?.capabilities??[];const custom=membership?.customCapabilities??[]
  const ownerFullAccess=!isRolePreview&&actualRole===ROLES.PLATFORM_OWNER
  const canManage=ownerFullAccess||can(role,CAPABILITIES.MANAGE_QUALITY,addOns,custom)
  const canReportIncident=ownerFullAccess||can(role,CAPABILITIES.REPORT_INCIDENT,addOns,custom)
  // Reports and deviations share one register (QualityReportRegister.jsx).
  const isRegister=section==='incidents'
  // The risk assessments tab has its own list, actions and import.
  const isRisks=section==='risks'
  const riskList=useRiskAssessmentList(tenant?.id,isRisks)
  const canCreate=!isRisks&&(canManage||(section==='incidents'&&canReportIncident))
  const queue=useDeviationQueue(tenant?.id,canManage)
  const {libraries}=useLibraries()
  const categories=libraries.incidentCategories||[]
  const register=useReportRegister(isRegister?rows:[],queue.sources,language)
  const createLabel=createLabels[section]?.[language==='en'?'en':'el']||(language==='en'?'Create':'Δημιουργία')

  useEffect(()=>{let active=true;if(section==='risks'){setRows([]);setLoading(false);return()=>{active=false}};setLoading(true);loadQualityRecords(section,tenant?.id).then(data=>{if(active)setRows(data)}).catch(()=>{if(active)setRows([])}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[section,tenant?.id])
  const departments=useMemo(()=>[...new Set(rows.map(x=>language==='el'?x.department:x.departmentEn).filter(Boolean))],[rows,language])
  const filtered=useMemo(()=>rows.filter(row=>`${row.id} ${row.displayId||''} ${row.title} ${row.titleEn} ${row.owner||''}`.toLowerCase().includes(query.toLowerCase())).filter(row=>status==='all'||row.status===status).filter(row=>department==='all'||(language==='el'?row.department:row.departmentEn)===department).filter(row=>!quick||(quick==='open'?!['closed','completed'].includes(row.status):quick==='closed'?['closed','completed'].includes(row.status):['high','critical'].includes(row.severity||row.priority))),[rows,query,status,department,language,quick])
  useEffect(()=>setPage(1),[section,query,status,department,pageSize,quick])
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));const safePage=Math.min(page,totalPages);const pagedRows=filtered.slice((safePage-1)*pageSize,safePage*pageSize)
  const emptyTitle={incidents:{el:'Δεν υπάρχουν συμβάντα',en:'No incidents'},findings:{el:'Δεν υπάρχουν ευρήματα',en:'No findings'},capas:{el:'Δεν υπάρχουν διορθωτικές ενέργειες',en:'No CAPA'},audits:{el:'Δεν υπάρχουν επιθεωρήσεις',en:'No audits'}}[section]?.[language==='en'?'en':'el']
  const openCount=rows.filter(x=>!['closed','completed'].includes(x.status)).length
  const closedCount=rows.filter(x=>['closed','completed'].includes(x.status)).length
  const highCount=rows.filter(x=>['high','critical'].includes(x.severity||x.priority)).length

  function createRecord(){if(!canCreate)return;writeSessionValue(RETURN_KEY,section);registry.saveViewState({query,status,department});goTo(`/quality/${section}/new`,{registry:`quality.${section}`})}
  function createCapaFrom(prefill){writeSessionValue(RETURN_KEY,'incidents');goTo('/quality/capas/new',{registry:'quality.capas',state:{qualitySource:prefill}})}
  function changeSection(id){registry.saveViewState({query,status,department});setSection(id);setQuick(null);const next=readRegistryViewState(`quality.${id}`);setQuery(next?.query||'');setStatus(next?.status||'all');setDepartment(next?.department||'all')}

  return <Page fill className="quality-registry-page" title={t('quality')} subtitle={language==='en'?'Incidents, findings, CAPA, audits, risks and deviations in one controlled, traceable flow.':'Συμβάντα, ευρήματα, διορθωτικές ενέργειες, επιθεωρήσεις, κίνδυνοι και αποκλίσεις σε ενιαία ελεγχόμενη ροή με ιχνηλασιμότητα.'} actions={<div className="row-actions">{isRisks?null:isRegister?<DownloadMenu disabled={!register.filtered.length} onExcel={()=>exportRegistry(reportRegisterExport(register.filtered,{language,t,categories}))}/>:<DownloadMenu disabled={!filtered.length} onExcel={()=>exportRegistry(qualityExport(section,filtered,{en:language==='en',t}))}/>}{section==='incidents'&&<ActionButton label={language==='en'?'My incident reports':'Οι αναφορές συμβάντων μου'} tone="neutral" onClick={()=>goTo('/quality/my-reports')}><UserRound size={17}/><span>{language==='en'?'My reports':'Οι αναφορές μου'}</span></ActionButton>}{canCreate&&<ActionButton label={createLabel} tone="primary" onClick={createRecord}><Plus size={18}/><span>{createLabel}</span></ActionButton>}</div>}>
    {isRegister&&<ReportRegisterSummary view={register} language={language}/>}
    {isRisks&&<RiskSummaryStrip items={riskList.items} en={language==='en'} locale={locale}/>}
    {!isRegister&&!isRisks&&<div className="workspace-summary quality-summary"><div className="module-summary-strip">
      <SummaryMetric icon={ClipboardCheck} label={language==='en'?'Total':'Σύνολο'} value={rows.length} onClick={()=>setQuick(null)} active={false}/>
      <SummaryMetric icon={Clock3} label={language==='en'?'Open / active':'Ανοικτά / ενεργά'} value={openCount} onClick={quickToggle('open')} active={quick==='open'}/>
      <SummaryMetric icon={CheckCircle2} label={language==='en'?'Completed':'Ολοκληρωμένα'} value={closedCount} onClick={quickToggle('closed')} active={quick==='closed'}/>
      <SummaryMetric icon={AlertTriangle} label={language==='en'?'High priority':'Υψηλής προτεραιότητας'} value={highCount} onClick={quickToggle('high')} active={quick==='high'}/>
    </div></div>}
    <div className="surface registry-workspace workspace-column workspace-fill quality-workspace">
      <nav className="entity-record-tabs surface quality-tabs" role="tablist" aria-label={t('quality')}>{sections.map(({id,label,icon:Icon})=><button key={id} type="button" role="tab" aria-selected={section===id} className={section===id?'active':''} onClick={()=>changeSection(id)}>{Icon&&<Icon size={16}/>}<span>{id==='incidents'?(language==='en'?(canManage?'Reports & deviations':'Reports'):(canManage?'Αναφορές & αποκλίσεις':'Αναφορές')):t(label)}</span>{id==='incidents'&&register.counts.deviations>0&&<span className="quality-tab-count">{register.counts.deviations}</span>}</button>)}</nav>
      {isRisks?<RiskAssessmentsPanel list={riskList} organizationId={tenant?.id} canManage={canManage} en={language==='en'} locale={locale}/>:isRegister?<ReportRegister view={register} loading={loading||queue.loading} language={language} t={t} categories={categories} registry={registry} onCreateCapa={createCapaFrom} onOpenReport={(row,items)=>{writeSessionValue(RETURN_KEY,section);registry.openRecord(navigate,`/quality/incidents/${row.id}`,row.id,items.filter(item=>item.type==='report').map(item=>item.id))}}/>:<>
      <FilterBar query={query} onQueryChange={setQuery} placeholder={t('qualityRecords.searchQuality')} activeAdvancedCount={(status!=='all'?1:0)+(department!=='all'?1:0)} onClear={()=>{setQuery('');setStatus('all');setDepartment('all')}}>
        <FilterSelect label={t('status')} value={status} onChange={setStatus}><option value="all">{t('all')}</option>{[...new Set(rows.map(x=>x.status).filter(Boolean))].map(x=><option key={x} value={x}>{t(x)}</option>)}</FilterSelect>
        <FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(x=><option key={x} value={x}>{x}</option>)}</FilterSelect>
      </FilterBar>
      <div className="scroll-table" ref={registry.scrollRef}>
        <RegistryTable bare className="quality-table" rows={pagedRows} columns={[{key:'code',label:t('code')},{key:'title',label:t('title')},{key:'dep',label:section==='audits'?t('auditType'):t('department')},{key:'date',label:section==='audits'?(language==='en'?'Planned date':'Προγραμματισμένη ημερομηνία'):t(section==='capas'?'dueDate':'date')},{key:'owner',label:section==='audits'?t('leadAuditor'):t('owner')},{key:'status',label:t('status')}]} rowProps={row=>({...registry.rowProps(row.id),onClick:()=>{writeSessionValue(RETURN_KEY,section);registry.openRecord(navigate,`/quality/${section}/${row.id}`,row.id,filtered.map(x=>x.id))}})} renderRow={row=><>
          <td><strong>{row.displayId||row.id}</strong>{row.severity&&<small>{t(row.severity)}</small>}</td>
          <td>{language==='el'?row.title:row.titleEn}{section==='capas'&&row.subActions?.length>0&&<small>{(({done,total})=>language==='en'?`${done}/${total} steps done`:`${done}/${total} βήματα ολοκληρώθηκαν`)(subActionProgress(row.subActions))}</small>}</td>
          <td>{section==='audits'?vocabularyLabel(AUDIT_TYPES,row.auditType||'internal',language):(language==='el'?row.department:row.departmentEn)||'—'}</td>
          <td>{formatDay(row.dueDate||row.date||row.plannedDate,language)||'—'}</td>
          <td>{section==='audits'?row.leadAuditor||'—':recordOwners(row).join(', ')||'—'}</td>
          <td><StatusBadge tone={qualityStatusTone(row.status)}>{t(row.status)}</StatusBadge></td>
        </>}/>
        {!loading&&!filtered.length&&<div className="registry-empty-state"><strong>{emptyTitle}</strong><span>{language==='en'?'No records have been created for this organization yet.':'Δεν έχουν δημιουργηθεί ακόμη εγγραφές για τον συγκεκριμένο οργανισμό.'}</span></div>}
      </div>
      <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
      </>}
    </div>
  </Page>
}
function SummaryMetric({icon:Icon,label,value,onClick,active}){return <MetricCard icon={Icon} value={value} label={label} onClick={onClick} active={active}/>}
