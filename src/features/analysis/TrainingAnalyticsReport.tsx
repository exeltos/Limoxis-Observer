import { useEffect,useMemo,useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cloudClient } from '../../core/supabase/cloudContext'
import { ExportMenu } from '../../design-system/ExportMenu'
import { FiguresLine } from './AnalysisPanels'
import { RegistryTable } from '../../design-system/RegistryTable'
import { downloadCsv } from '../../core/export/csvExport'
import { BarList,ChartCard,Scoreboard,TrendChart } from './AnalysisCharts'
import { ScopeComparison } from './AnalysisPanels'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import type { MetricRow } from './analysisPageModel'
import type { Translate } from '../../types/featureTypes'
import type { DomainMetrics } from './analysisTypes'

// What analysis_training_metrics returns (counts and [key, ...counts] rows).
interface TrainingDetails { assignments: number; completed: number; overdue: number; programs: number; completedInPeriod: number; trainees: number; personHours: number; averageHoursPerTrainee: number|null; missingDurationCompletions: number; hoursCoverage: number|null; byDepartment: MetricRow[]; hoursByDepartment: MetricRow[]; byProgram: MetricRow[]; byEmployee: MetricRow[]; byProfession: MetricRow[]; monthlyHours: MetricRow[] }
interface DateRange { from?: string; to?: string }
// The RPC's arguments are typed without null, and the call sends null for «all»: client without types.
const rpcClient=()=>cloudClient() as unknown as SupabaseClient

const empty: TrainingDetails={assignments:0,completed:0,overdue:0,programs:0,completedInPeriod:0,trainees:0,personHours:0,averageHoursPerTrainee:null,missingDurationCompletions:0,hoursCoverage:null,byDepartment:[],hoursByDepartment:[],byProgram:[],byEmployee:[],byProfession:[],monthlyHours:[]}
const n=(value: unknown)=>Number(value)||0
const pct=(a: unknown,b: unknown)=>b?Math.round(n(a)/n(b)*1000)/10:null

function fmt(value: unknown,en: boolean,digits=1){
 if(value==null||value==='')return '—'
 const number=Number(value)
 if(!Number.isFinite(number))return String(value)
 return new Intl.NumberFormat(en?'en-GB':'el-GR',{maximumFractionDigits:digits}).format(number)
}
function fmtHours(value: unknown,en: boolean){return `${fmt(value,en,2)} ${en?'h':'ώρες'}`}
function kpiRows(details: TrainingDetails,tx: Translate,en: boolean): MetricRow[]{
 const completion=pct(details.completed,details.assignments)
 const coverage=details.hoursCoverage==null?'—':`${fmt(details.hoursCoverage,en)}%`
 return [
  [tx('Ολοκλήρωση εκπαιδεύσεων','Training completion'),completion==null?'—':`${fmt(completion,en)}%`,tx(`${details.completed||0} από ${details.assignments||0} αναθέσεις`,`${details.completed||0} of ${details.assignments||0} assignments`),completion!=null&&completion<80?'warning':'good'],
  [tx('Ανθρωποώρες εκπαίδευσης','Training person-hours'),fmtHours(details.personHours,en),tx(`${details.completedInPeriod||0} ολοκληρώσεις · κάλυψη διάρκειας ${coverage}`,`${details.completedInPeriod||0} completions · duration coverage ${coverage}`),details.missingDurationCompletions?'warning':'good'],
  [tx('Ώρες ανά εκπαιδευόμενο','Hours per trainee'),fmtHours(details.averageHoursPerTrainee,en),tx(`${details.trainees||0} εκπαιδευόμενοι με ολοκλήρωση`,`${details.trainees||0} trainees with a completion`)],
  [tx('Εκπαιδευόμενοι','Trainees'),fmt(details.trainees,en,0),tx('διαφορετικοί εργαζόμενοι με ολοκλήρωση στην περίοδο','distinct employees with a completion in the period')],
  [tx('Εκπαιδεύσεις','Training programmes'),fmt(details.programs,en,0),tx('προγράμματα με ανάθεση στην περίοδο','programmes with an assignment in the period')],
  [tx('Εκπρόθεσμες αναθέσεις','Overdue assignments'),fmt(details.overdue,en,0),tx('πέρασε η προθεσμία ολοκλήρωσης','past the completion due date'),details.overdue?'danger':'good'],
 ]
}
function Kpis({rows}: {rows: MetricRow[]}){return <FiguresLine rows={rows}/>}

