import { DetailFields } from '../../design-system/DetailList'
import { ManualDateField } from '../../design-system/ManualDateField'
import { PROTOCOL_KINDS } from './protocolFields'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { MultiSelect } from '../../design-system/MultiSelect'
import { REQUIRED_BY, MAX_RENEWAL_MONTHS } from './licenceFields'
import './documentForm.css'

export const DOCUMENT_TYPES={
 el:{policy:'Πολιτική',procedure:'Διαδικασία',instruction:'Οδηγία',form:'Έντυπο',protocol:'Πρωτόκολλο',licence:'Άδεια / Πιστοποιητικό',other:'Άλλο'},
 en:{policy:'Policy',procedure:'Procedure',instruction:'Instruction',form:'Form',protocol:'Protocol',licence:'Licence / certificate',other:'Other'},
}

export const createEmptyDocumentDraft=()=>({title:'',type:'policy',version:'0.1',departmentId:null,audience:'all',effectiveDate:'',reviewDate:'',description:'',protocolKind:'',clinicalArea:'',renewalMonths:'',requiredBy:[]})
export const documentDraftIsValid=value=>Boolean(value?.title?.trim()&&value?.version?.trim()&&(!value?.effectiveDate||!value?.reviewDate||value.reviewDate>=value.effectiveDate))

export function DocumentForm({value,onChange,language='el',departments=[],ownerName='',showOwner=true,showAttachmentHint=false,autoFocus=false,readOnly=false,allowVersionEdit=false}){
 const en=language==='en',v=value||createEmptyDocumentDraft(),set=(key,next)=>onChange?.({...v,[key]:next}),types=DOCUMENT_TYPES[language]||DOCUMENT_TYPES.el
 // One grid of three equal columns, labels above 40px controls, rows of the same height:
 // title · type / version · department / owner · effective · review / description;
 // a protocol: title · type / version · department · protocol kind / clinical area / owner · effective · review;
 // a licence: title · type / version · department · renewal months / required by / owner · issue · expiry.
 const protocol=v.type==='protocol',licence=v.type==='licence',requiredLabels=REQUIRED_BY[language]||REQUIRED_BY.el
 const hints=[!readOnly&&!allowVersionEdit&&(en?'The version is controlled by the document lifecycle.':'Η έκδοση ελέγχεται από τον κύκλο ζωής του εγγράφου.'),showOwner&&!readOnly&&(en?'The owner is recorded automatically from the signed-in user.':'Ο υπεύθυνος καταγράφεται αυτόματα από τον συνδεδεμένο χρήστη.')].filter(Boolean)
 return <div className="document-form-grid">
  <label className="field document-span-2"><span className="lo-field-label">{en?'Title *':'Τίτλος *'}</span><input autoFocus={autoFocus} value={v.title||''} disabled={readOnly} onChange={e=>set('title',e.target.value)}/></label>
  <SearchableSelect className="field" label={en?'Type':'Τύπος'} value={v.type||'policy'} disabled={readOnly} onChange={x=>set('type',x||'policy')} options={Object.entries(types).map(([key,label])=>({value:key,label}))}/>
  <label className="field"><span className="lo-field-label">{en?'Version *':'Έκδοση *'}</span><input value={v.version||''} disabled={readOnly||!allowVersionEdit} onChange={e=>set('version',e.target.value)} placeholder="1.0"/></label>
  <SearchableSelect className={`field ${protocol||licence?'':'document-span-2'}`} label={en?'Department / scope':'Τμήμα / πεδίο εφαρμογής'} value={v.departmentId||departments.find(d=>d.name===v.department)?.id||''} disabled={readOnly} onChange={x=>{const id=x||null;onChange?.({...v,departmentId:id,department:departments.find(d=>d.id===id)?.name||''})}} options={[{value:'',label:en?'Whole hospital / not specified':'Όλο το νοσοκομείο / χωρίς συγκεκριμένο τμήμα'},...departments.map(row=>({value:row.id,label:row.name}))]}/>
  {protocol&&<SearchableSelect className="field" label={en?'Protocol kind':'Είδος πρωτοκόλλου'} value={v.protocolKind||''} disabled={readOnly} onChange={x=>set('protocolKind',x||'')} options={[{value:'',label:en?'Not specified':'Χωρίς είδος'},...Object.entries(PROTOCOL_KINDS[language]||PROTOCOL_KINDS.el).map(([key,label])=>({value:key,label}))]}/>}
  {protocol&&<label className="field document-span-3"><span className="lo-field-label">{en?'Clinical area':'Κλινικό πεδίο'}</span><input value={v.clinicalArea||''} disabled={readOnly} maxLength={120} onChange={e=>set('clinicalArea',e.target.value)} placeholder={en?'e.g. Obstetrics':'π.χ. Μαιευτική'}/></label>}
  {licence&&<label className="field"><span className="lo-field-label">{en?'Renewal every (months)':'Ανανέωση κάθε (μήνες)'}</span><input type="number" min="1" max={MAX_RENEWAL_MONTHS} step="1" value={v.renewalMonths??''} disabled={readOnly} onChange={e=>set('renewalMonths',e.target.value)} placeholder="12"/></label>}
  {licence&&<MultiSelect className="field document-span-3" tags search={false} label={en?'Required by':'Απαιτείται από'} options={Object.entries(requiredLabels).map(([key,label])=>({value:key,label}))} selected={v.requiredBy||[]} disabled={readOnly} onChange={next=>set('requiredBy',Object.keys(requiredLabels).filter(key=>next.includes(key)))} placeholder={en?'Not specified':'Χωρίς ένδειξη'}/>}
  {showOwner&&<label className="field"><span className="lo-field-label">{en?'Owner':'Υπεύθυνος'}</span><input value={ownerName||'—'} disabled readOnly/></label>}
  <ManualDateField className="field" label={licence?(en?'Issue date':'Ημερομηνία έκδοσης'):(en?'Effective date':'Ημερομηνία ισχύος')} value={v.effectiveDate||''} onChange={x=>!readOnly&&set('effectiveDate',x)} disabled={readOnly}/>
  <ManualDateField className="field" label={licence?(en?'Expiry date':'Ημερομηνία λήξης'):(en?'Review date':'Ημερομηνία επανεξέτασης')} value={v.reviewDate||''} onChange={x=>!readOnly&&set('reviewDate',x)} disabled={readOnly}/>
  <label className="field document-span-3"><span className="lo-field-label">{en?'Description':'Περιγραφή'}</span><textarea rows="3" value={v.description||''} disabled={readOnly} onChange={e=>set('description',e.target.value)}/></label>
  {hints.length>0&&<p className="field-hint document-span-3">{hints.join(' ')}</p>}
  {v.effectiveDate&&v.reviewDate&&v.reviewDate<v.effectiveDate&&<div className="source-truth-note document-span-3">{licence?(en?'Expiry date cannot be before the issue date.':'Η ημερομηνία λήξης δεν μπορεί να προηγείται της ημερομηνίας έκδοσης.'):(en?'Review date cannot be before the effective date.':'Η ημερομηνία επανεξέτασης δεν μπορεί να προηγείται της ημερομηνίας ισχύος.')}</div>}
  {showAttachmentHint&&<div className="source-truth-note document-span-3">{en?'Save the document first. Attachments are then uploaded to the saved record from the Files tab.':'Αποθηκεύστε πρώτα το έγγραφο. Τα συνημμένα ανεβαίνουν στη συνέχεια στην πραγματική εγγραφή από την καρτέλα «Αρχεία».'}</div>}
 </div>
}

