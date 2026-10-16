import { useEffect,useMemo,useState } from 'react'
import { CalendarDays,CheckSquare2,ListChecks,SearchCheck } from 'lucide-react'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { StatusBadge } from '../../design-system/StatusBadge'
import { Meter,meterTone } from '../../design-system/MiniCharts'
import { formatDay } from '../../core/i18n/formatDay'
import { readRegistryViewState,writeRegistryViewState } from '../../core/navigation/useRegistryMemory'
import { AUDIT_TYPES,CAPA_TYPES,FINDING_SOURCES,qualityCode,qualityStatusTone,vocabularyLabel } from './qualityVocabulary'
import { recordOwners } from './qualityRecordRules'
import { subActionProgress } from './qualityDeviations'
import { AuditProgramme } from './QualityAuditParts'
import { auditCompliance } from './qualityAudit'

// The two record lists of the Quality Center that are not the reports register:
// findings with their corrective actions, and the audits.

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

// Findings and corrective actions in one list: a finding (from an audit, a
// report or by hand) leads to a corrective action; both are followed here.
export function actionRows(findings,capas){
 return [...findings.map(row=>({...row,kind:'finding',sortDate:row.date})),...capas.map(row=>({...row,kind:'capa',sortDate:row.dueDate||row.date}))]
  .sort((a,b)=>String(b.sortDate||'').localeCompare(String(a.sortDate||'')))
}

export function filterActions(rows,filters,en){
 return rows.filter(row=>matches(row,filters.query))
  .filter(row=>filters.kind==='all'||row.kind===filters.kind)
  .filter(row=>filters.status==='all'||row.status===filters.status)
  .filter(row=>filters.department==='all'||departmentOf(row,en)===filters.department)
  .filter(row=>filters.quick==='overdue'?isOverdueAction(row):filters.quick==='open'?isOpenRecord(row):true)
}

const KIND_LABEL={finding:['Εύρημα','Finding'],capa:['Ενέργεια','Action']}
// Under the kind: where a finding came from, or whether an action corrects or prevents.
const kindDetail=(row,language)=>row.kind==='finding'?vocabularyLabel(FINDING_SOURCES,row.source||'manual',language):vocabularyLabel(CAPA_TYPES,row.actionType||'corrective',language)
const KIND_ICON={finding:SearchCheck,capa:CheckSquare2}

