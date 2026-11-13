import { hospitalToday } from '../../core/dates/hospitalDate'
import type { CompetenceAssignment, CompetenceCertificate, CompetenceRequirement, TrainingEmployee } from './trainingTypes'
// Required training per professional category and department, and each
// employee's standing against it. A requirement is met by completing any of
// its programmes; it stays valid for renewalMonths (or until the certificate's
// validUntil when one was issued), then the person needs retraining.
//
// requirement: { id, title, programIds:[], professions:[], positions:[],
//                departments:[], renewalMonths, active }  (empty list = everyone)

const EXPIRING_DAYS=60
const DAY=24*60*60*1000

const norm=(value: unknown)=>String(value||'').trim().toLocaleLowerCase('el')

export function newRequirement(){
 return {id:`REQ-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,title:'',programIds:[],professions:[],positions:[],departments:[],renewalMonths:12,active:true}
}

// One person's standing against one requirement.
export interface CompetenceCell { state: 'valid' | 'expiring' | 'expired' | 'missing', completedOn: string, validUntil: string, programId: string }
export interface CompetenceMatrix { requirements: CompetenceRequirement[], rows: { employee: TrainingEmployee, cells: (CompetenceCell | null)[] }[], counts: Record<CompetenceCell['state'], number>, required: number, rate: number | null }

export function requirementApplies(requirement: CompetenceRequirement,employee: TrainingEmployee){
 if(requirement.active===false)return false
 const professions=(requirement.professions||[]).map(norm)
 const positions=(requirement.positions||[]).map(norm)
 const departments=(requirement.departments||[]).map(norm)
 const profession=norm(employee.profession)
 const position=norm(employee.position)
 const department=norm(employee.department)
 return (!professions.length||professions.includes(profession))&&(!positions.length||positions.includes(position))&&(!departments.length||departments.includes(department))
}

function addMonths(day: string,months: unknown){
 const date=new Date(`${day}T12:00:00`)
 date.setMonth(date.getMonth()+Number(months||0))
 return date.toISOString().slice(0,10)
}

const completedOn=(assignment: CompetenceAssignment)=>String(assignment.completedDate||assignment.completionConfirmedAt||'').slice(0,10)

// Latest completion of any of the requirement's programmes by this employee.
interface CompetenceRecords { assignments?: CompetenceAssignment[], certificates?: CompetenceCertificate[], today?: string }
export function requirementStatus(requirement: CompetenceRequirement,employee: TrainingEmployee,{assignments=[],certificates=[],today=hospitalToday()}: CompetenceRecords={}): CompetenceCell{
 const programIds=new Set<string|null>(requirement.programIds||[])
 const code=String(employee.employeeCode||employee.id||'')
 const done=assignments
  .filter(a=>programIds.has(a.programId)&&a.status==='completed'&&String(a.employeeId||'')===code&&completedOn(a))
  .sort((a,b)=>completedOn(b).localeCompare(completedOn(a)))[0]
 if(!done)return {state:'missing',completedOn:'',validUntil:'',programId:''}
 const certificate=certificates.find(c=>c.assignmentId===done.id)
 const validUntil=String(certificate?.validUntil||'').slice(0,10)||(Number(requirement.renewalMonths)>0?addMonths(completedOn(done),requirement.renewalMonths as number):'')
 let state: CompetenceCell['state']='valid'
 if(validUntil&&validUntil<today)state='expired'
 else if(validUntil&&(new Date(`${validUntil}T12:00:00`).getTime()-new Date(`${today}T12:00:00`).getTime())/DAY<=EXPIRING_DAYS)state='expiring'
 return {state,completedOn:completedOn(done),validUntil,programId:done.programId as string}
}

// Rows: employees the requirements apply to; cells: one status per requirement
// (null when the requirement does not apply to that person).
export function competenceMatrix({requirements=[],employees=[],assignments=[],certificates=[],today}: CompetenceRecords & { requirements?: CompetenceRequirement[], employees?: TrainingEmployee[] }={}): CompetenceMatrix{
 const active=requirements.filter(r=>r.active!==false)
 const rows: CompetenceMatrix['rows']=[]
 for(const employee of employees){
  const cells=active.map(r=>requirementApplies(r,employee)?requirementStatus(r,employee,{assignments,certificates,today}):null)
  if(cells.some(Boolean))rows.push({employee,cells})
 }
 const counts={valid:0,expiring:0,expired:0,missing:0}
 for(const row of rows)for(const cell of row.cells)if(cell)counts[cell.state]+=1
 const required=counts.valid+counts.expiring+counts.expired+counts.missing
 return {requirements:active,rows,counts,required,rate:required?Math.round((counts.valid+counts.expiring)/required*100):null}
}

// Who has to be trained, and by when: missing now, expired, or expiring
// (on its validUntil date). Feeds the "Plan" list and the calendar.
// One person who has to be trained for one requirement, and by when.
export interface RetrainingItem { key: string, requirement: CompetenceRequirement, employee: TrainingEmployee, state: CompetenceCell['state'], due: string, validUntil: string, completedOn: string }
export function retrainingPlan(matrix: CompetenceMatrix,{today=hospitalToday()}: { today?: string }={}){
 const items: RetrainingItem[]=[]
 for(const row of matrix.rows){
  row.cells.forEach((cell,index)=>{
   if(!cell||cell.state==='valid')return
   const requirement=matrix.requirements[index]
   items.push({key:`${requirement.id}:${row.employee.employeeCode||row.employee.id}`,requirement,employee:row.employee,state:cell.state,due:cell.state==='missing'?today:cell.validUntil,validUntil:cell.validUntil,completedOn:cell.completedOn||''})
  })
 }
 return items.sort((a,b)=>a.due.localeCompare(b.due)||String(a.requirement.title).localeCompare(String(b.requirement.title)))
}
