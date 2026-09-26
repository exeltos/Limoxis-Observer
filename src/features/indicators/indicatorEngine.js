import { surveillanceDemoData } from '../surveillance/surveillanceDemoData'
import { laboratorySamples } from '../laboratory/laboratoryDemoData'
import { handHygieneRows,bundleRows,antisepticRows } from '../prevention/preventionDemoData'
import { antibioticDispensingRows,dddReferenceLibrary } from '../pharmacy/pharmacyDemoData'
import { awareCategoryFor } from '../pharmacy/whoAwareClassification'
import { qualityIncidents } from '../quality/qualityDemoData'
import { loadEmployees } from '../employees/employeeStore'
import { loadVaccinations } from '../employees/employeeRecordsService'
import { loadTrainingState } from '../training/trainingData'
import { loadPrevalenceSurveyLocal } from '../management/prevalenceSurveyStore'
import { collectDeviceDaySources, collectNeonatalDeviceDaySourcesByBand, BIRTH_WEIGHT_BANDS,countNeonatalCentralLineCasesMissingBirthWeight} from '../surveillance/deviceDayIndicators'
import { calculateHaiRate } from '../lira/liraHaiMetrics'

const round=(n,d=1)=>Number.isFinite(n)?Number(n.toFixed(d)):null

// The 8 ΕΟΔΥ reference pathogens for bacteremia/resistance reporting (ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014).
const REFERENCE_PATHOGEN_PATTERNS={
 ecoli:'escherichia coli',
 proteus:'proteus',
 acinetobacter:'acinetobacter',
 klebsiella:'klebsiella',
 enterobacter:'enterobacter',
 pseudomonas:'pseudomonas',
 saureus:'staphylococcus aureus',
 enterococcus:'enterococcus',
}
const BACTEREMIA_PATHOGEN_PATTERNS=Object.fromEntries(Object.entries(REFERENCE_PATHOGEN_PATTERNS).map(([key,pattern])=>[`bacteremia_${key}`,pattern]))
// One EARS-Net-style reference antibiotic per pathogen, used as the resistance indicator antibiotic (3rd-gen cephalosporin or carbapenem for Enterobacterales/non-fermenters, oxacillin for MRSA, vancomycin for VRE).
const AMR_REFERENCE_ANTIBIOTIC={
 ecoli:'ceftriaxone',
 proteus:'ceftriaxone',
 enterobacter:'ceftriaxone',
 klebsiella:'meropenem',
 acinetobacter:'meropenem',
 pseudomonas:'meropenem',
 saureus:'oxacillin',
 enterococcus:'vancomycin',
}
// ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014: staff vaccination coverage is specifically the seasonal
// influenza vaccine, not any vaccination on file. The editor's fixed dropdown value is
// 'Εποχική γρίπη' (src/features/prevention/StaffVaccinationEditor.jsx); match broader
// γρίπη/influenza/flu variants too for older or English-language records.
const FLU_VACCINE_PATTERNS=['γρίπ','influenza','flu']