export function ActionsList({rows,view,loading,language,t,registry,onOpen}){
 const en=language==='en'
 const {filters,set,clear}=view
 const filtered=useMemo(()=>filterActions(rows,filters,en),[rows,filters,en])
 const paging=usePaging(filtered,JSON.stringify(filters))
 const statuses=[...new Set(rows.map(row=>row.status).filter(Boolean))]
 const departments=[...new Set(rows.map(row=>departmentOf(row,en)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el'))
 const advanced=['kind','status','department'].filter(key=>filters[key]!=='all').length+(filters.quick?1:0)
 return <>
  <FilterBar query={filters.query} onQueryChange={value=>set('query',value)} placeholder={en?'Search findings and actions…':'Αναζήτηση ευρημάτων και ενεργειών…'} activeAdvancedCount={advanced} onClear={clear}>
   <FilterSelect label={en?'Kind':'Είδος'} value={filters.kind} onChange={value=>set('kind',value)}><option value="all">{en?'All':'Όλα'}</option><option value="finding">{KIND_LABEL.finding[en?1:0]}</option><option value="capa">{en?'Corrective / preventive action':'Διορθωτική / προληπτική ενέργεια'}</option></FilterSelect>
   <FilterSelect label={en?'Show':'Εμφάνιση'} value={filters.quick||'all'} onChange={value=>set('quick',value==='all'?null:value)}><option value="all">{en?'All':'Όλα'}</option><option value="open">{en?'Open only':'Μόνο ανοιχτά'}</option><option value="overdue">{en?'Overdue actions':'Εκπρόθεσμες ενέργειες'}</option></FilterSelect>
   <FilterSelect label={t('status')} value={filters.status} onChange={value=>set('status',value)}><option value="all">{t('all')}</option>{statuses.map(value=><option key={value} value={value}>{t(value)}</option>)}</FilterSelect>
   <FilterSelect label={t('department')} value={filters.department} onChange={value=>set('department',value)}><option value="all">{t('allDepartments')}</option>{departments.map(value=><option key={value} value={value}>{value}</option>)}</FilterSelect>
  </FilterBar>
  <div className="scroll-table" ref={registry.scrollRef}>
   <RegistryTable bare className="quality-table quality-register-table" rows={paging.rows} rowKey={row=>`${row.kind}:${row.id}`} empty={!loading&&!filtered.length}
    columns={[{key:'code',label:t('code')},{key:'title',label:t('title')},{key:'kind',label:en?'Kind · source':'Είδος · πηγή'},{key:'department',label:t('department')},{key:'date',label:en?'Date / due':'Ημερομηνία / προθεσμία'},{key:'owner',label:t('owner')},{key:'status',label:t('status')}]}
    emptyTitle={en?'No findings or actions':'Δεν υπάρχουν ευρήματα ή ενέργειες'} emptyText={en?'Findings from audits and reports, and the corrective actions that follow them, appear here.':'Εδώ εμφανίζονται τα ευρήματα επιθεωρήσεων και αναφορών και οι διορθωτικές ενέργειες που ακολουθούν.'}
    rowProps={row=>({...registry.rowProps(row.id),onClick:()=>onOpen(row,filtered.filter(item=>item.kind===row.kind))})}
    renderRow={row=>{const Icon=KIND_ICON[row.kind];const overdue=isOverdueAction(row);return <>
     <td><strong>{qualityCode(row,language)}</strong>{row.severity&&<small>{t(row.severity)}</small>}</td>
     <td>{titleOf(row,en)}{row.kind==='capa'&&row.subActions?.length>0&&(({done,total})=><><small>{en?`${done}/${total} steps done`:`${done}/${total} βήματα ολοκληρώθηκαν`}</small><Meter value={done*100/total} tone={done===total?'success':'neutral'} label={en?`${done}/${total} steps done`:`${done}/${total} βήματα`}/></>)(subActionProgress(row.subActions))}</td>
     <td><span className="quality-register-kind"><Icon size={14} aria-hidden="true"/>{KIND_LABEL[row.kind][en?1:0]}</span><small>{kindDetail(row,language)}</small></td>
     <td>{departmentOf(row,en)||'—'}</td>
     <td className={`nowrap-cell${overdue?' quality-overdue':''}`}>{formatDay(row.kind==='capa'?row.dueDate:row.date,language)||'—'}{overdue&&<small>{en?'Overdue':'Εκπρόθεσμη'}</small>}</td>
     <td>{recordOwners(row).join(', ')||'—'}</td>
     <td><StatusBadge tone={qualityStatusTone(row.status)}>{t(row.status)}</StatusBadge></td>
    </>}}/>
  </div>
  {filtered.length>0&&<RegistryPagination language={language} {...paging.props}/>}
 </>
}

export function filterAudits(rows,filters,en){
 return rows.filter(row=>matches(row,filters.query))
  .filter(row=>filters.status==='all'||row.status===filters.status)
  .filter(row=>filters.type==='all'||(row.auditType||'internal')===filters.type)
  .filter(row=>filters.department==='all'||departmentOf(row,en)===filters.department)
}

// The audits as a list or as the year's programme; the switch sits in the filter row.
export function AuditsList({rows,view,loading,language,t,registry,onOpen}){
 const en=language==='en'
 const {filters,set,clear}=view
 const filtered=useMemo(()=>filterAudits(rows,filters,en),[rows,filters,en])
 const paging=usePaging(filtered,JSON.stringify(filters))
 const statuses=[...new Set(rows.map(row=>row.status).filter(Boolean))]
 const departments=[...new Set(rows.map(row=>departmentOf(row,en)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el'))
 const advanced=['status','type','department'].filter(key=>filters[key]!=='all').length
 const mode=<ModeSwitch ariaLabel={en?'View':'Προβολή'} value={filters.mode} onChange={value=>set('mode',value)} options={[{value:'list',label:en?'List':'Λίστα',icon:ListChecks},{value:'programme',label:en?'Year programme':'Πρόγραμμα έτους',icon:CalendarDays}]}/>
 return <>
  <FilterBar query={filters.query} onQueryChange={value=>set('query',value)} placeholder={en?'Search audits…':'Αναζήτηση επιθεωρήσεων…'} activeAdvancedCount={advanced} onClear={()=>clear()} end={mode}>
   <FilterSelect label={t('status')} value={filters.status} onChange={value=>set('status',value)}><option value="all">{t('all')}</option>{statuses.map(value=><option key={value} value={value}>{t(value)}</option>)}</FilterSelect>
   <FilterSelect label={t('auditType')} value={filters.type} onChange={value=>set('type',value)}><option value="all">{t('all')}</option>{AUDIT_TYPES.map(item=><option key={item.value} value={item.value}>{item.label[en?1:0]}</option>)}</FilterSelect>
   <FilterSelect label={t('department')} value={filters.department} onChange={value=>set('department',value)}><option value="all">{t('allDepartments')}</option>{departments.map(value=><option key={value} value={value}>{value}</option>)}</FilterSelect>
  </FilterBar>
  {filters.mode==='programme'?<AuditProgramme audits={filtered} language={language} t={t} onOpen={audit=>onOpen(audit,filtered)}/>:<>
   <div className="scroll-table" ref={registry.scrollRef}>
    <RegistryTable bare className="quality-table quality-audits-table" rows={paging.rows} empty={!loading&&!filtered.length}
     columns={[{key:'code',label:t('code')},{key:'title',label:t('title')},{key:'type',label:t('auditType')},{key:'date',label:en?'Planned':'Ημερομηνία'},{key:'compliance',label:en?'Compliance':'Συμμόρφωση'},{key:'owner',label:en?'Lead auditor':'Επικεφαλής'},{key:'status',label:t('status')}]}
     emptyTitle={en?'No audits':'Δεν υπάρχουν επιθεωρήσεις'} emptyText={en?'Plan the year’s audits; each «No» on the checklist becomes a finding.':'Προγραμματίστε τις επιθεωρήσεις του έτους· κάθε «Όχι» στη λίστα ελέγχου γίνεται εύρημα.'}
     rowProps={row=>({...registry.rowProps(row.id),onClick:()=>onOpen(row,filtered)})}
     renderRow={row=>{const score=auditCompliance(row);return <>
      <td><strong>{qualityCode(row,language)}</strong></td>
      <td>{titleOf(row,en)}{departmentOf(row,en)&&<small>{departmentOf(row,en)}</small>}</td>
      <td>{vocabularyLabel(AUDIT_TYPES,row.auditType||'internal',language)}</td>
      <td className="nowrap-cell">{formatDay(row.plannedDate,language)||'—'}</td>
      <td className="quality-compliance-cell">{score.rate==null?'—':<><strong>{score.rate}%</strong><Meter value={score.rate} tone={meterTone(score.rate)} label={`${en?'Compliance':'Συμμόρφωση'} ${score.rate}%`}/></>}</td>
      <td>{row.leadAuditor||'—'}</td>
      <td><StatusBadge tone={qualityStatusTone(row.status)}>{t(row.status)}</StatusBadge></td>
     </>}}/>
   </div>
   {filtered.length>0&&<RegistryPagination language={language} {...paging.props}/>}
  </>}
 </>
}
