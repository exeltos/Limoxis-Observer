import { useMemo,useRef,useState } from 'react'
import { Check,Clock,ExternalLink,RefreshCcwDot,X } from 'lucide-react'
import { SectionHeader } from '../../../design-system/SectionHeader'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { ActionButton } from '../../../design-system/ActionButton'
import { formatDay } from '../../../core/i18n/formatDay'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { decideProtocolSuggestionAsync } from './protocolReviewService'
import { suggestionReasonLabel,suggestionReasonTone,suggestionSectionLabel,suggestionsForDocument } from './protocolReviewModel'
import { ProtocolSuggestionDialog } from './ProtocolSuggestionDialog'
import './protocolReview.css'

// «Προτείνεται ανανέωση»: the open suggestions of this protocol version, from
// the nightly currency review. Accepting starts a revision through the
// record page's usual flow (onStartRevision); nothing changes by itself.
export function ProtocolReviewPanel({record,suggestions,organizationId,actor,canDecide,canRevise,language='el',onStartRevision,onChanged}){
 const en=language==='en'
 const {notify}=useFeedback()
 const [dialog,setDialog]=useState(null)
 const [busy,setBusy]=useState(false)
 // The revision made for a suggestion whose decision then failed: a retry links it, never a second draft.
 const started=useRef(new Map())
 const {open,snoozed}=useMemo(()=>suggestionsForDocument(suggestions,record),[suggestions,record])
 if(record?.type!=='protocol'||(!open.length&&!snoozed.length))return null

 async function submit({decision,notes,reason,snoozeUntil}){
  const suggestion=dialog?.suggestion
  if(!suggestion||busy)return
  setBusy(true)
  try{
   if(decision==='accepted'){
    const revision=started.current.get(suggestion.id)||await onStartRevision?.(notes,suggestion)
    if(!revision)return
    started.current.set(suggestion.id,revision)
    await decideProtocolSuggestionAsync(organizationId,suggestion,{decision,revisionDocumentId:revision.dbId||null},actor)
    notify(en?'Suggestion accepted: a new draft revision was created.':'Η πρόταση έγινε δεκτή: δημιουργήθηκε νέα πρόχειρη αναθεώρηση.','success')
    started.current.delete(suggestion.id)
    setDialog(null)
    await onChanged?.(revision)
    return
   }
   await decideProtocolSuggestionAsync(organizationId,suggestion,{decision,reason,snoozeUntil},actor)
   notify(decision==='rejected'?(en?'Suggestion rejected.':'Η πρόταση απορρίφθηκε.'):(en?`Suggestion postponed to ${formatDay(snoozeUntil,language)}.`:`Η πρόταση μετατέθηκε για ${formatDay(snoozeUntil,language)}.`),'success')
   setDialog(null)
   await onChanged?.(null)
  }catch(error){
   notify(error?.message||(en?'The decision could not be saved.':'Η απόφαση δεν αποθηκεύτηκε.'),'danger')
  }finally{setBusy(false)}
 }

 return <section className="record-section protocol-review-panel" aria-label={en?'Update suggested':'Προτείνεται ανανέωση'}>
  <SectionHeader
   title={<span className="protocol-review-title"><RefreshCcwDot size={16} aria-hidden="true"/>{en?'Update suggested':'Προτείνεται ανανέωση'}</span>}
   subtitle={open.length
    ?(en?`${open.length} open suggestion${open.length===1?'':'s'} from the currency review. Nothing changes without your decision.`:`${open.length} ${open.length===1?'ανοιχτή πρόταση':'ανοιχτές προτάσεις'} από τον έλεγχο επικαιρότητας. Τίποτα δεν αλλάζει χωρίς την απόφασή σας.`)
    :(en?'No open suggestion.':'Καμία ανοιχτή πρόταση.')}
  />
  {open.length>0&&<ul className="protocol-review-list">
   {open.map(suggestion=><li key={suggestion.id} className="protocol-review-item">
    <div className="protocol-review-item-head">
     <StatusBadge tone={suggestionReasonTone(suggestion.reason)}>{suggestionReasonLabel(suggestion.reason,language)}</StatusBadge>
     {suggestion.createdAt&&<small>{en?'Found':'Εντοπίστηκε'} {formatDay(suggestion.createdAt,language)}</small>}
    </div>
    <p className="protocol-review-change">{suggestion.whatChanged}</p>
    {suggestion.sourceLabel&&<p className="protocol-review-source"><strong>{en?'Source':'Πηγή'}:</strong> {suggestion.sourceUrl?<a href={suggestion.sourceUrl} target="_blank" rel="noreferrer">{suggestion.sourceLabel}<ExternalLink size={12} aria-hidden="true"/></a>:suggestion.sourceLabel}</p>}
    {suggestion.affectedSections.length>0&&<div className="protocol-review-sections"><span className="lo-field-label">{en?'Affected sections':'Ενότητες που επηρεάζονται'}</span>{suggestion.affectedSections.map(section=><StatusBadge key={section} tone="neutral">{suggestionSectionLabel(section,language)}</StatusBadge>)}</div>}
    {suggestion.draftText&&<blockquote className="protocol-review-draft">
     <span className="lo-field-label">{en?'Proposed wording':'Προτεινόμενη διατύπωση'}</span>
     <p>{suggestion.draftText}</p>
     {suggestion.draftCitation&&<cite>{suggestion.draftCitation}</cite>}
    </blockquote>}
    {canDecide&&<div className="record-actions">
     <ActionButton tone="primary" label={en?'Accept':'Αποδοχή'} disabled={busy} onClick={()=>setDialog({suggestion,decision:'accepted'})}><Check size={15}/>{en?'Accept':'Αποδοχή'}</ActionButton>
     <ActionButton tone="danger" label={en?'Reject':'Απόρριψη'} disabled={busy} onClick={()=>setDialog({suggestion,decision:'rejected'})}><X size={15}/>{en?'Reject':'Απόρριψη'}</ActionButton>
     <ActionButton tone="neutral" label={en?'Later':'Αργότερα'} disabled={busy} onClick={()=>setDialog({suggestion,decision:'snoozed'})}><Clock size={15}/>{en?'Later':'Αργότερα'}</ActionButton>
    </div>}
   </li>)}
  </ul>}
  {snoozed.length>0&&<p className="protocol-review-snoozed">{en?'Postponed':'Σε αναμονή'}: {snoozed.map(s=>`${suggestionReasonLabel(s.reason,language)} (${en?'until':'έως'} ${formatDay(s.snoozedUntil,language)})`).join(' · ')}</p>}
  {dialog&&<ProtocolSuggestionDialog suggestion={dialog.suggestion} initialDecision={dialog.decision} canRevise={canRevise} busy={busy} language={language} onClose={()=>setDialog(null)} onSubmit={submit}/>}
 </section>
}