// The document as read (Overview): the filled fields only; «Edit» opens the form.
export function DocumentDetails({value,language='el',departments=[],ownerName=''}){
 const en=language==='en',v=value||createEmptyDocumentDraft(),types=DOCUMENT_TYPES[language]||DOCUMENT_TYPES.el,requiredLabels=REQUIRED_BY[language]||REQUIRED_BY.el
 const licence=v.type==='licence',protocol=v.type==='protocol'
 const day=iso=>iso?new Intl.DateTimeFormat(en?'en-GB':'el-GR').format(new Date(`${String(iso).slice(0,10)}T12:00:00`)):''
 const department=departments.find(d=>d.id===v.departmentId)?.name||v.department||(en?'Whole hospital':'Όλο το νοσοκομείο')
 return <DetailFields fields={[
  {label:en?'Type':'Τύπος',value:types[v.type]||v.type},
  {label:en?'Version':'Έκδοση',value:v.version},
  {label:en?'Department / scope':'Τμήμα / πεδίο εφαρμογής',value:department},
  {label:en?'Owner':'Υπεύθυνος',value:ownerName,hidden:!ownerName},
  {label:en?'Protocol kind':'Είδος πρωτοκόλλου',value:(PROTOCOL_KINDS[language]||PROTOCOL_KINDS.el)[v.protocolKind]||v.protocolKind,hidden:!protocol||!v.protocolKind},
  {label:en?'Clinical area':'Κλινικό πεδίο',value:v.clinicalArea,hidden:!protocol||!v.clinicalArea},
  {label:en?'Renewal every':'Ανανέωση κάθε',value:`${v.renewalMonths} ${en?'months':'μήνες'}`,hidden:!licence||!v.renewalMonths},
  {label:en?'Required by':'Απαιτείται από',value:(v.requiredBy||[]).map(key=>requiredLabels[key]||key).join(', '),hidden:!licence||!(v.requiredBy||[]).length},
  {label:licence?(en?'Issue date':'Ημερομηνία έκδοσης'):(en?'Effective date':'Ημερομηνία ισχύος'),value:day(v.effectiveDate),hidden:!v.effectiveDate},
  {label:licence?(en?'Expiry date':'Ημερομηνία λήξης'):(en?'Review date':'Ημερομηνία επανεξέτασης'),value:day(v.reviewDate),hidden:!v.reviewDate},
  {label:en?'Description':'Περιγραφή',value:v.description,hidden:!v.description},
 ]}/>
}
