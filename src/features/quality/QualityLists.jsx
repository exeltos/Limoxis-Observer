import { useEffect,useMemo,useState } from 'react'
import { KpiFigures } from '../../design-system/KpiCard'
import { AlertOctagon,AlertTriangle,BarChart3,Building2,CalendarDays,CheckSquare2,ClipboardCheck,ClipboardSignature,GraduationCap,ListChecks,SearchCheck,ShieldAlert,Scale,ShieldCheck,Smile,Stethoscope,Target,Truck,Users,Landmark } from 'lucide-react'
import { FilterBar,FilterDate,FilterSelect } from '../../design-system/FilterBar'
import { RegistryTotals } from '../../design-system/RegistryTotals'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { useSortedPaging,withSort } from './useSortedPaging'
import { StatusBadge } from '../../design-system/StatusBadge'
import { Meter,meterTone } from '../../design-system/MiniCharts'
import { formatDay } from '../../core/i18n/formatDay'
import { readRegistryViewState,writeRegistryViewState } from '../../core/navigation/useRegistryMemory'
import { CAPA_TYPES,qualityCode,qualityStatusTone,vocabularyLabel } from './qualityVocabulary'
import { recordOwners } from './qualityRecordRules'
import { subActionProgress } from './qualityDeviations'
import { SOURCE_KINDS,capaSourceInfo,sourceKindLabel } from './capaSources'
import { AuditProgramme } from './QualityAuditParts'
import { auditCompliance } from './qualityAudit'
import { AuditReadiness } from './audits/AuditViews'
import { SelfAssessmentPanel } from './selfAssessment/SelfAssessmentPanel'
import { AUDIT_KINDS,AUDIT_STANDARDS,standardShort } from './audits/auditStandards'
import { auditCoverage } from './audits/auditModel'
import { roleTitleText } from '../../core/i18n/roleTitles'

// The two record lists of the Quality Center that are not the reports register:
// the corrective actions (with the findings still waiting for one), and the audits.

// Closed, completed, cancelled and voided records need nothing more.
export const isOpenRecord=row=>!['closed','completed','cancelled'].includes(row.status)&&row.lifecycleStatus!=='voided'
const today=()=>new Date().toISOString().slice(0,10)
export const isOverdueAction=row=>row.kind==='capa'&&isOpenRecord(row)&&Boolean(row.dueDate)&&row.dueDate<today()

// Filters that survive opening a record and coming back (one set per list).
export function useListFilters(key,defaults){
 const [filters,setFilters]=useState(()=>({...defaults,...(readRegistryViewState(key)||{})}))
 useEffect(()=>{writeRegistryViewState(key,filters)},[key,filters])
 const set=(name,value)=>setFilters(current=>({...current,[name]:value}))
 const clear=()=>setFilters(defaults)
 return {filters,set,clear,setFilters}
}


