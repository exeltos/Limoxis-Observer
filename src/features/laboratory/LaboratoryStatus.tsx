import { StatusBadge } from '../../design-system/StatusBadge'
import { sampleProgress } from './laboratorySampleProgress'
import { environmentalResultWord } from './environmentalLimit'
import type { LabSample } from './laboratoryTypes'

// The one laboratory status label (sample status, result, result validation),
// on the shared StatusBadge: done / negative green, in progress blue,
// positive / critical / rejected red, anything else neutral.
const TONES: Record<string, string>={completed:'success',negative:'success',validated:'success',amended:'success',requested:'info',collected:'info',received:'info',processing:'info',draft:'info',positive:'danger',critical:'danger',rejected:'danger'}
export const laboratoryStatusTone=(kind: string|null|undefined)=>TONES[kind as string]||'neutral'

export function LaboratoryStatus({text,kind,tone}:{text?: string|null,kind?: string|null,tone?: string|null}){
  return <StatusBadge tone={tone||laboratoryStatusTone(kind)}>{text}</StatusBadge>
}

// The list's status in plain words (what happens to the sample next), not codes.
const STATUS_WORDS: Record<'el'|'en', Record<string, string>>={
  el:{requested:'Αναμένεται λήψη',collected:'Συλλέχθηκε',received:'Παραλήφθηκε',processing:'Σε επεξεργασία',completed:'Ολοκληρώθηκε',rejected:'Απορρίφθηκε',cancelled:'Ακυρώθηκε'},
  en:{requested:'Awaiting collection',collected:'Collected',received:'Received',processing:'In progress',completed:'Completed',rejected:'Rejected',cancelled:'Cancelled'},
}
export const labStatusLabel=(status: string,language='el')=>STATUS_WORDS[language==='en'?'en':'el'][status]||status
export const LAB_STATUS_ORDER=Object.keys(STATUS_WORDS.el)
// A validated result is not the end: until the sample is finalized its status names the step
// still open (antibiogram, critical-result call, records check), in the list and the record alike.
const PENDING_WORDS: Record<'el'|'en', Record<string, string>>={
  el:{ast:'Εκκρεμεί αντιβιόγραμμα',communication:'Εκκρεμεί επικοινωνία κρίσιμου',documents:'Εκκρεμεί έλεγχος εγγράφων',finalize:'Προς οριστικοποίηση'},
  en:{ast:'Antibiogram pending',communication:'Critical call pending',documents:'Records check pending',finalize:'Ready to finalize'},
}
export function labSampleStatus(sample: Partial<LabSample>|null|undefined,language='el'): {text: string, kind: string, tone?: string, step?: string}{
  const words=PENDING_WORDS[language==='en'?'en':'el']
  if(sample?.status!=='completed'||sample?.finalizedAt)return {text:labStatusLabel(sample?.status as string,language),kind:sample?.status as string}
  const progress=sampleProgress(sample)
  const step=!progress.astComplete?'ast':!progress.communicationComplete?'communication':!progress.documentsReviewed?'documents':'finalize'
  return {text:words[step],kind:'pending',tone:'warning',step}
}
// A result that is not yet an outcome (empty or only a draft) reads «Αναμένεται».
export const OUTCOME_RESULTS: (string|null|undefined)[]=['positive','negative','inconclusive','contaminated']
export const labResultLabel=(sample: Partial<LabSample>|null|undefined,t: (key: string)=>string,language='el')=>OUTCOME_RESULTS.includes(sample?.result)?((sample?.subjectType&&sample.subjectType!=='patient'&&environmentalResultWord(sample.microbiologyResults?.[0],language))||t(sample?.result as string)):((['rejected','cancelled'] as unknown[]).includes(sample?.status)?'':(language==='en'?'Awaiting result':'Αναμένεται'))
