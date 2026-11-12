import { useState } from 'react'
import { CheckCircle2,Circle,Pencil,Plus,Trash2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { FormGrid } from '../../design-system/FormCard'
import { Field } from '../../design-system/Field'
import { IconButton } from '../../design-system/IconButton'
import { RegistryTable } from '../../design-system/RegistryTable'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { formatDateTime,formatDay } from '../../core/i18n/formatDay'
import { ManualDateField } from '../../design-system/ManualDateField'
import { auditEvent } from '../../core/audit/actor'
import { saveQualityRecord } from './qualityService'
import { useEmployeesData } from '../employees/useEmployeesData'
import { newSubAction,overdueSubActions,subActionProgress } from './qualityDeviations'
import './rootCause.css'

// Steps of a CAPA: each with its own owner, due date and completion.
export function QualityCapaSteps({record,setRecord,canManage,finalized,organizationId,actor,notify,language}){
 const en=language==='en'
 const {data:employeeRows}=useEmployeesData()
 const ownerOptions=[...new Set((employeeRows||[]).filter(x=>x.employmentStatus!=='inactive').map(x=>en?[x.firstNameEn||x.firstName,x.lastNameEn||x.lastName].filter(Boolean).join(' '):[x.lastName,x.firstName].filter(Boolean).join(' ')).filter(Boolean))].map(name=>({value:name,label:name}))
 const steps=Array.isArray(record.subActions)?record.subActions:[]
 // One dialog adds a step or edits one, as every other record tab does.
 const [dialog,setDialog]=useState(null)
 const [saving,setSaving]=useState(false)
 const editable=canManage&&!finalized
 const {done,total}=subActionProgress(steps)
 const overdue=new Set(overdueSubActions(steps).map(step=>step.id))
// The owner: a person from the staff list, or a name typed in.
 const ownerField=(value,onChange,props={})=><SearchableSelect className="quality-step-owner" label={t2(en,'Owner','Υπεύθυνος')} hideLabel value={value||''} options={ownerOptions} allowCustom onChange={onChange} {...props}/>

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
 async function save(){
  const step=dialog
  if(!step?.title?.trim())return
  const clean={...step,title:step.title.trim()}
  const exists=steps.some(item=>item.id===clean.id)
  if(await persist(exists?steps.map(item=>item.id===clean.id?clean:item):[...steps,clean],exists?(en?'Step updated.':'Το βήμα ενημερώθηκε.'):(en?'Step added.':'Το βήμα προστέθηκε.')))setDialog(null)
 }
 function toggle(step){
  const next=steps.map(item=>item.id===step.id?(item.done?{...item,done:false,doneAt:null,doneBy:''}:{...item,done:true,doneAt:new Date().toISOString(),doneBy:actor.name}):item)
  void persist(next)
 }
 function remove(step){void persist(steps.filter(item=>item.id!==step.id),en?'Step removed.':'Το βήμα αφαιρέθηκε.')}

 return <RecordTabPanel className="quality-capa-panel" title={en?'Steps':'Βήματα'} subtitle={total?(en?`${done} of ${total} done`:`${done} από ${total} ολοκληρώθηκαν`):(en?'Break the action into steps with an owner and a due date.':'Χωρίστε την ενέργεια σε βήματα με υπεύθυνο και προθεσμία.')}
  actions={<>{total>0&&<span className="quality-steps-progress" aria-hidden="true"><span style={{width:`${Math.round(done/total*100)}%`}}/></span>}{editable&&<Button onClick={()=>setDialog(newSubAction())}><Plus size={15}/>{t2(en,'Add step','Προσθήκη βήματος')}</Button>}</>}>
  {total>0&&<RegistryTable bare className="quality-steps-table" rows={steps} rowKey={step=>step.id}
   columns={[{key:'done',label:'',ariaLabel:en?'Done':'Ολοκληρώθηκε',className:'quality-step-check-col'},{key:'step',label:en?'Step':'Βήμα'},{key:'owner',label:t2(en,'Owner','Υπεύθυνος')},{key:'due',label:t2(en,'Due date','Προθεσμία')},{key:'completed',label:t2(en,'Completed','Ολοκλήρωση')},{key:'menu',label:'',className:'quality-step-menu-col'}]}
   renderRow={step=><tr className={step.done?'quality-step-done':''}>
     <td className="quality-step-check-col"><IconButton size="sm" tone={step.done?'success':'neutral'} className={`quality-step-toggle${step.done?' is-done':''}`} aria-pressed={Boolean(step.done)} disabled={!editable||saving} onClick={()=>toggle(step)} label={step.done?t2(en,'Mark as not done','Σήμανση ως μη ολοκληρωμένο'):t2(en,'Mark as done','Σήμανση ως ολοκληρωμένο')}>{step.done?<CheckCircle2 size={16}/>:<Circle size={16}/>}</IconButton></td>
     <td><strong>{step.title}</strong></td>
     <td>{step.owner||'—'}</td>
     <td className={overdue.has(step.id)?'quality-step-overdue':''}>{formatDay(step.dueDate,language)}</td>
     <td>{step.done?<><span>{formatDateTime(step.doneAt,language)}</span><small>{step.doneBy}</small></>:'—'}</td>
     <td className="quality-step-menu-col">{editable&&<div className="row-actions"><IconButton size="sm" tone="edit" label={t2(en,'Edit','Επεξεργασία')} onClick={()=>setDialog({...step})}><Pencil size={14}/></IconButton><IconButton size="sm" tone="danger" label={t2(en,'Remove step','Αφαίρεση βήματος')} disabled={saving} onClick={()=>remove(step)}><Trash2 size={14}/></IconButton></div>}</td>
    </tr>}/>}
  {!total&&<div className="inline-empty">{t2(en,'No steps yet.','Δεν υπάρχουν ακόμη βήματα.')}</div>}
  {finalized&&<div className="inline-empty">{t2(en,'The CAPA is closed; reopen it with a correction to change its steps.','Η διορθωτική ενέργεια έχει κλείσει· για αλλαγές στα βήματα ανοίξτε την ξανά με διόρθωση.')}</div>}
  {dialog&&<ObserverDialog title={steps.some(item=>item.id===dialog.id)?t2(en,'Step','Βήμα'):t2(en,'New step','Νέο βήμα')} onClose={()=>setDialog(null)} footer={<DialogActions onCancel={()=>setDialog(null)} onSave={save} disabled={saving||!dialog.title?.trim()} saveLabel={t2(en,'Save','Αποθήκευση')}/>}>
   <Field label={`${t2(en,'Step','Βήμα')} *`}><input autoFocus value={dialog.title} onChange={e=>setDialog(d=>({...d,title:e.target.value}))} placeholder={t2(en,'e.g. Retrain night shift on fridge checks','π.χ. Επανεκπαίδευση νυχτερινής βάρδιας στον έλεγχο ψυγείου')}/></Field>
   <FormGrid columns={2}>
    {ownerField(dialog.owner,v=>setDialog(d=>({...d,owner:v})),{hideLabel:false})}
    <ManualDateField label={t2(en,'Due date','Προθεσμία')} value={dialog.dueDate||''} onChange={v=>setDialog(d=>({...d,dueDate:v}))}/>
   </FormGrid>
  </ObserverDialog>}
 </RecordTabPanel>
}

function t2(en,english,greek){return en?english:greek}
