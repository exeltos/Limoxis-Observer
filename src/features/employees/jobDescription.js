// Job description kept with each job position (Management > Libraries >
// Job positions). Every saved change bumps the version, so an employee's
// acknowledgement of an earlier version shows as out of date.
import { supabase } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { loadSnapshot,saveSnapshot } from '../../core/data/repository'

export const JOB_DESCRIPTION_FIELDS=[
 ['purpose','Σκοπός θέσης','Purpose of the role'],
 ['reportsTo','Αναφέρεται σε','Reports to'],
 ['duties','Καθήκοντα','Duties'],
 ['responsibilities','Αρμοδιότητες & εξουσιοδοτήσεις','Responsibilities & authorities'],
 ['qualifications','Απαιτούμενα προσόντα','Required qualifications'],
 ['competencies','Δεξιότητες & εκπαίδευση','Skills & training'],
]

export function emptyJobDescription(){return {purpose:'',reportsTo:'',duties:'',responsibilities:'',qualifications:'',competencies:'',version:0,updatedAt:null,updatedBy:''}}
export function hasJobDescription(jd){return Boolean(jd&&JOB_DESCRIPTION_FIELDS.some(([key])=>String(jd[key]||'').trim()))}
export function nextJobDescription(previous,draft,actorName=''){
 return {...emptyJobDescription(),...draft,version:(Number(previous?.version)||0)+1,updatedAt:new Date().toISOString(),updatedBy:actorName}
}

export function positionRow(positions=[],name=''){return positions.find(row=>row?.[0]===name)||null}

// Acknowledgement state of one employee for their position's description.
export function acknowledgementState(jd,acknowledgements=[]){
 if(!hasJobDescription(jd))return {state:'none',latest:null}
 const latest=[...acknowledgements].sort((a,b)=>String(b.acknowledgedAt).localeCompare(String(a.acknowledgedAt)))[0]||null
 if(!latest)return {state:'pending',latest:null}
 return {state:Number(latest.version)===Number(jd.version)?'acknowledged':'outdated',latest}
}

const DEMO_KEY='employee_position_acknowledgements'
const fromRow=row=>({id:row.id,employeeId:row.employee_id,position:row.position_name,version:row.description_version,acknowledgedAt:row.acknowledged_at,acknowledgedByName:row.acknowledged_by_name||''})

export async function loadPositionAcknowledgements(organizationId,employee){
 if(isDemoDataEnvironment())return (loadSnapshot(DEMO_KEY,[])||[]).filter(a=>a.employeeId===employee.id)
 if(!organizationId||!employee?.dbId)return []
 const {data,error}=await supabase.from('employee_position_acknowledgements').select('id,employee_id,position_name,description_version,acknowledged_at,acknowledged_by_name').eq('organization_id',organizationId).eq('employee_id',employee.dbId).order('acknowledged_at',{ascending:false})
 if(error)throw error
 return (data||[]).map(row=>({...fromRow(row),employeeId:employee.id}))
}

export async function acknowledgePosition(organizationId,employee,{position,version,actorName}){
 const record={employeeId:employee.id,position,version,acknowledgedAt:new Date().toISOString(),acknowledgedByName:actorName||''}
 if(isDemoDataEnvironment()){const rows=loadSnapshot(DEMO_KEY,[])||[];saveSnapshot(DEMO_KEY,[{...record,id:`ack-${Date.now().toString(36)}`},...rows]);return record}
 const {data,error}=await supabase.from('employee_position_acknowledgements').insert({organization_id:organizationId,employee_id:employee.dbId,position_name:position,description_version:version,acknowledged_by_name:actorName||null}).select('id,employee_id,position_name,description_version,acknowledged_at,acknowledged_by_name').single()
 if(error)throw error
 return {...fromRow(data),employeeId:employee.id}
}
