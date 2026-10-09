import { useState } from 'react'
import { Pencil,Plus,Trash2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { ManualDateField } from '../../design-system/ManualDateField'
import { auditEvent } from '../../core/audit/actor'
import { saveQualityRecord } from './qualityService'
import { useEmployeesData } from '../employees/useEmployeesData'
import { newSubAction,overdueSubActions,subActionProgress } from './qualityDeviations'

// Steps of a CAPA: each with its own owner, due date and completion.
export function QualityCapaSteps({record,setRecord,canManage,finalized,organizationId,actor,notify,language,locale}){
 const en=language==='en'
 const {data:employeeRows}=useEmployeesData()
 const employeeNames=[...new Set((employeeRows||[]).filter(x=>x.employmentStatus!=='inactive').map(x=>en?[x.firstNameEn||x.firstName,x.lastNameEn||x.lastName].filter(Boolean).join(' '):[x.lastName,x.firstName].filter(Boolean).join(' ')).filter(Boolean))]
 const steps=Array.isArray(record.subActions)?record.subActions:[]
 const [draft,setDraft]=useState(()=>newSubAction())
 const [editingId,setEditingId]=useState(null)
 const [editDraft,setEditDraft]=useState(null)
 const [saving,setSaving]=useState(false)
 const editable=canManage&&!finalized
 const {done,total}=subActionProgress(steps)
 const overdue=new Set(overdueSubActions(steps).map(step=>step.id))
 const fmt=v=>v?new Intl.DateTimeFormat(locale).format(new Date(`${v}T12:00:00`)):'—'

 async function persist(nextSteps,message){
  setSaving(true)
  try{
   const event=auditEvent('recordUpdated',{actor})
   const saved=await saveQualityRecord('capas',organizationId,{...record,subActions:nextSteps,history:[event,...(record.history||[])]})
   setRecord({...saved})
   if(message)notify(message,'success')
   return true
  }catch(error){
   console.error(error)
   notify(en?'The steps could not be saved.':'Δεν ήταν δυνατή η αποθήκευση των βημάτων.','error')
   return false
  }finally{setSaving(false)}
 }
 async function add(){
  if(!draft.title.trim())return
  if(await persist([...steps,{...draft,title:draft.title.trim()}],en?'Step added.':'Το βήμα προστέθηκε.'))setDraft(newSubAction())
 }
 function toggle(step){
  const next=steps.map(item=>item.id===step.id?(item.done?{...item,done:false,doneAt:null,doneBy:''}:{...item,done:true,doneAt:new Date().toISOString(),doneBy:actor.name}):item)
  void persist(next)
 }
 async function saveEdit(){
  if(!editDraft?.title?.trim())return
  if(await persist(steps.map(item=>item.id===editingId?{...editDraft,title:editDraft.title.trim()}:item),en?'Step updated.':'Το βήμα ενημερώθηκε.')){setEditingId(null);setEditDraft(null)}
 }
 function remove(step){void persist(steps.filter(item=>item.id!==step.id),en?'Step removed.':'Το βήμα αφαιρέθηκε.')}

 return <div className="record-section quality-capa-steps">
  <div className="record-section-header"><div><h3>{en?'Steps':'Βήματα'}</h3><p>{total?(en?`${done} of ${total} done`:`${done} από ${total} ολοκληρώθηκαν`):(en?'Break the action into steps with an owner and a due date.':'Χωρίστε την ενέργεια σε βήματα με υπεύθυνο και προθεσμία.')}{overdue.size>0&&<strong className="quality-steps-overdue"> · {en?`${overdue.size} overdue`:`${overdue.size} εκπρόθεσμα`}</strong>}</p></div>
   {total>0&&<span className="quality-steps-progress" aria-hidden="true"><span style={{width:`${Math.round(done/total*100)}%`}}/></span>}</div>
  <datalist id="quality-capa-step-owners">{employeeNames.map(name=><option key={name} value={name}/>)}</datalist>
  <table className="data-table quality-steps-table">
   <thead><tr><th className="quality-step-check-col" aria-label={en?'Done':'Ολοκληρώθηκε'}></th><th>{en?'Step':'Βήμα'}</th><th>{t2(en,'Owner','Υπεύθυνος')}</th><th>{t2(en,'Due date','Προθεσμία')}</th><th>{t2(en,'Completed','Ολοκλήρωση')}</th><th className="quality-step-menu-col"></th></tr></thead>
   <tbody>{steps.map(step=>editingId===step.id
    ? <tr key={step.id} className="quality-step-editing"><td></td><td><input value={editDraft.title} onChange={e=>setEditDraft(d=>({...d,title:e.target.value}))} aria-label={t2(en,'Step','Βήμα')}/></td><td><input list="quality-capa-step-owners" value={editDraft.owner} onChange={e=>setEditDraft(d=>({...d,owner:e.target.value}))} aria-label={t2(en,'Owner','Υπεύθυνος')}/></td><td><ManualDateField value={editDraft.dueDate||''} onChange={v=>setEditDraft(d=>({...d,dueDate:v}))}/></td><td colSpan={2}><div className="row-actions"><Button variant="secondary" disabled={saving} onClick={()=>{setEditingId(null);setEditDraft(null)}}>{t2(en,'Cancel','Άκυρο')}</Button><Button disabled={saving||!editDraft.title.trim()} onClick={saveEdit}>{t2(en,'Save','Αποθήκευση')}</Button></div></td></tr>
    : <tr key={step.id} className={step.done?'quality-step-done':''}>
     <td className="quality-step-check-col"><input type="checkbox" checked={Boolean(step.done)} disabled={!editable||saving} onChange={()=>toggle(step)} aria-label={`${t2(en,'Done','Ολοκληρώθηκε')}: ${step.title}`}/></td>
     <td><strong>{step.title}</strong></td>
     <td>{step.owner||'—'}</td>
     <td className={overdue.has(step.id)?'quality-step-overdue':''}>{fmt(step.dueDate)}</td>
     <td>{step.done?<><span>{new Intl.DateTimeFormat(locale,{dateStyle:'short'}).format(new Date(step.doneAt))}</span><small>{step.doneBy}</small></>:'—'}</td>
     <td className="quality-step-menu-col">{editable&&<OverflowMenu label={t2(en,'Step actions','Ενέργειες βήματος')} items={[
      {id:'edit',label:t2(en,'Edit','Επεξεργασία'),icon:Pencil,onClick:()=>{setEditingId(step.id);setEditDraft({...step})}},
      {id:'remove',label:t2(en,'Remove step','Αφαίρεση βήματος'),icon:Trash2,tone:'danger',separatorBefore:true,onClick:()=>remove(step)},
     ]}/>}</td>
    </tr>)}</tbody>
  </table>
  {!total&&<div className="inline-empty">{t2(en,'No steps yet.','Δεν υπάρχουν ακόμη βήματα.')}</div>}
  {editable&&<div className="quality-step-add">
   <input value={draft.title} onChange={e=>setDraft(d=>({...d,title:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void add()}}} placeholder={t2(en,'New step, e.g. Retrain night shift on fridge checks','Νέο βήμα, π.χ. Επανεκπαίδευση νυχτερινής βάρδιας στον έλεγχο ψυγείου')} aria-label={t2(en,'New step','Νέο βήμα')}/>
   <input list="quality-capa-step-owners" value={draft.owner} onChange={e=>setDraft(d=>({...d,owner:e.target.value}))} placeholder={t2(en,'Owner','Υπεύθυνος')} aria-label={t2(en,'Owner','Υπεύθυνος')}/>
   <ManualDateField value={draft.dueDate||''} onChange={v=>setDraft(d=>({...d,dueDate:v}))}/>
   <Button disabled={saving||!draft.title.trim()} onClick={add}><Plus size={15}/>{t2(en,' Add step',' Προσθήκη βήματος')}</Button>
  </div>}
  {finalized&&<div className="inline-empty">{t2(en,'The CAPA is closed; reopen it with a correction to change its steps.','Η CAPA έχει κλείσει· για αλλαγές στα βήματα ανοίξτε την με διόρθωση.')}</div>}
 </div>
}

function t2(en,english,greek){return en?english:greek}
