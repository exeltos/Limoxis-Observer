// Έλεγχος επικαιρότητας πρωτοκόλλων: what the screens need from a suggestion.
// The nightly protocol-review job writes them (protocol_update_suggestions);
// a person accepts (a new revision), rejects (with a reason) or postpones them.

export const SUGGESTION_REASONS=['review_due','source_changed','stale']
export const SUGGESTION_SECTIONS=['purpose','definitions','instructions','dosages','references']
export const MAX_REVISION_NOTE=2000

const REASON_LABELS={
 el:{review_due:'Λήγει η αναθεώρηση',source_changed:'Άλλαξε πηγή που αναφέρει',stale:'Παλαιό χωρίς αναθεώρηση'},
 en:{review_due:'Review due',source_changed:'A cited source changed',stale:'Old, no review date'},
}
const SECTION_LABELS={
 el:{purpose:'Σκοπός',definitions:'Ορισμοί',instructions:'Οδηγίες',dosages:'Δοσολογίες',references:'Βιβλιογραφία'},
 en:{purpose:'Purpose',definitions:'Definitions',instructions:'Instructions',dosages:'Dosages',references:'References'},
}
const STATUS_LABELS={
 el:{open:'Ανοιχτή',snoozed:'Σε αναμονή',accepted:'Αποδεκτή',rejected:'Απορρίφθηκε'},
 en:{open:'Open',snoozed:'Postponed',accepted:'Accepted',rejected:'Rejected'},
}
const lang=language=>language==='en'?'en':'el'
export const suggestionReasonLabel=(reason,language='el')=>REASON_LABELS[lang(language)][reason]||reason
export const suggestionSectionLabel=(section,language='el')=>SECTION_LABELS[lang(language)][section]||section
export const suggestionStatusLabel=(status,language='el')=>STATUS_LABELS[lang(language)][status]||status
export const suggestionReasonTone=reason=>reason==='review_due'?'danger':reason==='source_changed'?'warning':'info'

const pad=n=>String(n).padStart(2,'0')
export const todayKey=(date=new Date())=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`

export function suggestionFromRow(row){
 if(!row)return null
 return {
  id:row.id,organizationId:row.organization_id||null,documentId:row.document_id,reason:row.reason,
  sourceKind:row.source_kind||null,sourceRef:row.source_ref||'',sourceLabel:row.source_label||'',sourceUrl:row.source_url||'',
  whatChanged:row.what_changed||'',affectedSections:(row.affected_sections||[]).filter(s=>SUGGESTION_SECTIONS.includes(s)),details:row.details||{},
  draftText:row.draft_text||'',draftCitation:row.draft_citation||'',status:row.status||'open',
  decidedAt:row.decided_at||null,rejectionReason:row.rejection_reason||'',snoozedUntil:row.snoozed_until||'',
  revisionDocumentId:row.revision_document_id||null,createdAt:row.created_at||null,
 }
}

// A postponed suggestion is open again from its date on (the nightly job also reopens it).
export function effectiveStatus(suggestion,today=todayKey()){
 if(suggestion?.status==='snoozed'&&suggestion.snoozedUntil&&String(suggestion.snoozedUntil).slice(0,10)<=today)return 'open'
 return suggestion?.status||'open'
}
export const isOpenSuggestion=(suggestion,today)=>effectiveStatus(suggestion,today)==='open'

export const documentKey=record=>record?.dbId||record?.id||null

// The suggestions of one document version, open first, newest first.
export function suggestionsForDocument(list,record,today=todayKey()){
 const key=documentKey(record)
 if(!key)return {open:[],snoozed:[]}
 const mine=(list||[]).filter(s=>s.documentId===key)
 const byDate=(a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))
 return {
  open:mine.filter(s=>effectiveStatus(s,today)==='open').sort(byDate),
  snoozed:mine.filter(s=>effectiveStatus(s,today)==='snoozed').sort((a,b)=>String(a.snoozedUntil).localeCompare(String(b.snoozedUntil))),
 }
}

// Document keys (dbId or demo id) with at least one open suggestion.
export function documentsWithOpenSuggestions(list,today=todayKey()){
 return new Set((list||[]).filter(s=>isOpenSuggestion(s,today)).map(s=>s.documentId))
}
export const familyHasOpenSuggestion=(family,keys)=>Boolean(keys?.size)&&(family?.versions||[]).some(version=>keys.has(documentKey(version)))

// The revision notes a new revision starts with: the reason, what changed, the
// affected sections and, when asked, the drafted paragraph with its citation.
export function revisionNoteFor(suggestion,{language='el',includeDraft=true}={}){
 if(!suggestion)return ''
 const en=lang(language)==='en'
 const lines=[`${en?'Update suggestion':'Πρόταση ανανέωσης'}: ${suggestionReasonLabel(suggestion.reason,language)}.`]
 if(suggestion.whatChanged)lines.push(suggestion.whatChanged)
 if(suggestion.sourceLabel)lines.push(`${en?'Source':'Πηγή'}: ${suggestion.sourceLabel}`)
 if(suggestion.affectedSections?.length)lines.push(`${en?'Affected sections':'Ενότητες που επηρεάζονται'}: ${suggestion.affectedSections.map(s=>suggestionSectionLabel(s,language)).join(', ')}`)
 if(includeDraft&&suggestion.draftText){
  lines.push(`${en?'Proposed wording':'Προτεινόμενη διατύπωση'}: ${suggestion.draftText}`)
  if(suggestion.draftCitation)lines.push(`[${suggestion.draftCitation}]`)
 }
 return lines.join('\n').slice(0,MAX_REVISION_NOTE)
}

// The reason a decision cannot be saved yet, or null.
export function decisionProblem({decision,reason='',snoozeUntil='',notes='',today=todayKey(),canRevise=true}={}){
 if(decision==='accepted'){
  if(!canRevise)return 'revision_unavailable'
  if(!String(notes).trim())return 'notes_required'
  return null
 }
 if(decision==='rejected')return String(reason).trim()?null:'reason_required'
 if(decision==='snoozed'){
  const day=String(snoozeUntil||'').slice(0,10)
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return 'date_required'
  return day>today?null:'date_in_past'
 }
 return 'decision_required'
}

export function addDaysKey(day,days){
 const [y,m,d]=String(day).split('-').map(Number)
 return todayKey(new Date(y,m-1,d+days))
}

// The pending items of the calendar: one per open suggestion of a protocol the
// user owns, on today (or on the date it comes back, for a postponed one).
// ownerId undefined lists every protocol (the Demo, whose documents have no
// linked owner).
export function suggestionCalendarItems(list,documents,{today=todayKey(),language='el',ownerId}={}){
 const en=lang(language)==='en'
 const byKey=new Map((documents||[]).map(doc=>[documentKey(doc),doc]))
 const out=[]
 for(const s of list||[]){
  const doc=byKey.get(s.documentId)
  if(!doc)continue
  if(ownerId!==undefined&&(!doc.ownerId||doc.ownerId!==ownerId))continue
  const status=effectiveStatus(s,today)
  if(status!=='open'&&status!=='snoozed')continue
  const created=String(s.createdAt||'').slice(0,10)
  const date=status==='snoozed'?String(s.snoozedUntil).slice(0,10):(created&&created<today?today:created||today)
  out.push({id:`psug:${s.id}`,kind:'documents',date,title:doc.title,detail:`${en?'Update suggested':'Προτείνεται ανανέωση'} · ${suggestionReasonLabel(s.reason,language)}`,department:doc.department||'',path:`/documents/${doc.id}`,state:status==='snoozed'?'planned':'due',ownerId:doc.ownerId||null})
 }
 return out
}
