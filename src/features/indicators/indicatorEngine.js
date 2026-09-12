import { surveillanceDemoData } from '../surveillance/surveillanceDemoData'
import { laboratorySamples } from '../laboratory/laboratoryDemoData'
import { handHygieneRows,bundleRows,antisepticRows } from '../prevention/preventionDemoData'
import { qualityIncidents } from '../quality/qualityDemoData'
import { loadEmployees } from '../employees/employeeStore'
import { loadVaccinations } from '../employees/employeeRecordsService'
import { loadTrainingState } from '../training/trainingData'

const round=(n,d=1)=>Number.isFinite(n)?Number(n.toFixed(d)):null

export function collectIndicatorMetrics(){
 const active=surveillanceDemoData.filter(x=>x.state==='active')
 const resistant=active.filter(x=>x.resistance)
 const hhOpp=handHygieneRows.reduce((s,x)=>s+Number(x.observations||0),0)
 const hhOk=handHygieneRows.reduce((s,x)=>s+Number(x.compliant||0),0)
 const abhrEligible=antisepticRows.filter(x=>x.indicatorEligible)
 const training=loadTrainingState(); const assignments=training.assignments||[]
 const employees=loadEmployees(); const activeStaff=employees.filter(x=>x.employmentStatus==='active')
 const vaccinated=new Set(loadVaccinations().map(x=>x.employeeId))
 const mdroBsi=laboratorySamples.filter(x=>x.result==='positive'&&x.organism&&x.resistance&&String(x.source||x.type||'').toLowerCase().includes('blood')).length
 const patientDays=abhrEligible.reduce((s,x)=>s+Number(x.patientDays||0),0)
 return {
  active_surveillance:active.length,
  resistant_active_surveillance:resistant.length,
  hh_compliant_actions:hhOk,
  hh_opportunities:hhOpp,
  bundle_all_or_none_pass:bundleRows.filter(x=>x.allOrNone).length,
  bundle_executions:bundleRows.length,
  abhr_litres:round(abhrEligible.reduce((s,x)=>s+Number(x.litres||0),0),1),
  training_completed:assignments.filter(x=>x.status==='completed').length,
  training_assignments:assignments.length,
  active_staff:activeStaff.length,
  active_staff_with_vaccination:activeStaff.filter(x=>vaccinated.has(x.id)).length,
  open_high_incidents:qualityIncidents.filter(x=>x.severity==='high'&&x.status!=='closed').length,
  mdro_bsi:mdroBsi,
  patient_days:patientDays,
 }
}
