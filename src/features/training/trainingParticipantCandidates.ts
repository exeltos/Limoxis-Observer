import { supabase as configuredSupabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import type { TrainingEmployee } from './trainingTypes'
import type { SupabaseClient } from '@supabase/supabase-js'

// «Προσθήκη συμμετεχόντων» (owner, 21/11/2026): whoever manages training (manage_training, also the Quality Manager and
// the Infection Control Team Member) chooses participants from the staff, even without access to the staff register.
// In a hospital the list comes from training_participant_candidates (20261231611000): only the fields the picker shows
// or the assignment needs, checked on the server (manage_training, Training module open). In the Demo the staff the
// page already holds are used, never the database: the two are kept apart.
// The RPC is newer than the generated types: the untyped client.
const cloud=()=>{if(!hasSupabaseConfig||!configuredSupabase)throw new Error('PRODUCTION_TRAINING_CLOUD_REQUIRED:participant_candidates');return configuredSupabase as unknown as SupabaseClient}

export type ParticipantCandidateRow = { id: string, employee_code: string|null, first_name: string|null, last_name: string|null, department_id: string|null, department_name: string|null, email: string|null, profession: string|null, position: string|null, employment_status: string|null, user_id: string|null }

// The same shape the staff register gives the picker (employeeService fromRow): id is the employee code, dbId the row.
export function participantCandidateFromRow(row: ParticipantCandidateRow): TrainingEmployee{
 const code=String(row.employee_code||'')
 return {id:code,dbId:row.id,employeeCode:code,firstName:row.first_name||'',lastName:row.last_name||'',department:row.department_name||'',departmentId:row.department_id||null,email:row.email||'',profession:row.profession||'',position:row.position||'',employmentStatus:row.employment_status||'active',userId:row.user_id||null}
}

export async function loadTrainingParticipantCandidatesAsync(organizationId: string|null|undefined,demoEmployees: TrainingEmployee[]=[]): Promise<TrainingEmployee[]>{
 if(isDemoDataEnvironment())return demoEmployees
 if(!organizationId)throw new Error('PRODUCTION_TRAINING_ORGANIZATION_REQUIRED:participant_candidates')
 const {data,error}=await cloud().rpc('training_participant_candidates',{p_organization_id:organizationId})
 if(error)throw error
 return ((data||[]) as ParticipantCandidateRow[]).filter(row=>row.employee_code).map(participantCandidateFromRow)
}
