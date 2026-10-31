import { StatusBadge } from '../../design-system/StatusBadge'
import { sampleProgress } from './laboratorySampleProgress'

// The one laboratory status label (sample status, result, result validation),
// on the shared StatusBadge: done / negative green, in progress blue,
// positive / critical / rejected red, anything else neutral.
const TONES={completed:'success',negative:'success',validated:'success',amended:'success',requested:'info',collected:'info',received:'info',processing:'info',draft:'info',positive:'danger',critical:'danger',rejected:'danger'}
export const laboratoryStatusTone=kind=>TONES[kind]||'neutral'

export function LaboratoryStatus({text,kind,tone}){
  return <StatusBadge tone={tone||laboratoryStatusTone(kind)}>{text}</StatusBadge>
}

// The list's status in plain words (what happens to the sample next), not codes.
const STATUS_WORDS={
  el:{requested:'Αναμένεται λήψη',collected:'Συλλέχθηκε',received:'Παραλήφθηκε',processing:'Σε επεξεργασία',completed:'Ολοκληρώθηκε',rejected:'Απορρίφθηκε',cancelled:'Ακυρώθηκε'},
  en:{requested:'Awaiting collection',collected:'Collected',received:'Received',processing:'In progress',completed:'Completed',rejected:'Rejected',cancelled:'Cancelled'},
}
export const labStatusLabel=(status,language='el')=>STATUS_WORDS[language==='en'?'en':'el'][status]||status
export const LAB_STATUS_ORDER=Object.keys(STATUS_WORDS.el)
// A validated result is not the end: until the sample is finalized its status names the step
// still open (antibiogram, critical-result call, records check), in the list and the record alike.
const PENDING_WORDS={
  el:{ast:'Εκκρεμεί αντιβιόγραμμα',communication:'Εκκρεμεί επικοινωνία κρίσιμου',documents:'Εκκρεμεί έλεγχος εγγράφων',finalize:'Προς οριστικοποίηση'},
  en:{ast:'Antibiogram pending',communication:'Critical call pending',documents:'Records check pending',finalize:'Ready to finalize'},
}
export function labSampleStatus(sample,language='el'){
  const words=PENDING_WORDS[language==='en'?'en':'el']
  if(sample?.status!=='completed'||sample?.finalizedAt)return {text:labStatusLabel(sample?.status,language),kind:sample?.status}
  const progress=sampleProgress(sample)
  const step=!progress.astComplete?'ast':!progress.communicationComplete?'communication':!progress.documentsReviewed?'documents':'finalize'
  return {text:words[step],kind:'pending',tone:'warning',step}
}
// A result that is not yet an outcome (empty or only a draft) reads «Αναμένεται».
export const OUTCOME_RESULTS=['positive','negative','inconclusive','contaminated']
export const labResultLabel=(sample,t,language='el')=>OUTCOME_RESULTS.includes(sample?.result)?t(sample.result):(['rejected','cancelled'].includes(sample?.status)?'':(language==='en'?'Awaiting result':'Αναμένεται'))