const departmentOf=(row,en)=>(en?row.departmentEn:row.department)||''
const titleOf=(row,en)=>(en?row.titleEn:row.title)||row.title||''
const matches=(row,query)=>!query||`${row.id} ${row.displayId||''} ${qualityCode(row)} ${row.title} ${row.titleEn} ${recordOwners(row).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())

// The corrective and preventive actions, each with the record it came from (a
// finding, a report, a control, a bundle, a training, a risk or a review); and
// the findings no action handles yet, so none is left behind.
const SOON_DAYS=14
const dayDiff=date=>date?Math.round((Date.parse(`${String(date).slice(0,10)}T12:00:00Z`)-Date.parse(`${today()}T12:00:00Z`))/86400000):null
export const isDueSoonAction=row=>row.kind==='capa'&&isOpenRecord(row)&&(d=>d!=null&&d>=0&&d<=SOON_DAYS)(dayDiff(row.dueDate))
export const isVerificationAction=row=>row.kind==='capa'&&row.lifecycleStatus!=='voided'&&(row.status==='verification'||(['closed','completed'].includes(row.status)&&(row.effectivenessStatus||'pending')==='pending'&&Boolean(row.effectivenessDue)&&row.effectivenessDue<=today()))
export const isOrphanFinding=row=>row.kind==='finding'&&isOpenRecord(row)

// The kind of record an action came from, its code and where it opens: one map for every screen (capaSources).
function sourceOf(capa){
 const info=capaSourceInfo(capa.sourceId,capa.sourceType||capa.source)
 // An imported reference this map does not read keeps the kind the action was saved with.
 return info.kind==='manual'&&capa.sourceId&&SOURCE_KINDS[capa.source]?{...info,kind:capa.source,code:String(capa.sourceId).split('#')[0]}:info
}

export function actionRows(findings,capas,incidents=[]){
 const live=capas.filter(capa=>capa.lifecycleStatus!=='voided')
 const handled=new Set(live.map(capa=>capa.sourceId).filter(Boolean))
 const byId=new Map([...findings,...incidents].map(record=>[record.id,record]))
 const actions=capas.map(row=>{const origin=byId.get(row.sourceId)||null;const source=sourceOf(row);return {...row,kind:'capa',sortDate:row.dueDate||row.date,sourceKind:source.kind,sourceCode:origin?qualityCode(origin):source.code,sourcePath:source.path,sourceTitle:origin?origin.title:'',sourceTitleEn:origin?origin.titleEn||origin.title:''}})
 const orphans=findings.filter(row=>!handled.has(row.id)).map(row=>({...row,kind:'finding',sortDate:row.date,sourceKind:row.source==='audit'?'audit':row.source||'manual',sourceCode:capaSourceInfo(row.sourceId).code||String(row.sourceId||'').split('#')[0],sourceTitle:'',sourceTitleEn:''}))
 return [...orphans,...actions].sort((a,b)=>(a.kind===b.kind?0:a.kind==='finding'?-1:1)||String(b.sortDate||'').localeCompare(String(a.sortDate||'')))
}

export function filterActions(rows,filters,en){
 const q=String(filters.query||'').trim().toLowerCase()
 return rows.filter(row=>matches(row,filters.query)||(q&&`${row.sourceCode||''} ${row.sourceTitle||''} ${row.sourceTitleEn||''}`.toLowerCase().includes(q)))
  .filter(row=>filters.kind==='all'||row.kind===filters.kind)
  .filter(row=>filters.status==='all'||row.status===filters.status)
  .filter(row=>filters.department==='all'||departmentOf(row,en)===filters.department)
  .filter(row=>!filters.source||filters.source==='all'||row.sourceKind===filters.source)
  .filter(row=>!filters.cycle||filters.cycle==='all'||auditCycleKey(row)===filters.cycle)
  // «Από / Έως» on the due date (an action without one is left out once a range is set).
  .filter(row=>(!filters.dueFrom||String(row.dueDate||'')>=filters.dueFrom)&&(!filters.dueTo||(row.dueDate&&String(row.dueDate)<=filters.dueTo)))
  .filter(row=>!filters.quick||(filters.quick==='overdue'?isOverdueAction(row):filters.quick==='open'?row.kind==='capa'&&isOpenRecord(row):filters.quick==='dueSoon'?isDueSoonAction(row):filters.quick==='verification'?isVerificationAction(row):filters.quick==='orphans'?isOrphanFinding(row):true))
}

export function actionCounts(rows){
 return {open:rows.filter(row=>row.kind==='capa'&&isOpenRecord(row)).length,overdue:rows.filter(isOverdueAction).length,dueSoon:rows.filter(isDueSoonAction).length,verification:rows.filter(isVerificationAction).length,orphans:rows.filter(isOrphanFinding).length}
}

const SOURCE_ICON={finding:SearchCheck,audit:ClipboardCheck,incident:AlertTriangle,control:ClipboardCheck,bundle:ShieldCheck,training:GraduationCap,risk:ShieldAlert,review:ClipboardSignature,meeting:Users,committee:Landmark,objective:Target,survey:Smile,equipment:Stethoscope,supplier:Truck,legislation:Scale,manual:CheckSquare2}

// The due date in days: left, today, or late.
function dueText(row,en){
 const days=dayDiff(row.dueDate)
 if(days==null||!isOpenRecord(row))return ''
 if(days<0)return en?`${-days} ${-days===1?'day':'days'} late`:`${-days} ημ. καθυστέρηση`
 if(days===0)return en?'Today':'Σήμερα'
 return en?`in ${days} ${days===1?'day':'days'}`:`σε ${days} ${days===1?'ημέρα':'ημέρες'}`
}


export function ActionsList({rows,view,loading,language,t,registry,onOpen,onOpenSource=null}){
 const en=language==='en'
 const {filters,set,clear}=view
 // Findings that still wait for an action are listed under Deviations.
 const actions=useMemo(()=>rows.filter(row=>row.kind==='capa'),[rows])
 // Overdue first (the latest on top), then open by the nearest due date, closed ones last.
 const filtered=useMemo(()=>{
  const rank=row=>isOverdueAction(row)?0:isOpenRecord(row)?1:2
  return filterActions(actions,filters,en).sort((a,b)=>rank(a)-rank(b)||(rank(a)<2?String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999')):String(b.dueDate||b.date||'').localeCompare(String(a.dueDate||a.date||''))))
 },[actions,filters,en])
 const sortBy={code:row=>row.code,title:row=>titleOf(row,en),source:row=>row.sourceKind,department:row=>departmentOf(row,en),date:row=>row.dueDate,owner:row=>recordOwners(row).join(', '),status:row=>row.status}
 const paging=useSortedPaging(filtered,JSON.stringify(filters),sortBy)
 const statuses=[...new Set(actions.map(row=>row.status).filter(Boolean))]
 const departments=[...new Set(actions.map(row=>departmentOf(row,en)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el'))
 const sources=Object.keys(SOURCE_KINDS).filter(kind=>actions.some(row=>row.sourceKind===kind))
 const advanced=['status','department'].filter(key=>filters[key]!=='all').length+(filters.source&&filters.source!=='all'?1:0)+(filters.dueFrom?1:0)+(filters.dueTo?1:0)
 // Totals beside the search, counted without the quick figure; each one filters the list.
 const base=useMemo(()=>filterActions(actions,{...filters,quick:null},en),[actions,filters,en])
 const toggle=key=>()=>set('quick',filters.quick===key?null:key)
 const totals=<RegistryTotals label={en?'Totals':'Σύνολα'} items={[
  {key:'all',always:true,value:base.length,label:en?'actions':'ενέργειες',active:!filters.quick,onClick:()=>set('quick',null)},
  {key:'open',value:base.filter(row=>isOpenRecord(row)).length,label:en?'open':'ανοιχτές',active:filters.quick==='open',onClick:toggle('open')},
  {key:'overdue',value:base.filter(isOverdueAction).length,label:en?'overdue':'εκπρόθεσμες',active:filters.quick==='overdue',onClick:toggle('overdue')},
  {key:'dueSoon',value:base.filter(isDueSoonAction).length,label:en?'due in 14 days':'λήγουν σε 14 ημ.',active:filters.quick==='dueSoon',onClick:toggle('dueSoon')},
  {key:'verification',value:base.filter(isVerificationAction).length,label:en?'effectiveness check':'έλεγχος αποτελεσματικότητας',active:filters.quick==='verification',onClick:toggle('verification')},
 ]}/>
 return <>
  <FilterBar query={filters.query} onQueryChange={value=>set('query',value)} placeholder={en?'Search actions or their source…':'Αναζήτηση ενέργειας ή πηγής…'} activeAdvancedCount={advanced} onClear={clear} end={totals}>
   <FilterSelect label={t('status')} value={filters.status} onChange={value=>set('status',value)}><option value="all">{t('all')}</option>{statuses.map(value=><option key={value} value={value}>{t(value)}</option>)}</FilterSelect>
   <FilterSelect label={t('department')} value={filters.department} onChange={value=>set('department',value)}><option value="all">{t('allDepartments')}</option>{departments.map(value=><option key={value} value={value}>{value}</option>)}</FilterSelect>
   <FilterSelect label={en?'Came from':'Προέλευση'} value={filters.source||'all'} onChange={value=>set('source',value)}><option value="all">{en?'All sources':'Όλες οι προελεύσεις'}</option>{sources.map(kind=><option key={kind} value={kind}>{sourceKindLabel(kind,language)}</option>)}</FilterSelect>
   <FilterDate label={en?'Due from':'Προθεσμία από'} value={filters.dueFrom||''} onChange={value=>set('dueFrom',value)}/>
   <FilterDate label={en?'Due to':'Προθεσμία έως'} value={filters.dueTo||''} onChange={value=>set('dueTo',value)}/>
  </FilterBar>
  <div className="scroll-table" ref={registry.scrollRef}>
   <RegistryTable sort={paging.sort} onSort={paging.onSort} bare className="quality-table quality-register-table" rows={paging.rows} rowKey={row=>`${row.kind}:${row.id}`} empty={!loading&&!filtered.length} emptyFiltered={actions.length>0} onClearFilters={clear}
    columns={withSort([{key:'code',label:t('code')},{key:'title',label:t('title')},{key:'source',label:en?'Came from':'Προέλευση'},{key:'department',label:t('department')},{key:'date',label:en?'Due':'Προθεσμία'},{key:'owner',label:t('owner')},{key:'status',label:t('status')}],sortBy)}
    emptyTitle={en?'No actions':'Δεν υπάρχουν ενέργειες'} emptyText={en?'Corrective actions from reports, findings, deviations, risks and reviews appear here.':'Εδώ εμφανίζονται οι διορθωτικές ενέργειες από αναφορές, ευρήματα, αποκλίσεις, κινδύνους και ανασκοπήσεις.'}
    rowProps={row=>({...registry.rowProps(row.id),onClick:()=>onOpen(row,paging.sorted)})}
    renderRow={row=>{const Icon=SOURCE_ICON[row.sourceKind]||CheckSquare2;const overdue=isOverdueAction(row);return <>
     <td><strong>{qualityCode(row,language)}</strong><small>{vocabularyLabel(CAPA_TYPES,row.actionType||'corrective',language)}</small></td>
     <td>{titleOf(row,en)}{row.subActions?.length>0&&(({done,total})=><><small>{en?`${done}/${total} steps done`:`${done}/${total} βήματα ολοκληρώθηκαν`}</small><Meter value={done*100/total} tone={done===total?'success':'neutral'} label={en?`${done}/${total} steps done`:`${done}/${total} βήματα`}/></>)(subActionProgress(row.subActions))}</td>
     <td>{(kind=>row.sourcePath&&onOpenSource
      // The source opens on its own page (the row itself opens the action).
      ?<button type="button" className="quality-source-link" title={en?'Open the source':'Άνοιγμα της πηγής'} onClick={event=>{event.stopPropagation();onOpenSource(row)}}>{kind}{row.sourceCode&&<small>{row.sourceCode}</small>}</button>
      :<>{kind}{row.sourceCode&&<small>{row.sourceCode}</small>}</>)(<span className="quality-register-kind"><Icon size={14} aria-hidden="true"/>{sourceKindLabel(row.sourceKind,language)}</span>)}</td>
     <td>{departmentOf(row,en)||'—'}</td>
     <td className={`nowrap-cell${overdue?' quality-overdue':''}`}>{formatDay(row.dueDate,language)||'—'}{dueText(row,en)&&<small>{dueText(row,en)}</small>}</td>
     <td>{recordOwners(row).map(name=>roleTitleText(name,language)).join(', ')||'—'}</td>
     <td><StatusBadge tone={qualityStatusTone(row.status)}>{t(row.status)}</StatusBadge>{isVerificationAction(row)&&<small>{en?'Check effectiveness':'Έλεγχος αποτελεσματικότητας'}</small>}</td>
    </>}}/>
  </div>
  {filtered.length>0&&<RegistryPagination language={language} {...paging.props}/>}
 </>
}

const isPendingAudit=row=>!['completed','cancelled'].includes(row.status)&&row.lifecycleStatus!=='voided'
const AUDIT_QUICK={
 planned:row=>isPendingAudit(row)&&String(row.plannedDate||'').slice(0,4)===today().slice(0,4),
 month:row=>isPendingAudit(row)&&String(row.plannedDate||'').slice(0,7)===today().slice(0,7),
 overdue:row=>isPendingAudit(row)&&Boolean(row.plannedDate)&&row.plannedDate<today(),
 withFindings:row=>(row.openFindings||0)>0,
 completed:row=>row.status==='completed'&&String(row.completedDate||row.plannedDate||'').slice(0,4)===today().slice(0,4),
}

// Each audit with how many of its findings are still open.
export function auditRows(audits,findings=[]){
 return audits.map(audit=>({...audit,openFindings:findings.filter(finding=>finding.sourceId===audit.id&&isOpenRecord(finding)).length}))
}

// The round an audit belongs to: spring (up to June) or autumn of its year, as «2026-0» / «2026-1».
export function auditCycleKey(row){const day=String(row.completedDate||row.plannedDate||'');return day.length<7?'':`${day.slice(0,4)}-${Number(day.slice(5,7))<=6?0:1}`}
export const auditCycleName=(key,en)=>`${key.endsWith('-0')?(en?'Spring':'Άνοιξη'):(en?'Autumn':'Φθινόπωρο')} ${key.slice(0,4)}`
export function filterAudits(rows,filters,en){
 return rows.filter(row=>matches(row,filters.query))
  .filter(row=>filters.status==='all'||row.status===filters.status)
  .filter(row=>filters.type==='all'||(row.auditType||'internal')===filters.type)
  .filter(row=>!filters.standard||filters.standard==='all'||(row.standard||'other')===filters.standard)
  .filter(row=>filters.department==='all'||departmentOf(row,en)===filters.department)
  .filter(row=>!filters.quick||AUDIT_QUICK[filters.quick]?.(row)!==false)
}

// The audit figures: this year's still to do, this month's, the late ones,
// those with open findings, and the average compliance of this year's completed ones.
export function auditCounts(rows){
 const done=rows.filter(AUDIT_QUICK.completed).map(auditCompliance).filter(score=>score.rate!=null)
 return {...Object.fromEntries(Object.entries(AUDIT_QUICK).map(([id,test])=>[id,rows.filter(test).length])),compliance:done.length?Math.round(done.reduce((sum,score)=>sum+score.rate,0)/done.length):null}
}

// The audit figures in one line (as the other lists): what is left this year,
// the late ones, those with open deviations, the compliance, how many departments
// have their two audits of the year, and the departments with no next audit,
// with the button that plans them.
export function AuditsSummary({rows,counts,view,loading,language,onFill=null,filling=false}){
 const en=language==='en'
 const {filters,set}=view
 const coverage=useMemo(()=>auditCoverage(rows),[rows])
 const toggle=key=>()=>set('quick',filters.quick===key?null:key)
 const departments=coverage.full+coverage.half+coverage.none
 return <KpiFigures className="quality-kpis" label={en?'Audits':'Επιθεωρήσεις'} loading={loading} figures={[
  {key:'overdue',icon:AlertOctagon,value:counts.overdue,label:en?'Overdue':'Εκπρόθεσμες',status:counts.overdue?'danger':'good',target:en?'target: 0':'στόχος: 0',active:filters.quick==='overdue',go:toggle('overdue')},
  {key:'planned',icon:CalendarDays,value:counts.planned,label:en?'Left this year':'Μένουν φέτος',hint:counts.withFindings?(en?`${counts.withFindings} with open deviations`:`${counts.withFindings} με ανοιχτές αποκλίσεις`):null,active:filters.quick==='planned',go:toggle('planned')},
  {key:'compliance',icon:ShieldCheck,value:counts.compliance,unit:'%',label:en?'Compliance':'Συμμόρφωση',status:counts.compliance==null?null:counts.compliance>=90?'good':counts.compliance>=75?'warning':'danger',target:en?'target ≥ 90%':'στόχος ≥ 90%'},
  {key:'coverage',icon:Building2,value:departments?`${coverage.full}/${departments}`:null,label:en?'Departments with 2/2 this year':'Τμήματα με 2/2 φέτος',status:departments?(coverage.full>=departments?'good':'warning'):null,hint:coverage.noNext?(en?`${coverage.noNext} without a next audit`:`${coverage.noNext} χωρίς επόμενη επιθεώρηση`):null,go:coverage.noNext&&onFill&&!filling?onFill:undefined},
 ]}/>
}

// The audits as the year's programme (departments × months), a list, the
// clause coverage of a standard and the dashboard; the filters apply to all four.
export const AUDIT_VIEWS=[
 {id:'programme',icon:CalendarDays,label:['Πρόγραμμα','Programme']},
 {id:'list',icon:ListChecks,label:['Λίστα','List']},
 {id:'readiness',icon:BarChart3,label:['Ετοιμότητα','Readiness']},
 {id:'self',icon:ClipboardCheck,label:['Αυτοαξιολόγηση','Self-assessment']},
]
export function AuditsList({rows,view,loading,language,t,registry,onOpen,onPlan=null,onRound=null,findings=[],onOpenFinding=null,canManageSelf=false,onPrintSummary=null}){
 const en=language==='en'
 const {filters,set,clear}=view
 const [toolbarSlot,setToolbarSlot]=useState(null)
 const filtered=useMemo(()=>filterAudits(rows,filters,en),[rows,filters,en])
 const sortBy={code:row=>row.code,title:row=>titleOf(row,en),standard:row=>row.standard,type:row=>row.auditType,date:row=>row.plannedDate,compliance:row=>auditCompliance(row).rate,owner:row=>row.leadAuditor,status:row=>row.status}
 const paging=useSortedPaging(filtered,JSON.stringify(filters),sortBy)
 const statuses=[...new Set(rows.map(row=>row.status).filter(Boolean))]
 const departments=[...new Set(rows.map(row=>departmentOf(row,en)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el'))
 const advanced=['status','type','department','standard','cycle'].filter(key=>filters[key]&&filters[key]!=='all').length
 const cycles=[...new Set(rows.map(auditCycleKey).filter(Boolean))].sort().reverse()
 const mode=AUDIT_VIEWS.some(item=>item.id===filters.mode)?filters.mode:'programme'
 return <>
  <FilterBar query={filters.query} onQueryChange={value=>set('query',value)} placeholder={en?'Search audits…':'Αναζήτηση επιθεωρήσεων…'} activeAdvancedCount={advanced} onClear={()=>clear()} end={mode==='self'?<span className="quality-self-end" ref={setToolbarSlot}/>:null}>
   <FilterSelect label={en?'Standard':'Πρότυπο'} value={filters.standard||'all'} onChange={value=>set('standard',value)}><option value="all">{t('all')}</option>{AUDIT_STANDARDS.map(item=><option key={item.value} value={item.value}>{item.label[en?1:0]}</option>)}</FilterSelect>
   <FilterSelect label={t('status')} value={filters.status} onChange={value=>set('status',value)}><option value="all">{t('all')}</option>{statuses.map(value=><option key={value} value={value}>{t(value)}</option>)}</FilterSelect>
   <FilterSelect label={t('auditType')} value={filters.type} onChange={value=>set('type',value)}><option value="all">{t('all')}</option>{AUDIT_KINDS.map(item=><option key={item.value} value={item.value}>{item.label[en?1:0]}</option>)}</FilterSelect>
   <FilterSelect label={t('department')} value={filters.department} onChange={value=>set('department',value)}><option value="all">{t('allDepartments')}</option>{departments.map(value=><option key={value} value={value}>{value}</option>)}</FilterSelect>
   <FilterSelect label={en?'Round':'Κύκλος'} value={filters.cycle||'all'} onChange={value=>set('cycle',value)}><option value="all">{t('all')}</option>{cycles.map(key=><option key={key} value={key}>{auditCycleName(key,en)}</option>)}</FilterSelect>
  </FilterBar>
  {mode==='programme'&&<AuditProgramme audits={filtered} language={language} onOpen={audit=>onOpen(audit,filtered)} onPlan={onPlan} onRound={onRound} onPrint={onPrintSummary}/>}
  {mode==='self'&&<SelfAssessmentPanel query={filters.query} canManage={canManageSelf} toolbarSlot={toolbarSlot}/>}
  {mode==='readiness'&&<AuditReadiness audits={filtered} findings={findings} language={language} onOpenAudit={audit=>onOpen(audit,filtered)} onOpenFinding={onOpenFinding}/>}
  {mode==='list'&&<>
   <div className="scroll-table" ref={registry.scrollRef}>
    <RegistryTable sort={paging.sort} onSort={paging.onSort} bare className="quality-table quality-audits-table" rows={paging.rows} empty={!loading&&!filtered.length} emptyFiltered={rows.length>0} onClearFilters={()=>clear()}
     columns={withSort([{key:'code',label:t('code')},{key:'title',label:t('title')},{key:'standard',label:en?'Standard':'Πρότυπο'},{key:'type',label:t('auditType')},{key:'date',label:en?'Planned':'Ημερομηνία'},{key:'compliance',label:en?'Compliance':'Συμμόρφωση'},{key:'owner',label:en?'Lead auditor':'Επικεφαλής'},{key:'status',label:t('status')}],sortBy)}
     emptyTitle={en?'No audits':'Δεν υπάρχουν επιθεωρήσεις'} emptyText={en?'Plan the year’s audits on a questionnaire; each «Partial» or «Nonconformity» becomes a finding.':'Προγραμματίστε τις επιθεωρήσεις του έτους με ερωτηματολόγιο· κάθε «Μερική» ή «Μη συμμόρφωση» γίνεται εύρημα.'}
     rowProps={row=>({...registry.rowProps(row.id),onClick:()=>onOpen(row,paging.sorted)})}
     renderRow={row=>{const score=auditCompliance(row);return <>
      <td><strong>{qualityCode(row,language)}</strong></td>
      <td>{titleOf(row,en)}{departmentOf(row,en)&&<small>{departmentOf(row,en)}</small>}</td>
      <td className="nowrap-cell">{row.standard?standardShort(row.standard):'—'}{row.clausesScope?.length>0&&<small>{row.clausesScope.join(', ')}</small>}</td>
      <td>{vocabularyLabel(AUDIT_KINDS,row.auditType||'internal',language)}</td>
      <td className={`nowrap-cell${AUDIT_QUICK.overdue(row)?' quality-overdue':''}`}>{row.plannedMonthOnly?new Intl.DateTimeFormat(en?'en-GB':'el-GR',{month:'short',year:'numeric'}).format(new Date(`${String(row.plannedDate).slice(0,7)}-15T12:00:00Z`)):formatDay(row.plannedDate,language)||'—'}{AUDIT_QUICK.overdue(row)&&<small>{en?'Overdue':'Εκπρόθεσμη'}</small>}</td>
      <td className="quality-compliance-cell">{score.rate==null?'—':<><strong>{score.rate}%</strong><Meter value={score.rate} tone={meterTone(score.rate)} label={`${en?'Compliance':'Συμμόρφωση'} ${score.rate}%`}/></>}{row.openFindings>0&&<small className="quality-overdue-text">{en?`${row.openFindings} open ${row.openFindings===1?'finding':'findings'}`:`${row.openFindings} ${row.openFindings===1?'ανοιχτό εύρημα':'ανοιχτά ευρήματα'}`}</small>}</td>
      <td>{roleTitleText(row.leadAuditor,language)||'—'}</td>
      <td><StatusBadge tone={qualityStatusTone(row.status)}>{t(row.status)}</StatusBadge></td>
     </>}}/>
   </div>
   {filtered.length>0&&<RegistryPagination language={language} {...paging.props}/>}
  </>}
 </>
}
