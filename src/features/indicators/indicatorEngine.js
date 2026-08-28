import { surveillanceDemoData } from '../surveillance/surveillanceDemoData'
import { handHygieneRows,bundleRows,antisepticRows } from '../prevention/preventionDemoData'
import { qualityIncidents } from '../quality/qualityDemoData'
import { employeeVaccinations } from '../employees/employeeDemoData'
import { loadEmployees } from '../employees/employeeStore'
import { loadTrainingState } from '../training/trainingData'
import { indicatorDefinitions } from './indicatorDefinitions'
import { loadCustomIndicators } from './indicatorStore'

const round=(n,d=1)=>Number.isFinite(n)?Number(n.toFixed(d)):null
const pct=(a,b)=>b?round(a/b*100,1):null

export const indicatorMetricCatalog=[
 {key:'active_surveillance',label:'Ενεργές επιτηρήσεις',source:'Επιτήρηση'},
 {key:'resistant_active_surveillance',label:'Ενεργές επιτηρήσεις με MDR/XDR/PDR',source:'Επιτήρηση'},
 {key:'hh_compliant_actions',label:'Συμμορφούμενες ενέργειες υγιεινής χεριών',source:'Πρόληψη · WHO'},
 {key:'hh_opportunities',label:'Ευκαιρίες υγιεινής χεριών',source:'Πρόληψη · WHO'},
 {key:'bundle_all_or_none_pass',label:'Bundles με all-or-none συμμόρφωση',source:'Πρόληψη · Bundles'},
 {key:'bundle_executions',label:'Σύνολο εκτελέσεων bundle',source:'Πρόληψη · Bundles'},
 {key:'abhr_litres',label:'Λίτρα αλκοολούχου αντισηπτικού',source:'Πρόληψη · Αντισηπτικά'},
 {key:'abhr_patient_days',label:'Ασθενείς-ημέρες για κατανάλωση ABHR',source:'Πρόληψη · Αντισηπτικά'},
 {key:'training_completed',label:'Ολοκληρωμένες αναθέσεις εκπαίδευσης',source:'Εκπαίδευση'},
 {key:'training_assignments',label:'Σύνολο αναθέσεων εκπαίδευσης',source:'Εκπαίδευση'},
 {key:'active_staff',label:'Ενεργοί εργαζόμενοι',source:'Εργαζόμενοι'},
 {key:'active_staff_with_vaccination',label:'Ενεργοί εργαζόμενοι με καταγραφή εμβολιασμού',source:'Εργαζόμενοι'},
 {key:'open_high_incidents',label:'Ανοιχτά συμβάντα υψηλής σοβαρότητας',source:'Ποιότητα'},
]

export function collectIndicatorMetrics(){
 const active=surveillanceDemoData.filter(x=>x.state==='active')
 const resistant=active.filter(x=>x.resistance)
 const hhOpp=handHygieneRows.reduce((s,x)=>s+Number(x.observations||0),0)
 const hhOk=handHygieneRows.reduce((s,x)=>s+Number(x.compliant||0),0)
 const abhrEligible=antisepticRows.filter(x=>x.indicatorEligible)
 const training=loadTrainingState(); const assignments=training.assignments||[]
 const employees=loadEmployees(); const activeStaff=employees.filter(x=>x.employmentStatus==='active')
 const vaccinated=new Set(employeeVaccinations.map(x=>x.employeeId))
 return {
  active_surveillance:active.length,
  resistant_active_surveillance:resistant.length,
  hh_compliant_actions:hhOk,
  hh_opportunities:hhOpp,
  bundle_all_or_none_pass:bundleRows.filter(x=>x.allOrNone).length,
  bundle_executions:bundleRows.length,
  abhr_litres:round(abhrEligible.reduce((s,x)=>s+Number(x.litres||0),0),1),
  abhr_patient_days:abhrEligible.reduce((s,x)=>s+Number(x.patientDays||0),0),
  training_completed:assignments.filter(x=>x.status==='completed').length,
  training_assignments:assignments.length,
  active_staff:activeStaff.length,
  active_staff_with_vaccination:activeStaff.filter(x=>vaccinated.has(x.id)).length,
  open_high_incidents:qualityIncidents.filter(x=>x.severity==='high'&&x.status!=='closed').length,
 }
}

export function calculateDefinition(def,metrics){
 const numerator=metrics[def.numerator] ?? (def.manualValue??null)
 const denominator=def.denominator?metrics[def.denominator]:null
 let value=null
 if(def.calculation==='manual') value=Number.isFinite(Number(def.manualValue))?Number(def.manualValue):null
 else if(def.denominator) value=denominator?round(Number(numerator||0)/Number(denominator)*Number(def.multiplier||1),1):null
 else value=Number.isFinite(Number(numerator))?round(Number(numerator)*Number(def.multiplier||1),1):null
 return {...def,value,numerator,denominator,evidence:evidenceFor(def,numerator,denominator),status:evaluate(def,value)}
}

export function calculateIndicators(){
 const metrics=collectIndicatorMetrics()
 const custom=loadCustomIndicators()
 return [...indicatorDefinitions,...custom].filter(x=>x.active!==false).map(def=>calculateDefinition(def,metrics))
}
function evidenceFor(def,n,d){
 if(def.calculation==='manual')return 'Χειροκίνητη τιμή'
 const nLabel=indicatorMetricCatalog.find(x=>x.key===def.numerator)?.label||def.numerator
 if(!def.denominator)return `${n??'—'} · ${nLabel}`
 const dLabel=indicatorMetricCatalog.find(x=>x.key===def.denominator)?.label||def.denominator
 return `${n??'—'} ${nLabel} / ${d??'—'} ${dLabel}`
}
function evaluate(def,value){
 if(value==null||def.target==null)return 'context'
 if(def.direction==='higher')return value>=def.target?'onTarget':'attention'
 if(def.direction==='lower')return value<=def.target?'onTarget':'attention'
 return 'context'
}
