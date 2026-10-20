import { StatusBadge } from '../../design-system/StatusBadge'

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
  el:{requested:'Αναμένεται λήψη',collected:'Ελήφθη',received:'Παραλήφθηκε',processing:'Σε επεξεργασία',completed:'Ολοκληρώθηκε',rejected:'Απορρίφθηκε',cancelled:'Ακυρώθηκε'},
  en:{requested:'Awaiting collection',collected:'Collected',received:'Received',processing:'In progress',completed:'Completed',rejected:'Rejected',cancelled:'Cancelled'},
}
export const labStatusLabel=(status,language='el')=>STATUS_WORDS[language==='en'?'en':'el'][status]||status
export const LAB_STATUS_ORDER=Object.keys(STATUS_WORDS.el)
// A result that is not yet an outcome (empty or only a draft) reads «Αναμένεται».
export const OUTCOME_RESULTS=['positive','negative','inconclusive','contaminated']
export const labResultLabel=(sample,t,language='el')=>OUTCOME_RESULTS.includes(sample?.result)?t(sample.result):(['rejected','cancelled'].includes(sample?.status)?'':(language==='en'?'Awaiting result':'Αναμένεται'))
