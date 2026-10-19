import { useMemo,useState } from 'react'
import { Check,Clock,X } from 'lucide-react'
import { ObserverDialog } from '../../../design-system/ObserverDialog'
import { ModeSwitch } from '../../../design-system/ModeSwitch'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { YesNoField } from '../../../design-system/YesNoField'
import { SaveButton } from '../../../design-system/SaveButton'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { MAX_REVISION_NOTE,addDaysKey,decisionProblem,revisionNoteFor,suggestionReasonLabel,suggestionReasonTone,todayKey } from './protocolReviewModel'

const PROBLEM_TEXT={
 el:{revision_unavailable:'Η αποδοχή ξεκινά νέα αναθεώρηση: χρειάζεται δημοσιευμένη έκδοση και δικαίωμα αναθεώρησης.',notes_required:'Γράψτε τις σημειώσεις της αναθεώρησης.',reason_required:'Ο λόγος απόρριψης είναι υποχρεωτικός.',date_required:'Επιλέξτε ημερομηνία.',date_in_past:'Η ημερομηνία πρέπει να είναι μετά από σήμερα.'},
 en:{revision_unavailable:'Accepting starts a new revision: it needs a published version and the right to revise.',notes_required:'Write the revision notes.',reason_required:'A rejection reason is required.',date_required:'Pick a date.',date_in_past:'The date must be after today.'},
}

// One decision on one suggestion: accept (starts a new revision, notes
// prefilled), reject (reason required) or later (a date). Closed only by ×.
export function ProtocolSuggestionDialog({suggestion,initialDecision='accepted',canRevise,busy=false,language='el',onClose,onSubmit}){
 const en=language==='en'
 const today=todayKey()
 const [decision,setDecision]=useState(initialDecision)
 const [includeDraft,setIncludeDraft]=useState(Boolean(suggestion?.draftText))
 const [notes,setNotes]=useState(()=>revisionNoteFor(suggestion,{language,includeDraft:Boolean(suggestion?.draftText)}))
 const [reason,setReason]=useState('')
 const [snoozeUntil,setSnoozeUntil]=useState(()=>addDaysKey(today,30))
 const problem=useMemo(()=>decisionProblem({decision,reason,snoozeUntil,notes,today,canRevise}),[decision,reason,snoozeUntil,notes,today,canRevise])
 const problemText=problem?(PROBLEM_TEXT[en?'en':'el'][problem]||''):''
 function toggleDraft(next){setIncludeDraft(next);setNotes(revisionNoteFor(suggestion,{language,includeDraft:next}))}
 const submitLabel=decision==='accepted'?(en?'Accept and start revision':'Αποδοχή και νέα αναθεώρηση'):decision==='rejected'?(en?'Reject suggestion':'Απόρριψη πρότασης'):(en?'Postpone':'Αναβολή')
 const submit=()=>{if(!problem&&!busy)onSubmit?.({decision,notes:notes.trim(),reason:reason.trim(),snoozeUntil})}
 return <ObserverDialog
  className="protocol-suggestion-dialog"
  eyebrow={en?'Update suggestion':'Πρόταση ανανέωσης'}
  title={suggestionReasonLabel(suggestion?.reason,language)}
  subtitle={en?'Nothing changes in the protocol until a revision is published.':'Το πρωτόκολλο δεν αλλάζει μέχρι να δημοσιευτεί αναθεώρηση.'}
  fixedHeight
  onClose={onClose}
  footer={<SaveButton loading={busy} disabled={Boolean(problem)||busy} onClick={submit}>{submitLabel}</SaveButton>}
 >
  <div className="protocol-suggestion-dialog-body">
   <ModeSwitch ariaLabel={en?'Decision':'Απόφαση'} value={decision} onChange={setDecision} options={[
    {value:'accepted',label:en?'Accept':'Αποδοχή',icon:Check},
    {value:'rejected',label:en?'Reject':'Απόρριψη',icon:X},
    {value:'snoozed',label:en?'Later':'Αργότερα',icon:Clock},
   ]}/>
   <div className="protocol-suggestion-summary">
    <StatusBadge tone={suggestionReasonTone(suggestion?.reason)}>{suggestionReasonLabel(suggestion?.reason,language)}</StatusBadge>
    <p>{suggestion?.whatChanged}</p>
   </div>
   {decision==='accepted'&&<>
    {suggestion?.draftText&&<YesNoField label={en?'Include the proposed wording in the notes':'Να μπει η προτεινόμενη διατύπωση στις σημειώσεις'} value={includeDraft} onChange={toggleDraft}/>}
    <label className="field"><span className="lo-field-label">{en?'Revision notes *':'Σημειώσεις αναθεώρησης *'}</span>
     <textarea rows={8} maxLength={MAX_REVISION_NOTE} value={notes} onChange={e=>setNotes(e.target.value)}/>
    </label>
    <small className="field-hint">{en?'A new draft version is created through the usual revision flow; the published version stays in force until the revision is published.':'Δημιουργείται νέα πρόχειρη έκδοση με την κανονική ροή αναθεώρησης· η δημοσιευμένη έκδοση ισχύει μέχρι να δημοσιευτεί η αναθεώρηση.'}</small>
   </>}
   {decision==='rejected'&&<label className="field"><span className="lo-field-label">{en?'Rejection reason *':'Λόγος απόρριψης *'}</span>
    <textarea rows={5} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} placeholder={en?'Why the protocol stays as it is…':'Γιατί το πρωτόκολλο μένει ως έχει…'}/>
   </label>}
   {decision==='snoozed'&&<ManualDateField label={en?'Show again on':'Να εμφανιστεί ξανά στις'} value={snoozeUntil} onChange={setSnoozeUntil}/>}
   {problemText&&<small className="field-error" role="status">{problemText}</small>}
  </div>
 </ObserverDialog>
}
