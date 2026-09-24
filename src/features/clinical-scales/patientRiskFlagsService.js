import {supabase} from '../../core/supabase/client'
import {demoPatientScaleAssessments} from './patientClinicalScalesService'
// Edited assessments are stored as 'amended' and must still count as the latest result.
const CURRENT_STATUSES=['final','amended']
function groupByPatient(rows){const out={};for(const row of rows||[])(out[row.patient_id]??=[]).push(row);return out}
export async function loadLatestPatientRiskFlags(organizationId,{isDemo=false}={}){if(isDemo)return groupByPatient([...demoPatientScaleAssessments()].filter(r=>CURRENT_STATUSES.includes(r.status)).sort((a,b)=>new Date(b.assessed_at)-new Date(a.assessed_at)));if(!supabase||!organizationId)return {};const {data,error}=await supabase.from('patient_clinical_scale_assessments').select('patient_id,scale_key,score,interpretation,assessed_at').eq('organization_id',organizationId).in('status',CURRENT_STATUSES).order('assessed_at',{ascending:false});if(error)throw error;const out={};for(const row of data||[])(out[row.patient_id]??=[]).push(row);return out}
