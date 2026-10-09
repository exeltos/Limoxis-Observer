// Annual training plan: the programmes that run in a year, month by month,
// next to the retraining the competence requirements call for in each month
// (people whose training expires, or is missing now). A requirement with
// people due and no programme of its own scheduled from today on shows as
// "not scheduled", so the plan says what still has to be organised.
import { competenceMatrix } from './trainingCompetence'

export const MONTHS={
 el:['Ιαν','Φεβ','Μαρ','Απρ','Μάι','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ'],
 en:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
}

const day=value=>String(value||'').slice(0,10)
const monthOf=value=>Number(day(value).slice(5,7))-1

// Months (0-11) of `year` a programme runs in: start month to due month.
export function programMonths(program,year){
 const end=day(program.dueDate)
 const start=day(program.startDate)||end
 if(!end)return []
 const from=start.slice(0,4)<String(year)?0:start.slice(0,4)>String(year)?12:monthOf(start)
 const to=end.slice(0,4)>String(year)?11:end.slice(0,4)<String(year)?-1:monthOf(end)
 const months=[]
 for(let m=from;m<=to;m+=1)months.push(m)
 return months
}

function programPlanState(program,openCount,today){
 if(program.status==='cancelled')return 'cancelled'
 if(program.status==='completed'||(!openCount&&program.status!=='planned'&&day(program.dueDate)<today))return 'done'
 if(day(program.dueDate)<today)return 'overdue'
 if(day(program.startDate)>today||program.status==='planned')return 'planned'
 return 'running'
}

export function annualTrainingPlan({programs=[],assignments=[],certificates=[],requirements=[],employees=[],year,today=new Date().toISOString().slice(0,10)}={}){
 const y=Number(year)
 const rows=programs
  .filter(p=>p.status!=='cancelled')
  .map(program=>{
   const mine=assignments.filter(a=>a.programId===program.id)
   const completed=mine.filter(a=>a.status==='completed').length
   return {program,months:programMonths(program,y),participants:mine.length,completed,state:programPlanState(program,mine.length-completed,today)}
  })
  .filter(row=>row.months.length)
  .sort((a,b)=>a.months[0]-b.months[0]||day(a.program.dueDate).localeCompare(day(b.program.dueDate))||String(a.program.title).localeCompare(String(b.program.title)))

 // Retraining need per requirement and month. Missing training counts in the
 // current month (or January of a future year); expiries count in the month
 // they expire.
 const matrix=competenceMatrix({requirements,employees,assignments,certificates,today})
 const currentMonth=today.slice(0,4)===String(y)?monthOf(today):today.slice(0,4)<String(y)?0:null
 const needs=matrix.requirements.map((requirement,index)=>{
  const months=Array(12).fill(0)
  for(const row of matrix.rows){
   const cell=row.cells[index]
   if(!cell||cell.state==='valid'&&!cell.validUntil)continue
   if(cell.state==='missing'||cell.state==='expired'){if(currentMonth!=null)months[currentMonth]+=1;continue}
   if(cell.validUntil.slice(0,4)===String(y))months[monthOf(cell.validUntil)]+=1
  }
  const total=months.reduce((sum,n)=>sum+n,0)
  const scheduled=programs.filter(p=>(requirement.programIds||[]).includes(p.id)&&!['completed','cancelled'].includes(p.status)&&day(p.dueDate)>=today)
  return {requirement,months,total,scheduled,uncovered:total>0&&!scheduled.length}
 }).filter(need=>need.total>0)

 const participants=rows.reduce((sum,row)=>sum+row.participants,0)
 const completed=rows.reduce((sum,row)=>sum+row.completed,0)
 return {
  year:y,rows,needs,
  totals:{programmes:rows.length,done:rows.filter(r=>r.state==='done').length,participants,completed,rate:participants?Math.round(completed/participants*100):null,due:needs.reduce((sum,n)=>sum+n.total,0),uncovered:needs.filter(n=>n.uncovered).length},
 }
}

export function annualPlanExport(plan,{en,stateLabel=value=>value}={}){
 const months=MONTHS[en?'en':'el']
 return {
  name:`${en?'annual-training-plan':'etisio-plano-ekpaideusis'}-${plan.year}`,
  headers:[en?'Programme':'Πρόγραμμα',en?'Audience':'Ομάδα-στόχος',en?'Start':'Έναρξη',en?'Due':'Προθεσμία',en?'Status':'Κατάσταση',en?'Participants':'Συμμετέχοντες',en?'Completed':'Ολοκλήρωσαν',...months],
  rows:[
   ...plan.rows.map(row=>[row.program.title,row.program.audience||'',day(row.program.startDate),day(row.program.dueDate),stateLabel(row.state),row.participants,row.completed,...months.map((_,m)=>row.months.includes(m)?'●':'')]),
   ...plan.needs.map(need=>[`${en?'Retraining':'Επανεκπαίδευση'}: ${need.requirement.title}`,'','','',need.uncovered?(en?'Not scheduled':'Χωρίς προγραμματισμό'):(en?'Scheduled':'Προγραμματισμένη'),need.total,'',...need.months.map(n=>n||'')]),
  ],
 }
}
