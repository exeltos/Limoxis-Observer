import { AlertTriangle,ChevronLeft,ChevronRight,Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { MONTHS } from './trainingAnnualPlan'
import './trainingAnnualPlan.css'

export const planStateText=(state,en)=>({done:en?'Completed':'Ολοκληρώθηκε',running:en?'In progress':'Σε εξέλιξη',planned:en?'Planned':'Προγραμματισμένο',overdue:en?'Overdue':'Εκπρόθεσμο'})[state]||state

const pad=n=>String(n).padStart(2,'0')
const monthEnd=(year,month)=>`${year}-${pad(month+1)}-${pad(new Date(year,month+1,0).getDate())}`

// Two views of Training share this panel: "Annual plan" (programmes month by
// month for one year) and "Retraining" (what the competence requirements call
// for, with what is still not scheduled). The page owns the year and the plan,
// so its Download button sits in the page header.
export function TrainingAnnualPlanPanel({plan,year,onYearChange,language,canManage,section='programmes',onShowRetraining}){
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

 const retraining=section==='retraining'
 const monthCells=(row,render)=>months.map((_,m)=><td key={m} className={`training-plan-month${m===currentMonth?' current':''}`}>{render(m)}</td>)

 return <div className="training-plan">
  <div className="training-plan-toolbar">
   <div className="training-plan-year">
    <IconButton label={en?'Previous year':'Προηγούμενο έτος'} onClick={()=>onYearChange(year-1)}><ChevronLeft size={16}/></IconButton>
    <strong>{year}</strong>
    <IconButton label={en?'Next year':'Επόμενο έτος'} onClick={()=>onYearChange(year+1)}><ChevronRight size={16}/></IconButton>
   </div>
   {retraining?<>
    <span><strong>{needs.length}</strong>{en?'requirements':'απαιτήσεις'}</span>
    <span><strong>{totals.due}</strong>{en?'people need retraining':'άτομα χρειάζονται επανεκπαίδευση'}</span>
    {totals.uncovered>0&&<span className="training-plan-alert"><AlertTriangle size={14}/><strong>{totals.uncovered}</strong>{en?'not scheduled':'χωρίς προγραμματισμό'}</span>}
   </>:<>
    <span><strong>{totals.programmes}</strong>{en?'programmes':'προγράμματα'}</span>
    <span><strong>{totals.done}</strong>{en?'completed':'ολοκληρώθηκαν'}</span>
    <span><strong>{totals.completed} / {totals.participants}</strong>{en?'participants completed':'συμμετέχοντες ολοκλήρωσαν'}</span>
    {totals.uncovered>0&&<button type="button" className="training-plan-alert" onClick={onShowRetraining}><AlertTriangle size={14}/><strong>{totals.uncovered}</strong>{en?'retraining not scheduled':'επανεκπαιδεύσεις χωρίς προγραμματισμό'}</button>}
   </>}
  </div>
  <div className="scroll-table">
   <table className="data-table sticky-table training-plan-table">
    <thead><tr><th>{retraining?(en?'Competence requirement':'Απαίτηση επάρκειας'):(en?'Programme':'Πρόγραμμα')}</th>{months.map((label,m)=><th key={label} className={`training-plan-month${m===currentMonth?' current':''}`}>{label}</th>)}<th>{en?'Status':'Κατάσταση'}</th></tr></thead>
    <tbody>
     {!retraining&&rows.map(row=><tr key={row.program.id} className="training-plan-row" onClick={()=>navigate(`/training/${row.program.id}`)}>
      <td><strong>{row.program.title}</strong><small>{[row.program.audience,row.participants?`${row.completed}/${row.participants} ${en?'completed':'ολοκλήρωσαν'}`:''].filter(Boolean).join(' · ')}</small></td>
      {monthCells(row,m=>row.months.includes(m)&&<span className={`training-plan-bar ${row.state}${row.months[0]===m?' first':''}${row.months[row.months.length-1]===m?' last':''}`}/>)}
      <td><span className={`training-plan-state ${row.state}`}>{planStateText(row.state,en)}</span></td>
     </tr>)}
     {!retraining&&!rows.length&&<tr><td colSpan={14} className="training-plan-empty">{en?`No programmes in ${year}.`:`Δεν υπάρχουν προγράμματα για το ${year}.`}</td></tr>}
     {retraining&&needs.map(need=><tr key={need.requirement.id} className={need.uncovered?'training-plan-need uncovered':'training-plan-need'}>
      <td><strong>{need.requirement.title}</strong><small>{need.scheduled.length?`${en?'Scheduled':'Προγραμματισμένο'}: ${need.scheduled.map(p=>p.title).join(' · ')}`:(en?'No programme scheduled':'Δεν έχει προγραμματιστεί πρόγραμμα')}</small></td>
      {monthCells(need,m=>need.months[m]>0&&<span className="training-plan-count">{need.months[m]}</span>)}
      <td>{need.uncovered?(canManage?<Button variant="secondary" onClick={()=>schedule(need)}><Plus size={14}/>{en?' Schedule':' Προγραμματισμός'}</Button>:<span className="training-plan-state overdue">{en?'Not scheduled':'Χωρίς πρόγραμμα'}</span>):<span className="training-plan-state planned">{en?'Scheduled':'Προγραμματισμένη'}</span>}</td>
     </tr>)}
     {retraining&&!needs.length&&<tr><td colSpan={14} className="training-plan-empty">{en?`No retraining is due in ${year}.`:`Δεν απαιτείται επανεκπαίδευση για το ${year}.`}</td></tr>}
    </tbody>
   </table>
  </div>
  <p className="training-plan-note">{retraining?(en?'People per month whose training required by the Competence tab expires that month; missing or expired training counts in the current month.':'Άτομα ανά μήνα που λήγει η εκπαίδευση που απαιτεί η καρτέλα Επάρκεια· όσοι δεν την έχουν ή έχει λήξει μετρώνται στον τρέχοντα μήνα.'):(en?'Bars run from each programme’s start to its due date.':'Οι μπάρες δείχνουν από την έναρξη ως την προθεσμία κάθε προγράμματος.')}</p>
 </div>
}
