// Training effectiveness, in three levels: did people like it (feedback), did
// they learn (assessment), and does practice change (an evaluation some months
// later, by observation, audit or indicator). The third is recorded on the
// programme as `effectiveness`; when it is not met, a CAPA is opened from it
// and links back with the source id `TRAINING:<programme id>`.

import { newSubAction } from '../quality/qualityDeviations'

const TRAINING_SOURCE_PREFIX='TRAINING:'
const EFFECTIVENESS_DELAY_MONTHS=3

export const EFFECTIVENESS_METHODS=[
 ['observation','Παρατήρηση στην πράξη','Observation in practice'],
 ['audit','Επιθεώρηση / bundle','Audit / bundle'],
 ['indicator','Δείκτης (π.χ. συμμόρφωση, λοιμώξεις)','Indicator (e.g. compliance, infections)'],
 ['retest','Επανέλεγχος γνώσεων','Knowledge re-test'],
 ['supervisor','Αξιολόγηση από προϊστάμενο','Supervisor assessment'],
 ['other','Άλλο','Other'],
]
export const EFFECTIVENESS_RESULTS=[
 ['effective','Αποτελεσματική','Effective'],
 ['partial','Μερικώς αποτελεσματική','Partly effective'],
 ['not_effective','Μη αποτελεσματική','Not effective'],
]
export const optionLabel=(options,value,en)=>{const row=options.find(([key])=>key===value);return row?(en?row[2]:row[1]):''}

function addMonths(day,months){
 if(!day)return ''
 const date=new Date(`${String(day).slice(0,10)}T12:00:00`)
 date.setMonth(date.getMonth()+months)
 return date.toISOString().slice(0,10)
}

export function defaultEffectiveness(program){
 return {plannedDate:addMonths(program?.dueDate,EFFECTIVENESS_DELAY_MONTHS),method:'observation',criterion:'',result:'',evaluatedAt:'',evaluatedBy:'',notes:''}
}

// 'effective' | 'partial' | 'not_effective' once recorded; before that
// 'not_planned', 'planned', or 'overdue' (past its planned date).
export function effectivenessState(program,today=new Date().toISOString().slice(0,10)){
 const value=program?.effectiveness
 if(value?.result)return value.result
 if(!value?.plannedDate)return 'not_planned'
 return value.plannedDate<today?'overdue':'planned'
}

// Levels 1 and 2 from what participants already submitted.
export function effectivenessLevels(program,assignments=[]){
 const mine=assignments.filter(a=>a.programId===program.id)
 const scores=mine.flatMap(a=>Object.values(a.feedbackScores||{}).map(Number).filter(Number.isFinite))
 const assessed=mine.filter(a=>a.score!=null)
 const passed=assessed.filter(a=>a.competent===true)
 return {
  participants:mine.length,
  completed:mine.filter(a=>a.status==='completed').length,
  feedbackCount:mine.filter(a=>a.feedbackSubmittedAt||Object.keys(a.feedbackScores||{}).length).length,
  satisfaction:scores.length?Math.round(scores.reduce((s,n)=>s+n,0)/scores.length*10)/10:null,
  assessed:assessed.length,
  passRate:assessed.length?Math.round(passed.length/assessed.length*100):null,
  averageScore:assessed.length?Math.round(assessed.reduce((s,a)=>s+Number(a.score||0),0)/assessed.length):null,
 }
}

// What the CAPA form is prefilled with (see QualityCreatePage qualitySource).
export function effectivenessCapaSource(program,{en=false,today=new Date().toISOString().slice(0,10)}={}){
 const value=program.effectiveness||{}
 const result=optionLabel(EFFECTIVENESS_RESULTS,value.result,en)
 const method=optionLabel(EFFECTIVENESS_METHODS,value.method,en)
 const lines=[
  en?`Training “${program.title}” was evaluated as: ${result}.`:`Η εκπαίδευση «${program.title}» αξιολογήθηκε ως: ${result}.`,
  method&&(en?`Method: ${method}.`:`Μέθοδος: ${method}.`),
  value.criterion&&(en?`Criterion: ${value.criterion}`:`Κριτήριο: ${value.criterion}`),
  value.notes&&(en?`Findings: ${value.notes}`:`Ευρήματα: ${value.notes}`),
 ].filter(Boolean)
 return {
  source:'other',
  sourceId:`${TRAINING_SOURCE_PREFIX}${program.id}`,
  title:value.result==='partial'?(en?`Training partly effective: ${program.title}`:`Μερικώς αποτελεσματική εκπαίδευση: ${program.title}`):(en?`Training not effective: ${program.title}`:`Μη αποτελεσματική εκπαίδευση: ${program.title}`),
  description:lines.join('\n'),
  priority:value.result==='not_effective'?'high':'medium',
  dueDate:addMonths(today,1),
  subActions:(en?['Find why practice did not change','Targeted retraining or change of method','Re-evaluate effectiveness']:['Διερεύνηση γιατί δεν άλλαξε η πρακτική','Στοχευμένη επανεκπαίδευση ή αλλαγή μεθόδου','Επαναξιολόγηση αποτελεσματικότητας']).map((title,index)=>newSubAction(title,index)),
 }
}

export const capasForProgram=(capas=[],programId)=>capas.filter(capa=>capa.sourceId===`${TRAINING_SOURCE_PREFIX}${programId}`&&capa.lifecycleStatus!=='voided')
