import './trainingRecord.css'
import { useEffect,useMemo,useRef,useState } from 'react'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { CheckboxField } from '../../design-system/CheckboxField'
import { MultiSelect } from '../../design-system/MultiSelect'
import { departmentAssignmentMessage } from './trainingDepartmentAssign'
import type { DepartmentAssignPreview,DepartmentAssignSelection,DepartmentRef } from './trainingDepartmentAssign'
import type { FeedbackContextValue } from '../../core/feedback/feedbackTypes'

// «Ανάθεση σε τμήματα» (owner, 21/11/2026): one or more departments, or the whole hospital; every active employee of
// them becomes a participant (whoever participates already is not added twice). Before applying, a confirmation says
// how many will be added: «Θα προστεθούν N εργαζόμενοι από ΜΕΘ, ΤΕΠ».
interface TrainingAssignDepartmentsDialogProps { en: boolean, departments: DepartmentRef[], preview: (selection: DepartmentAssignSelection)=>Promise<DepartmentAssignPreview>, onApply: (selection: DepartmentAssignSelection)=>Promise<unknown>, onClose: ()=>void, confirm: FeedbackContextValue['confirm'], busy?: boolean }
export function TrainingAssignDepartmentsDialog({en,departments,preview,onApply,onClose,confirm,busy=false}: TrainingAssignDepartmentsDialogProps){
 const [selection,setSelection]=useState<DepartmentAssignSelection>({all:false,departmentIds:[],followNew:false}),[counts,setCounts]=useState<DepartmentAssignPreview|null>(null),[counting,setCounting]=useState(false)
 const options=useMemo(()=>departments.filter(department=>department.id).map(department=>({value:department.id as string,label:(en?department.nameEn||department.name:department.name)||''})).sort((a,b)=>a.label.localeCompare(b.label,en?'en':'el')),[departments,en])
 const chosen=selection.all||selection.departmentIds.length>0
 // The counts follow the departments chosen (in a hospital the server counts); the latest preview is used.
 const previewRef=useRef(preview);previewRef.current=preview
 const scopeKey=JSON.stringify([selection.all,selection.departmentIds])
 useEffect(()=>{
  let active=true
  const [all,departmentIds]=JSON.parse(scopeKey) as [boolean,string[]]
  if(!all&&!departmentIds.length){setCounts(null);return()=>{active=false}}
  setCounting(true)
  previewRef.current({all,departmentIds,followNew:false}).then(next=>{if(active)setCounts(next)}).catch(()=>{if(active)setCounts(null)}).finally(()=>{if(active)setCounting(false)})
  return()=>{active=false}
 },[scopeKey])
 const set=(patch: Partial<DepartmentAssignSelection>)=>setSelection(current=>({...current,...patch}))
 const nothingToDo=!counts||(counts.toAdd===0&&!selection.followNew)
 async function apply(){
  if(!chosen||!counts||busy)return
  const message=`${departmentAssignmentMessage(counts.toAdd,selection,departments,en)}.${selection.followNew?(en?' People added to these departments later will be added automatically.':' Όσοι προστεθούν αργότερα στα τμήματα θα προστίθενται αυτόματα.'):''}`
  if(!await confirm({title:en?'Assign to departments':'Ανάθεση σε τμήματα',message,confirmLabel:en?'Assign':'Ανάθεση'}))return
  await onApply(selection)
 }
 const countsText=!chosen?(en?'Choose departments or the whole hospital.':'Επιλέξτε τμήματα ή όλο το νοσοκομείο.'):counting&&!counts?(en?'Counting…':'Υπολογισμός…'):counts?`${en?'To be added':'Θα προστεθούν'}: ${counts.toAdd} · ${en?'already participating':'συμμετέχουν ήδη'}: ${counts.already}`:'—'
 return <ObserverDialog width="compact" className="training-assign-departments" title={en?'Assign to departments':'Ανάθεση σε τμήματα'} subtitle={en?'All active employees of the departments become participants; whoever already participates is not added again.':'Όλοι οι ενεργοί εργαζόμενοι των τμημάτων γίνονται συμμετέχοντες· όσοι συμμετέχουν ήδη δεν προστίθενται ξανά.'} onClose={onClose}
  footer={<DialogActions onSave={apply} disabled={busy||!chosen||counting||nothingToDo} saveLabel={en?'Assign':'Ανάθεση'}><span className="training-assign-departments-count" aria-live="polite">{countsText}</span></DialogActions>}>
  <div className="training-assign-departments-fields">
   <CheckboxField label={en?'Whole hospital':'Όλο το νοσοκομείο'} checked={selection.all} onChange={all=>set({all})}/>
   <MultiSelect label={en?'Departments':'Τμήματα'} tags disabled={selection.all} options={options} selected={selection.all?[]:selection.departmentIds} onChange={departmentIds=>set({departmentIds})} placeholder={en?'Choose one or more':'Επιλέξτε ένα ή περισσότερα'} searchPlaceholder={en?'Search department…':'Αναζήτηση τμήματος…'} emptyLabel={en?'No departments':'Δεν υπάρχουν τμήματα'}/>
   <CheckboxField label={en?'Also people added to these departments later':'Και όσοι προστεθούν αργότερα στα τμήματα'} hint={en?'New employees of the departments (or of the hospital) are added to the programme automatically, until you stop it.':'Οι νέοι εργαζόμενοι των τμημάτων (ή του νοσοκομείου) προστίθενται αυτόματα στο πρόγραμμα, μέχρι να το σταματήσετε.'} checked={selection.followNew} onChange={followNew=>set({followNew})}/>
  </div>
 </ObserverDialog>
}