async function loadTrainingAnalytics({organizationId,range,departmentId}: {organizationId: string; range: DateRange|null; departmentId: string}): Promise<TrainingDetails>{
 const {data,error}=await rpcClient().rpc('analysis_training_metrics',{p_organization_id:organizationId||null,p_from:range?.from||null,p_to:range?.to||null,p_department_id:departmentId||null})
 if(error)throw error
 return {...empty,...(data||{})}
}

// The long lists show their first rows; «+N ακόμα» opens the rest (owner, 8/11/2026: less detail on the screen).
const SHOWN=8
function MoreRows({total,all,onToggle,tx}: {total: number; all: boolean; onToggle: ()=>void; tx: Translate}){
 if(total<=SHOWN)return null
 return <button type="button" className="analysis-matrix-more" onClick={onToggle}>{all?tx('Λιγότερα','Fewer'):tx(`+${total-SHOWN} ακόμα`,`+${total-SHOWN} more`)}</button>
}

export function TrainingAnalyticsReport({organizationId='',range,departmentId='',compareRange=null,compareLabel='',currentLabel='',tx,en=false}: {organizationId?: string; range?: DateRange|null; departmentId?: string; compareRange?: DateRange|null; compareLabel?: string; currentLabel?: string; tx: Translate; en?: boolean}){
 const [details,setDetails]=useState<TrainingDetails>(empty),[compare,setCompare]=useState<TrainingDetails|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[employeeQuery,setEmployeeQuery]=useState(''),[allPrograms,setAllPrograms]=useState(false),[allEmployees,setAllEmployees]=useState(false)
 const rangeFrom=range?.from||'',rangeTo=range?.to||'',compareFrom=compareRange?.from||'',compareTo=compareRange?.to||''
 useEffect(()=>{
  let live=true
  setLoading(true);setError('')
  const mainRange={from:rangeFrom,to:rangeTo}
  const comparisonRange=compareFrom||compareTo?{from:compareFrom,to:compareTo}:null
  Promise.all([loadTrainingAnalytics({organizationId,range:mainRange,departmentId}),comparisonRange?loadTrainingAnalytics({organizationId,range:comparisonRange,departmentId}):Promise.resolve(null)])
   .then(([main,comparison])=>{if(live){setDetails(main);setCompare(comparison)}})
   .catch(failure=>{if(live){setDetails(empty);setCompare(null);setError(failure?.message||'TRAINING_ANALYTICS_LOAD_FAILED')}})
   .finally(()=>{if(live)setLoading(false)})
  return()=>{live=false}
 },[organizationId,rangeFrom,rangeTo,departmentId,compareFrom,compareTo])

 const rows=kpiRows(details,tx,en),compareRows=compare?kpiRows(compare,tx,en):[]
 const hoursByDepartment=useMemo(()=>new Map<string,DomainMetrics>((details.hoursByDepartment||[]).map(([name,completed,trainees,hours,avg])=>[name,{completed:n(completed),trainees:n(trainees),hours:n(hours),avg:n(avg)}])),[details.hoursByDepartment])
 const departmentRows=useMemo(()=>(details.byDepartment||[]).map(([name,assigned,completed])=>{const h=hoursByDepartment.get(name)||{};return {key:name,name,assigned:n(assigned),completed:n(completed),completion:pct(completed,assigned),trainees:h.trainees??0,hours:h.hours??0,avgHours:h.avg??0}}),[details.byDepartment,hoursByDepartment])
 const programRows=useMemo(()=>details.byProgram||[],[details.byProgram])
 // «Αναλυτικά ανά εκπαίδευση» (owner, 8/11/2026: not every session): one row per training (BLS-AED held eight times is one
 // row), the most person-hours first; the Excel keeps every session.
 const programGroups=useMemo(()=>{const groups=new Map<string,DomainMetrics>();for(const [,title,,assigned,completed,,trainees,hours,overdue] of programRows){const key=String(title||'—').trim();const group=groups.get(key)||{title:key,sessions:0,assigned:0,completed:0,trainees:0,hours:0,overdue:0};group.sessions+=1;group.assigned+=n(assigned);group.completed+=n(completed);group.trainees+=n(trainees);group.hours+=n(hours);group.overdue+=n(overdue);groups.set(key,group)}return [...groups.values()].sort((a,b)=>b.hours-a.hours||a.title.localeCompare(b.title,'el'))},[programRows])
 const employeeRows=useMemo(()=>details.byEmployee||[],[details.byEmployee])
 const filteredEmployees=useMemo(()=>{const q=employeeQuery.trim().toLocaleLowerCase('el');if(!q)return employeeRows;return employeeRows.filter(([,name,department,profession])=>`${name} ${department} ${profession}`.toLocaleLowerCase('el').includes(q))},[employeeRows,employeeQuery])
 // One bar per kind of training (BLS-AED held eight times is one bar), with how many people were trained in it.
 const topPrograms=useMemo(()=>{const groups=new Map<string,DomainMetrics>();for(const [,title,,,,,trainees,hours] of programRows){if(!title)continue;const key=String(title).trim();const group=groups.get(key)||{hours:0,trainees:0};group.hours+=n(hours);group.trainees+=n(trainees);groups.set(key,group)}return [...groups.entries()].map(([title,group])=>[`${title} · ${Math.round(group.trainees)} ${tx('συμμετοχές','participations')}`,Math.round(group.hours*10)/10]).sort((a: MetricRow,b: MetricRow)=>b[1]-a[1]).slice(0,12)},[programRows]) // eslint-disable-line react-hooks/exhaustive-deps
 // No names here: how many employees are in each band of training hours.
 const hourBands=useMemo(()=>{const bands: [string,number,number][]=[[tx('Έως 5 ώρες','Up to 5 hours'),0,5],[tx('5–10 ώρες','5–10 hours'),5,10],[tx('10–20 ώρες','10–20 hours'),10,20],[tx('Πάνω από 20 ώρες','Over 20 hours'),20,Infinity]];return bands.map(([label,from,to])=>[label,employeeRows.filter(([,name,,,,,,hours])=>name&&n(hours)>from&&n(hours)<=to).length]).filter((row: MetricRow)=>row[1]>0)},[employeeRows]) // eslint-disable-line react-hooks/exhaustive-deps
 const professionHours=(details.byProfession||[]).map(([profession,,,hours])=>[profession,n(hours)]).slice(0,12)

 function exportPrograms(){downloadCsv(en?'training_programmes.csv':'εκπαίδευση_ανά_πρόγραμμα.csv',[tx('Κωδικός','Code'),tx('Εκπαίδευση','Training'),tx('Διάρκεια (ώρες)','Duration (hours)'),tx('Αναθέσεις','Assignments'),tx('Ολοκληρώθηκαν από τις αναθέσεις','Completed from assignments'),tx('Ολοκληρώσεις στην περίοδο','Completions in period'),tx('Εκπαιδευόμενοι','Trainees'),tx('Ανθρωποώρες','Person-hours'),tx('Εκπρόθεσμες','Overdue')],programRows.map(row=>row))}
 function exportEmployees(){downloadCsv(en?'training_by_employee.csv':'εκπαίδευση_ανά_εργαζόμενο.csv',[tx('Εργαζόμενος','Employee'),tx('Τμήμα','Department'),tx('Επαγγελματική κατηγορία','Professional category'),tx('Αναθέσεις','Assignments'),tx('Ολοκληρωμένες αναθέσεις','Completed assignments'),tx('Ολοκληρώσεις στην περίοδο','Completions in period'),tx('Ώρες','Hours'),tx('Εκπρόθεσμες','Overdue')],filteredEmployees.map(([,name,department,profession,assigned,completed,completedPeriod,hours,overdue])=>[name,department,profession,assigned,completed,completedPeriod,hours,overdue]))}

 if(loading)return <TableSkeleton rows={8}/>
 if(error)return <div className="analysis-signal-card"><header><div><strong>{tx('Δεν ήταν δυνατή η φόρτωση της αναφοράς εκπαίδευσης.','Training report could not be loaded.')}</strong><span>{error}</span></div></header></div>
 return <>
  <Kpis rows={rows}/>
  {compare&&<ScopeComparison title={tx('Σύγκριση εκπαίδευσης','Training comparison')} subtitle={tx('Ίδιο εύρος και ίδια φίλτρα.','Same scope and filters.')} currentRows={rows} compareRows={compareRows} currentLabel={currentLabel} compareLabel={compareLabel} tx={tx}/>} 
  {details.missingDurationCompletions>0&&<div className="governance-banner"><strong>{tx('Έλεγχος ωρών:','Hours check:')}</strong><span>{tx(`${details.missingDurationCompletions} ολοκληρώσεις δεν έχουν διάρκεια στο πρόγραμμα και δεν προσμετρώνται στις ανθρωποώρες.`,`${details.missingDurationCompletions} completions have no programme duration and are not included in person-hours.`)}</span></div>}
  <div className="analysis-chart-grid">
   <ChartCard wide title={tx('Ανθρωποώρες ανά μήνα','Person-hours by month')} subtitle={tx('Ώρες των εκπαιδεύσεων που ολοκληρώθηκαν μέσα στην επιλεγμένη περίοδο.','Hours for training completed inside the selected period.')}><TrendChart points={details.monthlyHours||[]} en={en} label={tx('Ανθρωποώρες ανά μήνα','Person-hours by month')}/></ChartCard>
   <ChartCard title={tx('Ανθρωποώρες ανά τμήμα','Person-hours by department')} subtitle={tx('Συνολικές ώρες συμμετοχής εργαζομένων ανά τμήμα.','Total employee participation hours by department.')}><BarList rows={(details.hoursByDepartment||[]).map(([name,,,hours])=>[name,n(hours)])} en={en} max={12}/></ChartCard>
   <ChartCard title={tx('Ανθρωποώρες ανά εκπαίδευση','Person-hours by programme')} subtitle={tx('Ίδιες εκπαιδεύσεις μαζί (π.χ. BLS-AED), με τον αριθμό των ατόμων που εκπαιδεύτηκαν.','Same trainings together (e.g. BLS-AED), with the number of people trained.')}><BarList rows={topPrograms} en={en} max={12}/></ChartCard>
   <ChartCard title={tx('Εκπαιδευόμενοι ανά ώρες εκπαίδευσης','Trainees by training hours')} subtitle={tx('Πόσοι εργαζόμενοι έχουν από λίγες έως πολλές ώρες εκπαίδευσης στην περίοδο.','How many employees have few to many training hours in the period.')}><BarList rows={hourBands} en={en} max={12}/></ChartCard>
   <ChartCard title={tx('Ώρες ανά επαγγελματική κατηγορία','Hours by professional category')} subtitle={tx('Ανθρωποώρες ανά επαγγελματική κατηγορία.','Person-hours by professional category.')}><BarList rows={professionHours} en={en} max={12}/></ChartCard>
  </div>
  <article className="analysis-chart-card analysis-wide-card"><header><div><strong>{tx('Εκπαίδευση ανά τμήμα','Training by department')}</strong><span>{tx('Αναθέσεις, ολοκλήρωση, εκπαιδευόμενοι και ανθρωποώρες ανά τμήμα.','Assignments, completion, trainees and person-hours by department.')}</span></div></header><Scoreboard rows={departmentRows} rowLabel={tx('Τμήμα','Department')} en={en} columns={[{key:'assigned',label:tx('Αναθέσεις','Assignments')},{key:'completed',label:tx('Ολοκληρωμένες','Completed')},{key:'completion',label:tx('Ολοκλήρωση','Completion'),format:value=>`${fmt(value,en)}%`,shade:false},{key:'trainees',label:tx('Εκπαιδευόμενοι','Trainees')},{key:'hours',label:tx('Ανθρωποώρες','Person-hours'),format:value=>fmt(value,en,2)},{key:'avgHours',label:tx('Ώρες / εκπαιδευόμενο','Hours / trainee'),format:value=>fmt(value,en,2),shade:false}]}/></article>
  <article className="analysis-chart-card analysis-wide-card"><header><div><strong>{tx('Αναλυτικά ανά εκπαίδευση','Detailed by training')}</strong><span>{tx('Κάθε εκπαίδευση μία φορά, όσες φορές κι αν έγινε· το Excel έχει κάθε κύκλο.','Each training once, however many times it was held; the Excel has every session.')}</span></div><ExportMenu compact disabled={!programRows.length} onExcel={exportPrograms}/></header><RegistryTable columns={[{key:'title',label:tx('Εκπαίδευση','Training')},{key:'sessions',label:tx('Κύκλοι','Sessions')},{key:'trainees',label:tx('Εκπαιδευόμενοι','Trainees')},{key:'completion',label:tx('Ολοκλήρωση','Completion')},{key:'hours',label:tx('Ανθρωποώρες','Person-hours')},{key:'overdue',label:tx('Εκπρόθεσμες','Overdue')}]} rows={allPrograms?programGroups:programGroups.slice(0,SHOWN)} rowKey={row=>row.title} emptyTitle={tx('Δεν υπάρχουν εκπαιδεύσεις για την περίοδο.','No training programmes for the period.')} renderRow={row=><><td><strong>{row.title}</strong></td><td>{row.sessions}</td><td>{fmt(row.trainees,en)}</td><td>{row.assigned?`${fmt(pct(row.completed,row.assigned),en)}%`:'—'}</td><td><strong>{fmt(row.hours,en,1)}</strong></td><td>{row.overdue||'—'}</td></>}/><MoreRows total={programGroups.length} all={allPrograms} onToggle={()=>setAllPrograms(value=>!value)} tx={tx}/></article>
  <article className="analysis-chart-card analysis-wide-card"><header><div><strong>{tx('Αναλυτικά ανά εκπαιδευόμενο','Detailed by trainee')}</strong><span>{tx('Ώρες και ολοκληρώσεις κάθε εργαζομένου στην επιλεγμένη περίοδο.','Hours and completions for each employee in the selected period.')}</span></div><div className="row-actions"><label className="analysis-filter-field"><span>{tx('Αναζήτηση','Search')}</span><input value={employeeQuery} onChange={event=>setEmployeeQuery(event.target.value)} placeholder={tx('Όνομα, τμήμα ή ειδικότητα','Name, department or profession')}/></label><ExportMenu compact disabled={!filteredEmployees.length} onExcel={exportEmployees}/></div></header><RegistryTable columns={[{key:'name',label:tx('Εργαζόμενος','Employee')},{key:'department',label:tx('Τμήμα','Department')},{key:'profession',label:tx('Επαγγελματική κατηγορία','Professional category')},{key:'assigned',label:tx('Αναθέσεις','Assignments')},{key:'completed',label:tx('Ολοκλ. αναθέσεων','Assigned completed')},{key:'period',label:tx('Ολοκλ. περιόδου','Period completions')},{key:'hours',label:tx('Ώρες','Hours')},{key:'overdue',label:tx('Εκπρόθεσμες','Overdue')}]} rows={allEmployees||employeeQuery?filteredEmployees:filteredEmployees.slice(0,SHOWN)} rowKey={(row,index)=>row[0]||index} emptyTitle={tx('Δεν βρέθηκαν εκπαιδευόμενοι.','No trainees found.')} renderRow={([,name,department,profession,assigned,completed,periodCompleted,hours,overdue])=><><td><strong>{name||'—'}</strong></td><td>{department||'—'}</td><td>{profession||'—'}</td><td>{assigned}</td><td>{completed}</td><td>{periodCompleted}</td><td><strong>{fmt(hours,en,2)}</strong></td><td>{overdue||'—'}</td></>}/>{!employeeQuery&&<MoreRows total={filteredEmployees.length} all={allEmployees} onToggle={()=>setAllEmployees(value=>!value)} tx={tx}/>}</article>
 </>
}
