import { AlertTriangle,ChevronLeft,ChevronRight,Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { MONTHS } from './trainingAnnualPlan'
import './trainingAnnualPlan.css'

export const planStateText=(state,en)=>({done:en?'Completed':'Ολοκληρώθηκε',running:en?'In progress':'Σε εξέλιξη',planned:en?'Planned':'Προγραμματισμένο',overdue:en?'Overdue':'Εκπρόθεσμο'})[state]||state

const pad=n=>String(n).padStart(2,'0')
const monthEnd=(year,month)=>`${year}-${pad(month+1)}-${pad(new Date(year,month+1,0).getDate())}`

// "Annual plan" view of Training: programmes month by month for one year, and
// the retraining the competence requirements call for, with what is still not
// scheduled. The page owns the year and the plan, so its Download button sits
// in the page header.
export function TrainingAnnualPlanPanel({plan,year,onYearChange,language,canManage}){
 const en=language==='en'
 const navigate=useNavigate()
 const months=MONTHS[en?'en':'el']
 const today=new Date().toISOString().slice(0,10)
 const currentMonth=today.slice(0,4)===String(year)?Number(today.slice(5,7))-1:-1
 const {rows,needs,totals}=plan

 function schedule(need){
  const first=Math.max(need.months.findIndex(n=>n>0),currentMonth,0)
  const thisMonthEnd=monthEnd(Number(today.slice(0,4)),Number(today.slice(5,7))-1)
  const dueDate=[monthEnd(year,first),thisMonthEnd].sort()[1]
  navigate('/training/new',{state:{trainingDraft:{title:need.requirement.title,audience:[...(need.requirement.positions||[]),...(need.requirement.professions||[]),...(need.requirement.departments||[])].join(' · '),dueDate,startDate:[today,`${dueDate.slice(0,8)}01`].sort()[1]}}})
 }

 const monthCells=(row,render)=>months.map((_,m)=><td key={m} className={`training-plan-month${m===currentMonth?' current':''}`}>{render(m)}</td>)

 return <div className="training-plan">
  <div className="training-plan-toolbar">
   <div className="training-plan-year">
    <IconButton label={en?'Previous year':'Προηγούμενο έτος'} onClick={()=>onYearChange(year-1)}><ChevronLeft size={16}/></IconButton>
    <strong>{year}</strong>
    <IconButton label={en?'Next year':'Επόμενο έτος'} onClick={()=>onYearChange(year+1)}><ChevronRight size={16}/></IconButton>
   </div>
   <span><strong>{totals.programmes}</strong>{en?'programmes':'προγράμματα'}</span>
   <span><strong>{totals.done}</strong>{en?'completed':'ολοκληρώθηκαν'}</span>
   <span><strong>{totals.completed} / {totals.participants}</strong>{en?'participants completed':'συμμετέχοντες ολοκλήρωσαν'}</span>
   <span><strong>{totals.due}</strong>{en?'retraining due':'χρειάζονται επανεκπαίδευση'}</span>
   {totals.uncovered>0&&<span className="training-plan-alert"><AlertTriangle size={14}/><strong>{totals.uncovered}</strong>{en?'not scheduled':'χωρίς προγραμματισμό'}</span>}
  </div>
  <div className="scroll-table">
   <table className="data-table sticky-table training-plan-table">
    <thead><tr><th>{en?'Programme':'Πρόγραμμα'}</th>{months.map((label,m)=><th key={label} className={`training-plan-month${m===currentMonth?' current':''}`}>{label}</th>)}<th>{en?'Status':'Κατάσταση'}</th></tr></thead>
    <tbody>
     {rows.map(row=><tr key={row.program.id} className="training-plan-row" onClick={()=>navigate(`/training/${row.program.id}`)}>
      <td><strong>{row.program.title}</strong><small>{[row.program.audience,row.participants?`${row.completed}/${row.participants} ${en?'completed':'ολοκλήρωσαν'}`:''].filter(Boolean).join(' · ')}</small></td>
      {monthCells(row,m=>row.months.includes(m)&&<span className={`training-plan-bar ${row.state}${row.months[0]===m?' first':''}${row.months[row.months.length-1]===m?' last':''}`}/>)}
      <td><span className={`training-plan-state ${row.state}`}>{planStateText(row.state,en)}</span></td>
     </tr>)}
     {!rows.length&&<tr><td colSpan={14} className="training-plan-empty">{en?`No programmes in ${year}.`:`Δεν υπάρχουν προγράμματα για το ${year}.`}</td></tr>}
     {needs.length>0&&<tr className="training-plan-group"><th colSpan={14}>{en?'Retraining required by the competence requirements (people per month)':'Επανεκπαίδευση που απαιτείται από την Επάρκεια (άτομα ανά μήνα)'}</th></tr>}
     {needs.map(need=><tr key={need.requirement.id} className={need.uncovered?'training-plan-need uncovered':'training-plan-need'}>
      <td><strong>{need.requirement.title}</strong><small>{need.scheduled.length?`${en?'Scheduled':'Προγραμματισμένο'}: ${need.scheduled.map(p=>p.title).join(' · ')}`:(en?'No programme scheduled':'Δεν έχει προγραμματιστεί πρόγραμμα')}</small></td>
      {monthCells(need,m=>need.months[m]>0&&<span className="training-plan-count">{need.months[m]}</span>)}
      <td>{need.uncovered?(canManage?<Button variant="secondary" onClick={()=>schedule(need)}><Plus size={14}/>{en?' Schedule':' Προγραμματισμός'}</Button>:<span className="training-plan-state overdue">{en?'Not scheduled':'Χωρίς πρόγραμμα'}</span>):<span className="training-plan-state planned">{en?'Scheduled':'Προγραμματισμένη'}</span>}</td>
     </tr>)}
    </tbody>
   </table>
  </div>
  <p className="training-plan-note">{en?'Bars run from each programme’s start to its due date. Retraining counts people whose training expires that month; missing or expired training counts in the current month.':'Οι μπάρες δείχνουν από την έναρξη ως την προθεσμία κάθε προγράμματος. Η επανεκπαίδευση μετρά όσους λήγει η εκπαίδευσή τους τον μήνα αυτό· όσοι δεν την έχουν ή έχει λήξει μετρώνται στον τρέχοντα μήνα.'}</p>
 </div>
}
