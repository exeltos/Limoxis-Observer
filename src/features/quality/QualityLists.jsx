import { useEffect,useMemo,useState } from 'react'
import { AlertTriangle,BarChart3,CalendarDays,CheckSquare2,ClipboardCheck,ClipboardSignature,GraduationCap,ListChecks,SearchCheck,ShieldAlert,Scale,ShieldCheck,Smile,Stethoscope,Truck } from 'lucide-react'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { StatusBadge } from '../../design-system/StatusBadge'
import { Meter,meterTone } from '../../design-system/MiniCharts'
import { formatDay } from '../../core/i18n/formatDay'
import { readRegistryViewState,writeRegistryViewState } from '../../core/navigation/useRegistryMemory'
import { CAPA_TYPES,qualityCode,qualityStatusTone,vocabularyLabel } from './qualityVocabulary'
import { recordOwners } from './qualityRecordRules'
import { subActionProgress } from './qualityDeviations'
import { AuditProgramme } from './QualityAuditParts'
import { auditCompliance } from './qualityAudit'
import { AuditReadiness } from './audits/AuditViews'
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

function usePaging(items,resetKey){
 const [page,setPage]=useState(1)
 const [pageSize,setPageSize]=useState(15)
 useEffect(()=>setPage(1),[resetKey,pageSize])
 const totalPages=Math.max(1,Math.ceil(items.length/pageSize)),safePage=Math.min(page,totalPages)
 return {rows:items.slice((safePage-1)*pageSize,safePage*pageSize),props:{page:safePage,totalPages,totalItems:items.length,pageSize,onPageChange:setPage,onPageSizeChange:setPageSize}}
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

const SOURCE_KINDS={finding:['Εύρημα','Finding'],incident:['Αναφορά','Report'],control:['Έλεγχος','Control'],bundle:['Bundle','Bundle'],training:['Εκπαίδευση','Training'],risk:['Κίνδυνος','Risk'],review:['Ανασκόπηση','Review'],survey:['Έρευνα ικανοποίησης','Satisfaction survey'],equipment:['Εξοπλισμός','Equipment'],supplier:['Προμηθευτής','Supplier'],legislation:['Νομοθεσία','Legislation'],audit:['Επιθεώρηση','Audit'],manual:['Χωρίς πηγή','No source']}
function sourceKindOf(capa){
 const id=String(capa.sourceId||'')
 if(id.startsWith('FND-'))return 'finding'
 if(id.startsWith('INC-'))return 'incident'
 if(id.startsWith('CTRL-'))return 'control'
 if(id.startsWith('BND-'))return 'bundle'
 if(id.startsWith('TRAINING:'))return 'training'
 if(id.startsWith('RISK:'))return 'risk'
 if(id.startsWith('AUD-'))return 'audit'
 if(id.startsWith('SRV:'))return 'survey'
 if(id.startsWith('EQ:'))return 'equipment'
 if(id.startsWith('SUP:'))return 'supplier'
 if(id.startsWith('LEG:'))return 'legislation'
 if(id.startsWith('MR:')||capa.source==='review'||capa.sourceType==='review')return 'review'
 return id?(SOURCE_KINDS[capa.source]?capa.source:'manual'):'manual'
}
const sourceCode=(id='')=>{const value=String(id);return value.startsWith('TRAINING:')?value.slice(9):value.startsWith('RISK:')?value.split(':').slice(1).join(' · '):value.startsWith('SRV:')||value.startsWith('SUP:')||value.startsWith('LEG:')?value.slice(4):value.startsWith('EQ:')?value.slice(3):value.split('#')[0]}

export function actionRows(findings,capas,incidents=[]){
 const live=capas.filter(capa=>capa.lifecycleStatus!=='voided')
 const handled=new Set(live.map(capa=>capa.sourceId).filter(Boolean))
 const byId=new Map([...findings,...incidents].map(record=>[record.id,record]))
 const actions=capas.map(row=>{const origin=byId.get(row.sourceId)||null;return {...row,kind:'capa',sortDate:row.dueDate||row.date,sourceKind:sourceKindOf(row),sourceCode:origin?qualityCode(origin):sourceCode(row.sourceId),sourceTitle:origin?origin.title:'',sourceTitleEn:origin?origin.titleEn||origin.title:''}})
 const orphans=findings.filter(row=>!handled.has(row.id)).map(row=>({...row,kind:'finding',sortDate:row.date,sourceKind:row.source==='audit'?'audit':row.source||'manual',sourceCode:sourceCode(row.sourceId),sourceTitle:'',sourceTitleEn:''}))
 return [...orphans,...actions].sort((a,b)=>(a.kind===b.kind?0:a.kind==='finding'?-1:1)||String(b.sortDate||'').localeCompare(String(a.sortDate||'')))
}

export function filterActions(rows,filters,en){
 const q=String(filters.query||'').trim().toLowerCase()
 return rows.filter(row=>matches(row,filters.query)||(q&&`${row.sourceCode||''} ${row.sourceTitle||''} ${row.sourceTitleEn||''}`.toLowerCase().includes(q)))
  .filter(row=>filters.kind==='all'||row.kind===filters.kind)
  .filter(row=>filters.status==='all'||row.status===filters.status)
  .filter(row=>filters.department==='all'||departmentOf(row,en)===filters.department)
  .filter(row=>!filters.quick||(filters.quick==='overdue'?isOverdueAction(row):filters.quick==='open'?row.kind==='capa'&&isOpenRecord(row):filters.quick==='dueSoon'?isDueSoonAction(row):filters.quick==='verification'?isVerificationAction(row):filters.quick==='orphans'?isOrphanFinding(row):true))
}

export function actionCounts(rows){
 return {open:rows.filter(row=>row.kind==='capa'&&isOpenRecord(row)).length,overdue:rows.filter(isOverdueAction).length,dueSoon:rows.filter(isDueSoonAction).length,verification:rows.filter(isVerificationAction).length,orphans:rows.filter(isOrphanFinding).length}
}

const SOURCE_ICON={finding:SearchCheck,audit:ClipboardCheck,incident:AlertTriangle,control:ClipboardCheck,bundle:ShieldCheck,training:GraduationCap,risk:ShieldAlert,review:ClipboardSignature,survey:Smile,equipment:Stethoscope,supplier:Truck,legislation:Scale,manual:CheckSquare2}

// The due date in days: left, today, or late.
function dueText(row,en){
 const days=dayDiff(row.dueDate)
 if(days==null||!isOpenRecord(row))return ''
 if(days<0)return en?`${-days} ${-days===1?'day':'days'} late`:`${-days} ημ. καθυστέρηση`
 if(days===0)return en?'Today':'Σήμερα'
 return en?`in ${days} ${days===1?'day':'days'}`:`σε ${days} ${days===1?'ημέρα':'ημέρες'}`
}

export function ActionsSummary({counts,view,loading,language,onOrphans}){
 const en=language==='en'
 const {filters,set}=view
 const figure=(key,count,label,late=false)=><button key={key} type="button" className={`${late&&count?'is-late':''}${filters.quick===key?' is-active':''}`.trim()} onClick={()=>set('quick',filters.quick===key?null:key)}><b>{count}</b> {label}</button>
 return<p className="quality-summary-line" aria-live="polite">{loading?<span>{en?'Loading…':'Φόρτωση…'}</span>:<>
   {figure('open',counts.open,en?'open':'ανοιχτές')}
   {figure('overdue',counts.overdue,en?'overdue':'εκπρόθεσμες',true)}
   {figure('dueSoon',counts.dueSoon,en?'due in 14 days':'λήγουν σε 14 ημέρες')}
   {figure('verification',counts.verification,en?'effectiveness check':'έλεγχος αποτελεσματικότητας')}
   {counts.orphans>0&&<button type="button" className="is-late" onClick={onOrphans}><b>{counts.orphans}</b> {en?'deviations without an action':'αποκλίσεις χωρίς ενέργεια'}</button>}
  </>}</p>
}

export function ActionsList({rows,view,loading,language,t,registry,onOpen}){
 const en=language==='en'
 const {filters,set,clear}=view
 // Findings that still wait for an action are listed under Deviations.
 const actions=useMemo(()=>rows.filter(row=>row.kind==='capa'),[rows])
 const filtered=useMemo(()=>filterActions(actions,filters,en),[actions,filters,en])
 const paging=usePaging(filtered,JSON.stringify(filters))
 const statuses=[...new Set(actions.map(row=>row.status).filter(Boolean))]
 const departments=[...new Set(actions.map(row=>departmentOf(row,en)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el'))
 const advanced=['status','department'].filter(key=>filters[key]!=='all').length
 return <>
  <FilterBar query={filters.query} onQueryChange={value=>set('query',value)} placeholder={en?'Search actions or their source…':'Αναζήτηση ενέργειας ή πηγής…'} activeAdvancedCount={advanced} onClear={clear}>
   <FilterSelect label={t('status')} value={filters.status} onChange={value=>set('status',value)}><option value="all">{t('all')}</option>{statuses.map(value=><option key={value} value={value}>{t(value)}</option>)}</FilterSelect>
   <FilterSelect label={t('department')} value={filters.department} onChange={value=>set('department',value)}><option value="all">{t('allDepartments')}</option>{departments.map(value=><option key={value} value={value}>{value}</option>)}</FilterSelect>
  </FilterBar>
  <div className="scroll-table" ref={registry.scrollRef}>
   <RegistryTable bare className="quality-table quality-register-table" rows={paging.rows} rowKey={row=>`${row.kind}:${row.id}`} empty={!loading&&!filtered.length} emptyFiltered={actions.length>0} onClearFilters={clear}
    columns={[{key:'code',label:t('code')},{key:'title',label:t('title')},{key:'source',label:en?'Came from':'Προέλευση'},{key:'department',label:t('department')},{key:'date',label:en?'Due':'Προθεσμία'},{key:'owner',label:t('owner')},{key:'status',label:t('status')}]}
    emptyTitle={en?'No actions':'Δεν υπάρχουν ενέργειες'} emptyText={en?'Corrective actions from reports, findings, deviations, risks and reviews appear here.':'Εδώ εμφανίζονται οι διορθωτικές ενέργειες από αναφορές, ευρήματα, αποκλίσεις, κινδύνους και ανασκοπήσεις.'}
    rowProps={row=>({...registry.rowProps(row.id),onClick:()=>onOpen(row,filtered)})}
    renderRow={row=>{const Icon=SOURCE_ICON[row.sourceKind]||CheckSquare2;const overdue=isOverdueAction(row);return <>
     <td><strong>{qualityCode(row,language)}</strong><small>{vocabularyLabel(CAPA_TYPES,row.actionType||'corrective',language)}</small></td>
     <td>{titleOf(row,en)}{row.subActions?.length>0&&(({done,total})=><><small>{en?`${done}/${total} steps done`:`${done}/${total} βήματα ολοκληρώθηκαν`}</small><Meter value={done*100/total} tone={done===total?'success':'neutral'} label={en?`${done}/${total} steps done`:`${done}/${total} βήματα`}/></>)(subActionProgress(row.subActions))}</td>
     <td><span className="quality-register-kind"><Icon size={14} aria-hidden="true"/>{(SOURCE_KINDS[row.sourceKind]||SOURCE_KINDS.manual)[en?1:0]}</span>{row.sourceCode&&<small>{row.sourceCode}</small>}{(en?row.sourceTitleEn:row.sourceTitle)&&<small>{en?row.sourceTitleEn:row.sourceTitle}</small>}</td>
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
export function AuditsSummary({rows,counts,view,loading,language,onFill=null,filling=false,onRound=null}){
 const en=language==='en'
 const {filters,set}=view
 const coverage=useMemo(()=>auditCoverage(rows),[rows])
 const figure=(key,count,label,late=false)=><button key={key} type="button" className={`${late&&count?'is-late':''}${filters.quick===key?' is-active':''}`.trim()} onClick={()=>set('quick',filters.quick===key?null:key)}><b>{count}</b> {label}</button>
 return<p className="quality-summary-line" aria-live="polite">{loading?<span>{en?'Loading…':'Φόρτωση…'}</span>:<>
   {figure('planned',counts.planned,en?'left this year':'μένουν φέτος')}
   {figure('overdue',counts.overdue,en?'overdue':'εκπρόθεσμες',true)}
   {figure('withFindings',counts.withFindings,en?'with open deviations':'με ανοιχτές αποκλίσεις')}
   {counts.compliance!=null&&<span><b>{counts.compliance}%</b> {en?'compliance':'συμμόρφωση'}</span>}
   {coverage.rows.length>0&&<span title={en?'Departments by audits this year (target 2)':'Τμήματα ανά επιθεωρήσεις φέτος (στόχος 2)'}>{en?'This year':'Φέτος'}: <b>{coverage.full}</b> {en?'with 2/2':'με 2/2'} · <b>{coverage.half}</b> {en?'with 1/2':'με 1/2'} · <b>{coverage.none}</b> {en?'with none':'χωρίς'}</span>}
   {coverage.noNext>0&&(onFill?<button type="button" className="is-late" disabled={filling} onClick={onFill}><b>{coverage.noNext}</b> {en?'departments without a next audit — plan them':'τμήματα χωρίς επόμενη επιθεώρηση — προγραμματισμός'}</button>:<span className="is-late"><b>{coverage.noNext}</b> {en?'departments without a next audit':'τμήματα χωρίς επόμενη επιθεώρηση'}</span>)}
   {onRound&&<button type="button" onClick={onRound}>{en?'Plan an audit round':'Κύκλος επιθεώρησης'}</button>}
  </>}</p>
}

// The audits as the year's programme (departments × months), a list, the
// clause coverage of a standard and the dashboard; the filters apply to all four.
const AUDIT_VIEWS=[
 {id:'programme',icon:CalendarDays,label:['Πρόγραμμα','Programme']},
 {id:'list',icon:ListChecks,label:['Λίστα','List']},
 {id:'readiness',icon:BarChart3,label:['Ετοιμότητα','Readiness']},
]
export function AuditsList({rows,view,loading,language,t,registry,onOpen,onPlan=null,findings=[],onOpenFinding=null}){
 const en=language==='en'
 const {filters,set,clear}=view
 const filtered=useMemo(()=>filterAudits(rows,filters,en),[rows,filters,en])
 const paging=usePaging(filtered,JSON.stringify(filters))
 const statuses=[...new Set(rows.map(row=>row.status).filter(Boolean))]
 const departments=[...new Set(rows.map(row=>departmentOf(row,en)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el'))
 const advanced=['status','type','department','standard'].filter(key=>filters[key]&&filters[key]!=='all').length
 const mode=AUDIT_VIEWS.some(item=>item.id===filters.mode)?filters.mode:'programme'
 return <>
  <FilterBar query={filters.query} onQueryChange={value=>set('query',value)} placeholder={en?'Search audits…':'Αναζήτηση επιθεωρήσεων…'} activeAdvancedCount={advanced} onClear={()=>clear()}
   end={<ModeSwitch ariaLabel={en?'View':'Προβολή'} value={mode} onChange={value=>set('mode',value)} options={AUDIT_VIEWS.map(item=>({value:item.id,icon:item.icon,label:item.label[en?1:0]}))}/>}>
   <FilterSelect label={en?'Standard':'Πρότυπο'} value={filters.standard||'all'} onChange={value=>set('standard',value)}><option value="all">{t('all')}</option>{AUDIT_STANDARDS.map(item=><option key={item.value} value={item.value}>{item.label[en?1:0]}</option>)}</FilterSelect>
   <FilterSelect label={t('status')} value={filters.status} onChange={value=>set('status',value)}><option value="all">{t('all')}</option>{statuses.map(value=><option key={value} value={value}>{t(value)}</option>)}</FilterSelect>
   <FilterSelect label={t('auditType')} value={filters.type} onChange={value=>set('type',value)}><option value="all">{t('all')}</option>{AUDIT_KINDS.map(item=><option key={item.value} value={item.value}>{item.label[en?1:0]}</option>)}</FilterSelect>
   <FilterSelect label={t('department')} value={filters.department} onChange={value=>set('department',value)}><option value="all">{t('allDepartments')}</option>{departments.map(value=><option key={value} value={value}>{value}</option>)}</FilterSelect>
  </FilterBar>
  {mode==='programme'&&<AuditProgramme audits={filtered} language={language} onOpen={audit=>onOpen(audit,filtered)} onPlan={onPlan}/>}
  {mode==='readiness'&&<AuditReadiness audits={filtered} findings={findings} language={language} onOpenAudit={audit=>onOpen(audit,filtered)} onOpenFinding={onOpenFinding}/>}
  {mode==='list'&&<>
   <div className="scroll-table" ref={registry.scrollRef}>
    <RegistryTable bare className="quality-table quality-audits-table" rows={paging.rows} empty={!loading&&!filtered.length} emptyFiltered={rows.length>0} onClearFilters={()=>clear()}
     columns={[{key:'code',label:t('code')},{key:'title',label:t('title')},{key:'standard',label:en?'Standard':'Πρότυπο'},{key:'type',label:t('auditType')},{key:'date',label:en?'Planned':'Ημερομηνία'},{key:'compliance',label:en?'Compliance':'Συμμόρφωση'},{key:'owner',label:en?'Lead auditor':'Επικεφαλής'},{key:'status',label:t('status')}]}
     emptyTitle={en?'No audits':'Δεν υπάρχουν επιθεωρήσεις'} emptyText={en?'Plan the year’s audits on a questionnaire; each «Partial» or «Nonconformity» becomes a finding.':'Προγραμματίστε τις επιθεωρήσεις του έτους με ερωτηματολόγιο· κάθε «Μερική» ή «Μη συμμόρφωση» γίνεται εύρημα.'}
     rowProps={row=>({...registry.rowProps(row.id),onClick:()=>onOpen(row,filtered)})}
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
