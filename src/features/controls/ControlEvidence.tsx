import { useRef } from 'react'
import { FilePlus2,ListChecks,Paperclip,Trash2 } from 'lucide-react'
import { getAttachmentUrl } from '../../core/attachments/attachmentService'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import './controlEvidence.css'

const ACCEPT='image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt'
const MAX_BYTES=15*1024*1024
const fmtSize=bytes=>bytes>=1024*1024?`${(bytes/1024/1024).toFixed(1)} MB`:`${Math.max(1,Math.round((bytes||0)/1024))} KB`

// Files chosen while recording a control. They are uploaded only when the
// entry is saved, so a cancelled entry leaves nothing behind.
export function ControlEvidencePicker({files,onChange,required=false,language='el'}){
 const en=language==='en'
 const inputRef=useRef(null)
 const {notify}=useFeedback()
 function add(list){
  const chosen=[...(list||[])]
  const tooBig=chosen.filter(file=>file.size>MAX_BYTES)
  if(tooBig.length)notify(en?`Files over 15 MB were skipped: ${tooBig.map(f=>f.name).join(', ')}`:`Παραλείφθηκαν αρχεία άνω των 15 MB: ${tooBig.map(f=>f.name).join(', ')}`,'error')
  onChange([...files,...chosen.filter(file=>file.size<=MAX_BYTES)])
 }
 return <section className={`control-evidence-section ${required&&!files.length?'missing':''}`.trim()}>
  <div className="control-evidence-heading">
   <div><strong><Paperclip size={15} aria-hidden="true"/>{en?'Evidence':'Τεκμήρια'}{required&&' *'}</strong><small>{required?(en?'This control needs a photo or file as proof, e.g. the sterilizer printout or the logger strip.':'Ο έλεγχος χρειάζεται φωτογραφία ή αρχείο ως απόδειξη, π.χ. εκτύπωση αποστειρωτή ή ταινία καταγραφικού.'):(en?'Optional photo or file attached to this entry.':'Προαιρετική φωτογραφία ή αρχείο για την καταχώρηση.')}</small></div>
   <Button variant="quiet" onClick={()=>inputRef.current?.click()}><FilePlus2 size={15}/>{en?' Add file':' Προσθήκη αρχείου'}</Button>
   <input ref={inputRef} type="file" multiple accept={ACCEPT} hidden onChange={e=>{add(e.target.files);e.target.value=''}}/>
  </div>
  {files.length>0
   ? <ul className="control-evidence-list">{files.map((file,index)=><li key={`${file.name}-${index}`}><Paperclip size={14} aria-hidden="true"/><span>{file.name}</span><small>{fmtSize(file.size)}</small><IconButton size="sm" label={en?`Remove ${file.name}`:`Αφαίρεση ${file.name}`} onClick={()=>onChange(files.filter((_,i)=>i!==index))}><Trash2 size={14}/></IconButton></li>)}</ul>
   : required&&<div className="control-evidence-missing">{en?'Add at least one file to save the entry.':'Προσθέστε τουλάχιστον ένα αρχείο για να αποθηκευτεί η καταχώρηση.'}</div>}
 </section>
}

// What to do when the result deviates, as set on the control definition.
export function ControlDeviationActions({text,language='el'}){
 if(!text)return null
 const en=language==='en'
 return <div className="governance-banner danger control-deviation-actions" role="note"><ListChecks size={17} aria-hidden="true"/><div><strong>{en?'Actions on deviation':'Ενέργειες σε απόκλιση'}</strong><p>{text}</p></div></div>
}

// Evidence saved with an execution: opens a fresh signed link on click.
export function ControlEvidenceLinks({evidence=[],language='el'}){
 const {notify}=useFeedback()
 if(!evidence.length)return null
 const en=language==='en'
 async function open(item){
  if(!item.storagePath)return
  try{const url=await getAttachmentUrl(item.storagePath);if(url)window.open(url,'_blank','noopener,noreferrer')}
  catch{notify(en?'The file could not be opened.':'Δεν ήταν δυνατό το άνοιγμα του αρχείου.','error')}
 }
 return <span className="control-evidence-links">{evidence.map((item,index)=>item.storagePath
  ? <button key={index} type="button" className="control-evidence-link" onClick={event=>{event.stopPropagation();void open(item)}} title={item.name}><Paperclip size={12} aria-hidden="true"/>{item.name}</button>
  : <span key={index} className="control-evidence-link" title={item.name}><Paperclip size={12} aria-hidden="true"/>{item.name}</span>)}</span>
}
