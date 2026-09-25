import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { employeeHistoryDemo } from './employeeDemoData'
import {
  loadOccupationalVisitsAsync,
  loadVaccinationsAsync,
  loadEmployeeTrainingAsync,
  loadEvaluationsAsync,
  loadCertificatesAsync,
} from './employeeSubRecordsService'
import { loadEmployeeSurveillanceRecords } from '../surveillance/employeeSurveillanceCloudService'

function asDateTime(value){
  if(!value)return null
  const text=String(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(text)?`${text}T12:00:00`:text
}

function detailKey(kind,detail){
  const value=String(detail||'').trim()
  return value?`history_${kind}:${value}`:`history_${kind}`
}

export async function loadEmployeeHistoryAsync(organizationId,employeeDbId,employeeId){
  if(isDemoDataEnvironment())return employeeHistoryDemo.filter(row=>row.employeeId===employeeId)
  if(!employeeDbId)return []
  if(!hasSupabaseConfig||!supabase)throw new Error('PRODUCTION_CLOUD_REQUIRED:employees.history')
  if(!organizationId)throw new Error('PRODUCTION_ORGANIZATION_REQUIRED:employees.history')

  const [auditResult,visits,vaccinations,training,evaluations,certificates,surveillanceRows]=await Promise.all([
    supabase.rpc('employee_admin_history',{p_employee_id:employeeDbId}),
    loadOccupationalVisitsAsync(organizationId,employeeDbId,employeeId),
    loadVaccinationsAsync(organizationId,employeeDbId,employeeId),
    loadEmployeeTrainingAsync(organizationId,employeeDbId,employeeId),
    loadEvaluationsAsync(organizationId,employeeDbId,employeeId),
    loadCertificatesAsync(organizationId,employeeDbId,employeeId),
    loadEmployeeSurveillanceRecords(organizationId),
  ])

  if(auditResult.error)throw auditResult.error

  const admin=(auditResult.data||[]).map(row=>({
    id:`audit-${row.audit_id}`,
    action:row.action,
    at:row.occurred_at,
    actorName:row.actor_name||'',
    actorRole:row.actor_role||'',
    changedFields:Array.isArray(row.changed_fields)?row.changed_fields:[],
    historyKind:'administrative',
  }))

  const occupational=(visits||[]).map(row=>({
    id:`occupational-${row.id}`,
    action:'update',
    at:asDateTime(row.createdAt||row.date),
    actorName:'',actorRole:'',
    changedFields:[detailKey('occupational',row.type||row.status)],
    historyKind:'occupational',
  }))

  const vaccinationRows=(vaccinations||[]).map(row=>({
    id:`vaccination-${row.id}`,
    action:'update',
    at:asDateTime(row.createdAt||row.date),
    actorName:'',actorRole:'',
    changedFields:[detailKey('vaccination',[row.vaccine,row.dose].filter(Boolean).join(' · '))],
    historyKind:'vaccination',
  }))

  const trainingRows=(training||[]).map(row=>({
    id:`training-${row.id}`,
    action:'update',
    at:asDateTime(row.completedDate||row.assignedDate||row.date),
    actorName:'',actorRole:'',
    changedFields:[detailKey('training',row.titleEl||row.titleEn||row.status)],
    historyKind:'training',
  }))

  const evaluationRows=(evaluations||[]).map(row=>({
    id:`evaluation-${row.id}`,
    action:'update',
    at:asDateTime(row.date),
    actorName:'',actorRole:'',
    changedFields:[detailKey('evaluation',row.titleEl||row.titleEn||row.resultEl||row.resultEn)],
    historyKind:'evaluation',
  }))

  const certificateRows=(certificates||[]).map(row=>({
    id:`certificate-${row.id}`,
    action:'update',
    at:asDateTime(row.issueDate),
    actorName:'',actorRole:'',
    changedFields:[detailKey('certificate',row.titleEl||row.titleEn||row.issuer)],
    historyKind:'certificate',
  }))

  const surveillance=(surveillanceRows||[])
    .filter(row=>row.employeeDbId===employeeDbId)
    .map(row=>({
      id:`surveillance-${row.recordId||row.id}`,
      action:'update',
      at:asDateTime(row.createdAt||row.startedAt),
      actorName:'',actorRole:'',
      changedFields:[detailKey('surveillance',[row.id,(row.screeningTypes||[]).join(', ')].filter(Boolean).join(' · '))],
      historyKind:'surveillance',
    }))

  const rows=[...admin,...occupational,...vaccinationRows,...trainingRows,...evaluationRows,...certificateRows,...surveillance]
  const unique=new Map()
  for(const row of rows){if(row.at&&!unique.has(row.id))unique.set(row.id,row)}
  return [...unique.values()].sort((a,b)=>new Date(b.at||0)-new Date(a.at||0))
}
