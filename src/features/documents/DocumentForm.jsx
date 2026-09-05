import { ManualDateField } from '../../design-system/ManualDateField'

export const DOCUMENT_TYPES={
 el:{policy:'Πολιτική',procedure:'Διαδικασία',instruction:'Οδηγία',form:'Έντυπο',protocol:'Πρωτόκολλο',other:'Άλλο'},
 en:{policy:'Policy',procedure:'Procedure',instruction:'Instruction',form:'Form',protocol:'Protocol',other:'Other'},
}

export const createEmptyDocumentDraft=()=>({title:'',type:'policy',version:'0.1',departmentId:null,audience:'all',effectiveDate:'',reviewDate:'',description:''})
export const documentDraftIsValid=value=>Boolean(value?.title?.trim()&&value?.version?.trim()&&(!value?.effectiveDate||!value?.reviewDate||value.reviewDate>=value.effectiveDate))

export function DocumentForm({value,onChange,language='el',departments=[],ownerName='',showOwner=true,showAttachmentHint=false,autoFocus=false}){
 const en=language==='en',v=value||createEmptyDocumentDraft(),set=(key,next)=>onChange({...v,[key]:next}),types=DOCUMENT_TYPES[language]||DOCUMENT_TYPES.el
 return <div className="entry-grid">
  <label className="entry-span-2"><span>{en?'Title *':'Τίτλος *'}</span><input autoFocus={autoFocus} value={v.title||''} onChange={e=>set('title',e.target.value)}/></label>
  <label><span>{en?'Type':'Τύπος'}</span><select value={v.type||'policy'} onChange={e=>set('type',e.target.value)}>{Object.entries(types).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
  <label><span>{en?'Version *':'Έκδοση *'}</span><input value={v.version||''} onChange={e=>set('version',e.target.value)} placeholder="1.0"/></label>
  <label><span>{en?'Department / scope':'Τμήμα / πεδίο εφαρμογής'}</span><select value={v.departmentId||''} onChange={e=>set('departmentId',e.target.value||null)}><option value="">{en?'Whole hospital / not specified':'Όλο το νοσοκομείο / χωρίς συγκεκριμένο τμήμα'}</option>{departments.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
  {showOwner&&<div className="source-truth-note"><strong>{en?'Owner':'Υπεύθυνος'}:</strong> {ownerName||'—'}<br/><small>{en?'The owner is recorded automatically from the authenticated user.':'Ο υπεύθυνος καταγράφεται αυτόματα από τον συνδεδεμένο χρήστη.'}</small></div>}
  <ManualDateField label={en?'Effective date':'Ημερομηνία ισχύος'} value={v.effectiveDate||''} onChange={x=>set('effectiveDate',x)} optional/>
  <ManualDateField label={en?'Review date':'Ημερομηνία επανεξέτασης'} value={v.reviewDate||''} onChange={x=>set('reviewDate',x)} optional/>
  <label className="entry-span-2"><span>{en?'Description':'Περιγραφή'}</span><textarea rows="3" value={v.description||''} onChange={e=>set('description',e.target.value)}/></label>
  {v.effectiveDate&&v.reviewDate&&v.reviewDate<v.effectiveDate&&<div className="source-truth-note entry-span-2">{en?'Review date cannot be before the effective date.':'Η ημερομηνία επανεξέτασης δεν μπορεί να προηγείται της ημερομηνίας ισχύος.'}</div>}
  {showAttachmentHint&&<div className="source-truth-note entry-span-2">{en?'Save the document first. Attachments are then uploaded to the saved record from the Files tab.':'Αποθηκεύστε πρώτα το έγγραφο. Τα συνημμένα ανεβαίνουν στη συνέχεια στην πραγματική εγγραφή από την καρτέλα «Αρχεία».'}</div>}
 </div>
}
