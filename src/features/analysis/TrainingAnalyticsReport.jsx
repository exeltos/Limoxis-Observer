import { useEffect,useMemo,useState } from 'react'
import { supabase } from '../../core/supabase/client'
import { ExportMenu } from '../../design-system/ExportMenu'
import { RegistryTable } from '../../design-system/RegistryTable'
import { downloadCsv } from '../../core/export/csvExport'
import { BarList,ChartCard,Scoreboard,TrendChart } from './AnalysisCharts'
import { ScopeComparison } from './AnalysisPanels'

const empty={assignments:0,completed:0,overdue:0,programs:0,completedInPeriod:0,trainees:0,personHours:0,averageHoursPerTrainee:null,missingDurationCompletions:0,hoursCoverage:null,byDepartment:[],hoursByDepartment:[],byProgram:[],byEmployee:[],byProfession:[],monthlyHours:[]}
const n=value=>Number(value)||0
const pct=(a,b)=>b?Math.round(n(a)/n(b)*1000)/10:null

function fmt(value,en,digits=1){
 if(value==null||value==='')return '—'
 const number=Number(value)
 if(!Number.isFinite(number))return String(value)
 return new Intl.NumberFormat(en?'en-GB':'el-GR',{maximumFractionDigits:digits}).format(number)
}
function fmtHours(value,en){return `${fmt(value,en,2)} ${en?'h':'ώρες'}`}
function kpiRows(details,tx,en){
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
function Kpis({rows}){return <div className="analysis-kpis">{rows.map(([label,value,hint,tone])=><article key={label} className={tone?`kpi-${tone}`:''}><span>{label}</span><strong>{value}</strong>{hint&&<small>{hint}</small>}</article>)}</div>}

async function loadTrainingAnalytics({organizationId,range,departmentId}){
 const {data,error}=await supabase.rpc('analysis_training_metrics',{p_organization_id:organizationId||null,p_from:range?.from||null,p_to:range?.to||null,p_department_id:departmentId||null})
 if(error)throw error
 return {...empty,...(data||{})}
}

export function TrainingAnalyticsReport({organizationId='',range,departmentId='',compareRange=null,compareLabel='',currentLabel='',tx,en=false}){
 const [details,setDetails]=useState(empty),[compare,setCompare]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[employeeQuery,setEmployeeQuery]=useState('')
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
 const hoursByDepartment=useMemo(()=>new Map((details.hoursByDepartment||[]).map(([name,completed,trainees,hours,avg])=>[name,{completed:n(completed),trainees:n(trainees),hours:n(hours),avg:n(avg)}])),[details.hoursByDepartment])
 const departmentRows=useMemo(()=>(details.byDepartment||[]).map(([name,assigned,completed])=>{const h=hoursByDepartment.get(name)||{};return {key:name,name,assigned:n(assigned),completed:n(completed),completion:pct(completed,assigned),trainees:h.trainees??0,hours:h.hours??0,avgHours:h.avg??0}}),[details.byDepartment,hoursByDepartment])
 const programRows=details.byProgram||[]
 const employeeRows=useMemo(()=>details.byEmployee||[],[details.byEmployee])
 const filteredEmployees=useMemo(()=>{const q=employeeQuery.trim().toLocaleLowerCase('el');if(!q)return employeeRows;return employeeRows.filter(([,name,department,profession])=>`${name} ${department} ${profession}`.toLocaleLowerCase('el').includes(q))},[employeeRows,employeeQuery])
 const topPrograms=programRows.filter(([,title])=>title).slice(0,12).map(([,title,,,,,,hours])=>[title,n(hours)])
 const topTrainees=employeeRows.slice(0,12).map(([,name,,,,,,hours])=>[name,n(hours)])
 const professionHours=(details.byProfession||[]).map(([profession,,,hours])=>[profession,n(hours)]).slice(0,12)

 function exportPrograms(){downloadCsv(en?'training_programmes.csv':'εκπαίδευση_ανά_πρόγραμμα.csv',[tx('Κωδικός','Code'),tx('Εκπαίδευση','Training'),tx('Διάρκεια (ώρες)','Duration (hours)'),tx('Αναθέσεις','Assignments'),tx('Ολοκληρώθηκαν από τις αναθέσεις','Completed from assignments'),tx('Ολοκληρώσεις στην περίοδο','Completions in period'),tx('Εκπαιδευόμενοι','Trainees'),tx('Ανθρωποώρες','Person-hours'),tx('Εκπρόθεσμες','Overdue')],programRows.map(row=>row))}
 function exportEmployees(){downloadCsv(en?'training_by_employee.csv':'εκπαίδευση_ανά_εργαζόμενο.csv',[tx('Εργαζόμενος','Employee'),tx('Τμήμα','Department'),tx('Επαγγελματική κατηγορία','Professional category'),tx('Αναθέσεις','Assignments'),tx('Ολοκληρωμένες αναθέσεις','Completed assignments'),tx('Ολοκληρώσεις στην περίοδο','Completions in period'),tx('Ώρες','Hours'),tx('Εκπρόθεσμες','Overdue')],filteredEmployees.map(([,name,department,profession,assigned,completed,completedPeriod,hours,overdue])=>[name,department,profession,assigned,completed,completedPeriod,hours,overdue]))}

 if(loading)return <div className="analysis-chart-empty">{tx('Φόρτωση αναφοράς εκπαίδευσης…','Loading training report…')}</div>
 if(error)return <div className="analysis-signal-card"><header><div><strong>{tx('Δεν ήταν δυνατή η φόρτωση της αναφοράς εκπαίδευσης.','Training report could not be loaded.')}</strong><span>{error}</span></div></header></div>
 return <>
  <Kpis rows={rows}/>
  {compare&&<ScopeComparison title={tx('Σύγκριση εκπαίδευσης','Training comparison')} subtitle={tx('Ίδιο εύρος και ίδια φίλτρα.','Same scope and filters.')} currentRows={rows} compareRows={compareRows} currentLabel={currentLabel} compareLabel={compareLabel} tx={tx}/>} 
  {details.missingDurationCompletions>0&&<div className="governance-banner"><strong>{tx('Έλεγχος ωρών:','Hours check:')}</strong><span>{tx(`${details.missingDurationCompletions} ολοκληρώσεις δεν έχουν διάρκεια στο πρόγραμμα και δεν προσμετρώνται στις ανθρωποώρες.`,`${details.missingDurationCompletions} completions have no programme duration and are not included in person-hours.`)}</span></div>}
  <div className="analysis-chart-grid">
   <ChartCard wide title={tx('Ανθρωποώρες ανά μήνα','Person-hours by month')} subtitle={tx('Ώρες των εκπαιδεύσεων που ολοκληρώθηκαν μέσα στην επιλεγμένη περίοδο.','Hours for training completed inside the selected period.')}><TrendChart points={details.monthlyHours||[]} en={en} label={tx('Ανθρωποώρες ανά μήνα','Person-hours by month')}/></ChartCard>
   <ChartCard title={tx('Ανθρωποώρες ανά τμήμα','Person-hours by department')} subtitle={tx('Συνολικές ώρες συμμετοχής εργαζομένων ανά τμήμα.','Total employee participation hours by department.')}><BarList rows={(details.hoursByDepartment||[]).map(([name,,,hours])=>[name,n(hours)])} en={en} max={12}/></ChartCard>
   <ChartCard title={tx('Ανθρωποώρες ανά εκπαίδευση','Person-hours by programme')} subtitle={tx('Διάρκεια εκπαίδευσης × ολοκληρώσεις στην περίοδο.','Programme duration × completions in the period.')}><BarList rows={topPrograms} en={en} max={12}/></ChartCard>
   <ChartCard title={tx('Ώρες ανά εκπαιδευόμενο','Hours by trainee')} subtitle={tx('Οι εργαζόμενοι με τις περισσότερες ώρες εκπαίδευσης στην περίοδο.','Employees with the most training hours in the period.')}><BarList rows={topTrainees} en={en} max={12}/></ChartCard>
   <ChartCard title={tx('Ώρες ανά επαγγελματική κατηγορία','Hours by professional category')} subtitle={tx('Ανθρωποώρες ανά επαγγελματική κατηγορία.','Person-hours by professional category.')}><BarList rows={professionHours} en={en} max={12}/></ChartCard>
  </div>
  <article className="analysis-chart-card analysis-wide-card"><header><div><strong>{tx('Εκπαίδευση ανά τμήμα','Training by department')}</strong><span>{tx('Αναθέσεις, ολοκλήρωση, εκπαιδευόμενοι και ανθρωποώρες ανά τμήμα.','Assignments, completion, trainees and person-hours by department.')}</span></div></header><Scoreboard rows={departmentRows} rowLabel={tx('Τμήμα','Department')} en={en} columns={[{key:'assigned',label:tx('Αναθέσεις','Assignments')},{key:'completed',label:tx('Ολοκληρωμένες','Completed')},{key:'completion',label:tx('Ολοκλήρωση','Completion'),format:value=>`${fmt(value,en)}%`,shade:false},{key:'trainees',label:tx('Εκπαιδευόμενοι','Trainees')},{key:'hours',label:tx('Ανθρωποώρες','Person-hours'),format:value=>fmt(value,en,2)},{key:'avgHours',label:tx('Ώρες / εκπαιδευόμενο','Hours / trainee'),format:value=>fmt(value,en,2),shade:false}]}/></article>
  <article className="analysis-chart-card analysis-wide-card"><header><div><strong>{tx('Αναλυτικά ανά εκπαίδευση','Detailed by training programme')}</strong><span>{tx('Διάρκεια, συμμετοχές, ολοκληρώσεις και πραγματικές ανθρωποώρες.','Duration, participation, completions and actual person-hours.')}</span></div><ExportMenu compact disabled={!programRows.length} onExcel={exportPrograms}/></header><RegistryTable columns={[{key:'title',label:tx('Εκπαίδευση','Training')},{key:'duration',label:tx('Διάρκεια','Duration')},{key:'assigned',label:tx('Αναθέσεις','Assignments')},{key:'completed',label:tx('Ολοκλ. αναθέσεων','Assigned completed')},{key:'period',label:tx('Ολοκλ. περιόδου','Period completions')},{key:'trainees',label:tx('Εκπαιδευόμενοι','Trainees')},{key:'hours',label:tx('Ανθρωποώρες','Person-hours')},{key:'overdue',label:tx('Εκπρόθεσμες','Overdue')}]} rows={programRows} rowKey={(row,index)=>row[0]||index} emptyTitle={tx('Δεν υπάρχουν εκπαιδεύσεις για την περίοδο.','No training programmes for the period.')} renderRow={([,title,duration,assigned,completed,periodCompleted,trainees,hours,overdue])=><><td><strong>{title||'—'}</strong></td><td>{duration?fmtHours(duration,en):'—'}</td><td>{assigned}</td><td>{completed}</td><td>{periodCompleted}</td><td>{trainees}</td><td><strong>{fmt(hours,en,2)}</strong></td><td>{overdue||'—'}</td></>}/></article>
  <article className="analysis-chart-card analysis-wide-card"><header><div><strong>{tx('Αναλυτικά ανά εκπαιδευόμενο','Detailed by trainee')}</strong><span>{tx('Ώρες και ολοκληρώσεις κάθε εργαζομένου στην επιλεγμένη περίοδο.','Hours and completions for each employee in the selected period.')}</span></div><div className="row-actions"><label className="analysis-filter-field"><span>{tx('Αναζήτηση','Search')}</span><input value={employeeQuery} onChange={event=>setEmployeeQuery(event.target.value)} placeholder={tx('Όνομα, τμήμα ή ειδικότητα','Name, department or profession')}/></label><ExportMenu compact disabled={!filteredEmployees.length} onExcel={exportEmployees}/></div></header><RegistryTable columns={[{key:'name',label:tx('Εργαζόμενος','Employee')},{key:'department',label:tx('Τμήμα','Department')},{key:'profession',label:tx('Επαγγελματική κατηγορία','Professional category')},{key:'assigned',label:tx('Αναθέσεις','Assignments')},{key:'completed',label:tx('Ολοκλ. αναθέσεων','Assigned completed')},{key:'period',label:tx('Ολοκλ. περιόδου','Period completions')},{key:'hours',label:tx('Ώρες','Hours')},{key:'overdue',label:tx('Εκπρόθεσμες','Overdue')}]} rows={filteredEmployees} rowKey={(row,index)=>row[0]||index} emptyTitle={tx('Δεν βρέθηκαν εκπαιδευόμενοι.','No trainees found.')} renderRow={([,name,department,profession,assigned,completed,periodCompleted,hours,overdue])=><><td><strong>{name||'—'}</strong></td><td>{department||'—'}</td><td>{profession||'—'}</td><td>{assigned}</td><td>{completed}</td><td>{periodCompleted}</td><td><strong>{fmt(hours,en,2)}</strong></td><td>{overdue||'—'}</td></>}/></article>
 </>
}
