import { ManualDateField } from '../../design-system/ManualDateField'
import { PROTOCOL_KINDS } from './protocolFields'
import { REQUIRED_BY, MAX_RENEWAL_MONTHS, toggleRequiredBy } from './licenceFields'

export const DOCUMENT_TYPES={
 el:{policy:'Πολιτική',procedure:'Διαδικασία',instruction:'Οδηγία',form:'Έντυπο',protocol:'Πρωτόκολλο',licence:'Άδεια / Πιστοποιητικό',other:'Άλλο'},
 en:{policy:'Policy',procedure:'Procedure',instruction:'Instruction',form:'Form',protocol:'Protocol',licence:'Licence / certificate',other:'Other'},
}

export const createEmptyDocumentDraft=()=>({title:'',type:'policy',version:'0.1',departmentId:null,audience:'all',effectiveDate:'',reviewDate:'',description:'',protocolKind:'',clinicalArea:'',renewalMonths:'',requiredBy:[]})
export const documentDraftIsValid=value=>Boolean(value?.title?.trim()&&value?.version?.trim()&&(!value?.effectiveDate||!value?.reviewDate||value.reviewDate>=value.effectiveDate))

export function DocumentForm({value,onChange,language='el',departments=[],ownerName='',showOwner=true,showAttachmentHint=false,autoFocus=false,readOnly=false,allowVersionEdit=false}){
 const en=language==='en',v=value||createEmptyDocumentDraft(),set=(key,next)=>onChange?.({...v,[key]:next}),types=DOCUMENT_TYPES[language]||DOCUMENT_TYPES.el,licence=v.type==='licence'
 return <div className="entry-grid">
  <label className="field entry-span-2"><span>{en?'Title *':'Τίτλος *'}</span><input autoFocus={autoFocus} value={v.title||''} disabled={readOnly} onChange={e=>set('title',e.target.value)}/></label>
  <label className="field"><span>{en?'Type':'Τύπος'}</span><select value={v.type||'policy'} disabled={readOnly} onChange={e=>set('type',e.target.value)}>{Object.entries(types).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
  <label className="field"><span>{en?'Version *':'Έκδοση *'}</span><input value={v.version||''} disabled={readOnly||!allowVersionEdit} onChange={e=>set('version',e.target.value)} placeholder="1.0"/>{!readOnly&&!allowVersionEdit&&<small>{en?'Version is controlled by the document lifecycle.':'Η έκδοση ελέγχεται από τον κύκλο ζωής του εγγράφου.'}</small>}</label>
  {v.type==='protocol'&&<label className="field"><span>{en?'Protocol kind':'Είδος πρωτοκόλλου'}</span><select value={v.protocolKind||''} disabled={readOnly} onChange={e=>set('protocolKind',e.target.value)}><option value="">{en?'Not specified':'Χωρίς είδος'}</option>{Object.entries(PROTOCOL_KINDS[language]||PROTOCOL_KINDS.el).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}
  {v.type==='protocol'&&<label className="field"><span>{en?'Clinical area':'Κλινικό πεδίο'}</span><input value={v.clinicalArea||''} disabled={readOnly} maxLength={120} onChange={e=>set('clinicalArea',e.target.value)} placeholder={en?'e.g. Obstetrics':'π.χ. Μαιευτική'}/></label>}
  {licence&&<label className="field"><span>{en?'Renewal every (months)':'Ανανέωση κάθε (μήνες)'}</span><input type="number" min="1" max={MAX_RENEWAL_MONTHS} step="1" value={v.renewalMonths??''} disabled={readOnly} onChange={e=>set('renewalMonths',e.target.value)} placeholder="12"/></label>}
  <label className="field"><span>{en?'Department / scope':'Τμήμα / πεδίο εφαρμογής'}</span><select value={v.departmentId||departments.find(d=>d.name===v.department)?.id||''} disabled={readOnly} onChange={e=>{const id=e.target.value||null;onChange?.({...v,departmentId:id,department:departments.find(d=>d.id===id)?.name||''})}}><option value="">{en?'Whole hospital / not specified':'Όλο το νοσοκομείο / χωρίς συγκεκριμένο τμήμα'}</option>{departments.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
  {showOwner&&<label className="field document-owner-field"><span>{en?'Owner':'Υπεύθυνος'}</span><div className="document-owner-value">{ownerName||'—'}</div><small>{en?'Recorded automatically from the signed-in user.':'Καταγράφεται αυτόματα από τον συνδεδεμένο χρήστη.'}</small></label>}
  <ManualDateField className="field" label={licence?(en?'Issue date':'Ημερομηνία έκδοσης'):(en?'Effective date':'Ημερομηνία ισχύος')} value={v.effectiveDate||''} onChange={x=>!readOnly&&set('effectiveDate',x)} optional disabled={readOnly}/>
  <ManualDateField className="field" label={licence?(en?'Expiry date':'Ημερομηνία λήξης'):(en?'Review date':'Ημερομηνία επανεξέτασης')} value={v.reviewDate||''} onChange={x=>!readOnly&&set('reviewDate',x)} optional disabled={readOnly}/>
  {licence&&<div className="field entry-span-2"><span>{en?'Required by':'Απαιτείται από'}</span><div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:8}}>{Object.entries(REQUIRED_BY[language]||REQUIRED_BY.el).map(([key,label])=><label key={key} className={`check-option${(v.requiredBy||[]).includes(key)?' selected':''}`} style={{height:34,minHeight:34,padding:'0 10px'}}><input type="checkbox" checked={(v.requiredBy||[]).includes(key)} disabled={readOnly} onChange={()=>set('requiredBy',toggleRequiredBy(v.requiredBy,key))}/><span>{label}</span></label>)}</div></div>}
  <label className="field entry-span-2"><span>{en?'Description':'Περιγραφή'}</span><textarea rows="3" value={v.description||''} disabled={readOnly} onChange={e=>set('description',e.target.value)}/></label>
  {v.effectiveDate&&v.reviewDate&&v.reviewDate<v.effectiveDate&&<div className="source-truth-note entry-span-2">{licence?(en?'Expiry date cannot be before the issue date.':'Η ημερομηνία λήξης δεν μπορεί να προηγείται της ημερομηνίας έκδοσης.'):(en?'Review date cannot be before the effective date.':'Η ημερομηνία επανεξέτασης δεν μπορεί να προηγείται της ημερομηνίας ισχύος.')}</div>}
  {showAttachmentHint&&<div className="source-truth-note entry-span-2">{en?'Save the document first. Attachments are then uploaded to the saved record from the Files tab.':'Αποθηκεύστε πρώτα το έγγραφο. Τα συνημμένα ανεβαίνουν στη συνέχεια στην πραγματική εγγραφή από την καρτέλα «Αρχεία».'}</div>}
 </div>
}
