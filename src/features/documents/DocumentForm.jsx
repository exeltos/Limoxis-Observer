import { ManualDateField } from '../../design-system/ManualDateField'
import { PROTOCOL_KINDS } from './protocolFields'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import './documentForm.css'

export const DOCUMENT_TYPES={
 el:{policy:'Πολιτική',procedure:'Διαδικασία',instruction:'Οδηγία',form:'Έντυπο',protocol:'Πρωτόκολλο',other:'Άλλο'},
 en:{policy:'Policy',procedure:'Procedure',instruction:'Instruction',form:'Form',protocol:'Protocol',other:'Other'},
}

export const createEmptyDocumentDraft=()=>({title:'',type:'policy',version:'0.1',departmentId:null,audience:'all',effectiveDate:'',reviewDate:'',description:'',protocolKind:'',clinicalArea:''})
export const documentDraftIsValid=value=>Boolean(value?.title?.trim()&&value?.version?.trim()&&(!value?.effectiveDate||!value?.reviewDate||value.reviewDate>=value.effectiveDate))

export function DocumentForm({value,onChange,language='el',departments=[],ownerName='',showOwner=true,showAttachmentHint=false,autoFocus=false,readOnly=false,allowVersionEdit=false}){
 const en=language==='en',v=value||createEmptyDocumentDraft(),set=(key,next)=>onChange?.({...v,[key]:next}),types=DOCUMENT_TYPES[language]||DOCUMENT_TYPES.el
 // One grid of three equal columns, labels above 40px controls, rows of the same height:
 // title · type / version · department / owner · effective · review / description;
 // a protocol: title · type / version · department · protocol kind / clinical area / owner · effective · review.
 const protocol=v.type==='protocol'
 const hints=[!readOnly&&!allowVersionEdit&&(en?'The version is controlled by the document lifecycle.':'Η έκδοση ελέγχεται από τον κύκλο ζωής του εγγράφου.'),showOwner&&!readOnly&&(en?'The owner is recorded automatically from the signed-in user.':'Ο υπεύθυνος καταγράφεται αυτόματα από τον συνδεδεμένο χρήστη.')].filter(Boolean)
 return <div className="document-form-grid">
  <label className="field document-span-2"><span className="lo-field-label">{en?'Title *':'Τίτλος *'}</span><input autoFocus={autoFocus} value={v.title||''} disabled={readOnly} onChange={e=>set('title',e.target.value)}/></label>
  <SearchableSelect className="field" label={en?'Type':'Τύπος'} value={v.type||'policy'} disabled={readOnly} onChange={x=>set('type',x||'policy')} options={Object.entries(types).map(([key,label])=>({value:key,label}))}/>
  <label className="field"><span className="lo-field-label">{en?'Version *':'Έκδοση *'}</span><input value={v.version||''} disabled={readOnly||!allowVersionEdit} onChange={e=>set('version',e.target.value)} placeholder="1.0"/></label>
  <SearchableSelect className={`field ${protocol?'':'document-span-2'}`} label={en?'Department / scope':'Τμήμα / πεδίο εφαρμογής'} value={v.departmentId||departments.find(d=>d.name===v.department)?.id||''} disabled={readOnly} onChange={x=>{const id=x||null;onChange?.({...v,departmentId:id,department:departments.find(d=>d.id===id)?.name||''})}} options={[{value:'',label:en?'Whole hospital / not specified':'Όλο το νοσοκομείο / χωρίς συγκεκριμένο τμήμα'},...departments.map(row=>({value:row.id,label:row.name}))]}/>
  {protocol&&<SearchableSelect className="field" label={en?'Protocol kind':'Είδος πρωτοκόλλου'} value={v.protocolKind||''} disabled={readOnly} onChange={x=>set('protocolKind',x||'')} options={[{value:'',label:en?'Not specified':'Χωρίς είδος'},...Object.entries(PROTOCOL_KINDS[language]||PROTOCOL_KINDS.el).map(([key,label])=>({value:key,label}))]}/>}
  {protocol&&<label className="field document-span-3"><span className="lo-field-label">{en?'Clinical area':'Κλινικό πεδίο'}</span><input value={v.clinicalArea||''} disabled={readOnly} maxLength={120} onChange={e=>set('clinicalArea',e.target.value)} placeholder={en?'e.g. Obstetrics':'π.χ. Μαιευτική'}/></label>}
  {showOwner&&<label className="field"><span className="lo-field-label">{en?'Owner':'Υπεύθυνος'}</span><input value={ownerName||'—'} disabled readOnly/></label>}
  <ManualDateField className="field" label={en?'Effective date':'Ημερομηνία ισχύος'} value={v.effectiveDate||''} onChange={x=>!readOnly&&set('effectiveDate',x)} disabled={readOnly}/>
  <ManualDateField className="field" label={en?'Review date':'Ημερομηνία επανεξέτασης'} value={v.reviewDate||''} onChange={x=>!readOnly&&set('reviewDate',x)} disabled={readOnly}/>
  <label className="field document-span-3"><span className="lo-field-label">{en?'Description':'Περιγραφή'}</span><textarea rows="3" value={v.description||''} disabled={readOnly} onChange={e=>set('description',e.target.value)}/></label>
  {hints.length>0&&<p className="field-hint document-span-3">{hints.join(' ')}</p>}
  {v.effectiveDate&&v.reviewDate&&v.reviewDate<v.effectiveDate&&<div className="source-truth-note document-span-3">{en?'Review date cannot be before the effective date.':'Η ημερομηνία επανεξέτασης δεν μπορεί να προηγείται της ημερομηνίας ισχύος.'}</div>}
  {showAttachmentHint&&<div className="source-truth-note document-span-3">{en?'Save the document first. Attachments are then uploaded to the saved record from the Files tab.':'Αποθηκεύστε πρώτα το έγγραφο. Τα συνημμένα ανεβαίνουν στη συνέχεια στην πραγματική εγγραφή από την καρτέλα «Αρχεία».'}</div>}
 </div>
}
