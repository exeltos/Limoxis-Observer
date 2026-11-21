import { useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { TrainingProgramForm } from './TrainingProgramForm'
import { departmentTrainingDraft,departmentTrainingIsValid } from './trainingDepartmentPrograms'
import { saveDepartmentTrainingAsync } from './trainingDepartmentService'
import type { TrainingState } from './trainingData'
import type { TrainingDepartment } from './trainingMyView'
import type { TrainingEmployee, TrainingProgram, TrainingProgramDraft } from './trainingTypes'

// «Νέα εκπαίδευση τμήματος» and its «Επεξεργασία» (owner, 21/11/2026): the Department Manager's training of his own
// department. The programme form without what the department does not choose: the type is «Ενδοτμηματική», the
// organiser the department, no cost and no knowledge test (TrainingProgramForm departmentMode). Saved through
// saveDepartmentTrainingAsync (the database checks the role, the department and the dates again).
interface TrainingDepartmentFormProps { language: string, organizationId: string|null, department: TrainingDepartment, employees?: TrainingEmployee[], program?: TrainingProgram|null, onCancel: ()=>void, onSaved: (state: TrainingState,key: string)=>void }
export function TrainingDepartmentForm({language,organizationId,department,employees=[],program=null,onCancel,onSaved}: TrainingDepartmentFormProps){
 const en=language==='en',tr=(el: string,enText: string)=>en?enText:el
 const {notify,notifyError}=useFeedback()
 const [draft,setDraft]=useState<TrainingProgramDraft>(()=>program?{...program,durationHours:program.durationHours??'',validMonths:program.validMonths??'',passScore:''}:departmentTrainingDraft(department,language))
 const [saving,setSaving]=useState(false)
 const valid=departmentTrainingIsValid(draft)
 const departmentName=en&&department.nameEn?department.nameEn:department.name
 async function save(){
  if(!valid||saving)return
  setSaving(true)
  try{const {state,key}=await saveDepartmentTrainingAsync(organizationId,draft,department);notify(program?tr('Η εκπαίδευση τμήματος ενημερώθηκε.','The department training was updated.'):tr('Η εκπαίδευση τμήματος δημιουργήθηκε. Επιλέξτε τους συμμετέχοντες.','The department training was created. Choose the participants.'),'success');onSaved(state,key)}
  catch(error){notifyError(error,'save',{operation:'training_department_save'})}
  finally{setSaving(false)}
 }
 return <Page><EntityRecordShell className="training-create-shell training-department-form" avatar={<GraduationCap size={19}/>} eyebrow={departmentName} title={program?tr('Επεξεργασία εκπαίδευσης τμήματος','Edit department training'):tr('Νέα εκπαίδευση τμήματος','New department training')} subtitle={tr(`Ενδοτμηματική εκπαίδευση · διοργάνωση: ${department.name}`,`Intra-departmental training · organised by ${departmentName}`)} tabs={[]} activeTab="" onTabChange={()=>{}} onBack={onCancel} backLabel={tr('Πίσω','Back')}>
  <div className="record-section training-create-form">
   <TrainingProgramForm departmentMode value={draft} onChange={setDraft} language={language} employees={employees} departments={[{name:department.name}]}/>
   <div className="inline-edit-footer"><Button variant="secondary" onClick={onCancel} disabled={saving}>{tr('Ακύρωση','Cancel')}</Button><SaveButton loading={saving} disabled={!valid||saving} onClick={save}>{program?tr('Αποθήκευση','Save'):tr('Αποθήκευση και συμμετέχοντες','Save and choose participants')}</SaveButton></div>
  </div>
 </EntityRecordShell></Page>
}