export function collectIndicatorMetrics(){
 const active=surveillanceDemoData.filter(x=>x.status==='active')
 const resistant=active.filter(x=>x.resistance)
 const hhOpp=handHygieneRows.reduce((s,x)=>s+Number(x.observations||0),0)
 const hhOk=handHygieneRows.reduce((s,x)=>s+Number(x.compliant||0),0)
 const abhrEligible=antisepticRows.filter(x=>x.indicatorEligible)
 const training=loadTrainingState(); const assignments=training.assignments||[]
 const employees=loadEmployees(); const activeStaff=employees.filter(x=>x.employmentStatus==='active')
 const vaccinated=new Set(loadVaccinations().filter(x=>FLU_VACCINE_PATTERNS.some(pattern=>String(x.vaccine||'').toLowerCase().includes(pattern))).map(x=>x.employeeId))
 const mdroBsi=laboratorySamples.filter(x=>x.result==='positive'&&x.organism&&x.resistance&&String(x.source||x.type||'').toLowerCase().includes('blood')).length
 const patientDays=abhrEligible.reduce((s,x)=>s+Number(x.patientDays||0),0)
 const bacteremias=laboratorySamples.filter(x=>x.type==='bloodCulture'&&x.result==='positive'&&x.organism&&['validated','amended'].includes(x.resultStatus))
 const bacteremiaByPathogen=Object.fromEntries(Object.entries(BACTEREMIA_PATHOGEN_PATTERNS).map(([key,pattern])=>[key,bacteremias.filter(x=>String(x.organism).toLowerCase().includes(pattern)).length]))
 const bacteremiaTotal=bacteremias.filter(x=>Object.values(BACTEREMIA_PATHOGEN_PATTERNS).some(pattern=>String(x.organism).toLowerCase().includes(pattern))).length
 const validatedIsolates=laboratorySamples.filter(x=>x.organism&&['validated','amended'].includes(x.resultStatus))
 const amrByPathogen={}
 for(const [key,organismPattern] of Object.entries(REFERENCE_PATHOGEN_PATTERNS)){
  const antibioticPattern=AMR_REFERENCE_ANTIBIOTIC[key]
  const isolates=validatedIsolates.filter(x=>String(x.organism).toLowerCase().includes(organismPattern))
  const tested=isolates.flatMap(x=>x.ast||[]).filter(row=>String(row.drug||'').toLowerCase().includes(antibioticPattern))
  amrByPathogen[`amr_tested_${key}`]=tested.length
  amrByPathogen[`amr_resistant_${key}`]=tested.filter(row=>row.sir==='R').length
 }
 const antibioticDddTotal=antibioticDispensingRows.reduce((sum,row)=>{
  const ddd=dddReferenceLibrary[row.productCode]
  return ddd?sum+Number(row.quantityGrams||0)/ddd:sum
 },0)
 const awareAccessDddTotal=antibioticDispensingRows.reduce((sum,row)=>{
  const ddd=dddReferenceLibrary[row.productCode]
  return ddd&&awareCategoryFor(row.productEn||row.product)==='access'?sum+Number(row.quantityGrams||0)/ddd:sum
 },0)
 const mdrIsolations=surveillanceDemoData.filter(x=>x.isolation&&['MDR','XDR','PDR'].includes(x.resistance))
 const mdrIsolationByPathogen=Object.fromEntries(Object.entries(REFERENCE_PATHOGEN_PATTERNS).map(([key,pattern])=>[`mdr_isolation_${key}`,mdrIsolations.filter(x=>String(x.organism||'').toLowerCase().includes(pattern)).length]))
 const mdrIsolationTotal=mdrIsolations.filter(x=>Object.values(REFERENCE_PATHOGEN_PATTERNS).some(pattern=>String(x.organism||'').toLowerCase().includes(pattern))).length
 const prevalenceSurveys=loadPrevalenceSurveyLocal()
 const ppsPatientsTotal=prevalenceSurveys.reduce((s,x)=>s+Number(x.patientsTotal||0),0)
 const ppsPatientsWithHai=prevalenceSurveys.reduce((s,x)=>s+Number(x.patientsWithHai||0),0)
 const ppsPatientsOnAntibiotics=prevalenceSurveys.reduce((s,x)=>s+Number(x.patientsOnAntibiotics||0),0)
 const deviceDaySources=collectDeviceDaySources()
 const clabsi=calculateHaiRate(deviceDaySources,'clabsi',{})
 const cauti=calculateHaiRate(deviceDaySources,'cauti',{})
 const vap=calculateHaiRate(deviceDaySources,'vap',{})
 const neonatalDeviceDaysByBand=collectNeonatalDeviceDaySourcesByBand()
 const neonatalClabsiByBand={}
 for(const band of BIRTH_WEIGHT_BANDS){
  const rate=calculateHaiRate(neonatalDeviceDaysByBand[band.id],'clabsi',{})
  neonatalClabsiByBand[`clabsi_events_${band.id}`]=rate.events
  neonatalClabsiByBand[`central_line_days_${band.id}`]=rate.deviceDays
 }
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
  bacteremia_total:bacteremiaTotal,
  ...bacteremiaByPathogen,
  ...amrByPathogen,
  antibiotic_ddd_total:round(antibioticDddTotal,2),
  aware_access_ddd_total:round(awareAccessDddTotal,2),
  mdr_isolation_total:mdrIsolationTotal,
  ...mdrIsolationByPathogen,
  pps_patients_total:ppsPatientsTotal,
  pps_patients_with_hai:ppsPatientsWithHai,
  pps_patients_on_antibiotics:ppsPatientsOnAntibiotics,
  clabsi_events:clabsi.events,
  central_line_days:clabsi.deviceDays,
  cauti_events:cauti.events,
  urinary_catheter_days:cauti.deviceDays,
  vap_events:vap.events,
  ventilator_days:vap.deviceDays,
  ...neonatalClabsiByBand,
  neonatal_central_line_cases_missing_birth_weight:countNeonatalCentralLineCasesMissingBirthWeight(),
 }
}
