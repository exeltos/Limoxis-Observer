// Protocol-only fields of a controlled document: the kind of protocol and its
// clinical area (e.g. «Μαιευτική»). Both live in their own columns
// (controlled_documents.protocol_kind / clinical_area) and are empty for
// every other document type.

export const PROTOCOL_KINDS={
 el:{medical:'Ιατρικό πρωτόκολλο',nursing:'Νοσηλευτικό πρωτόκολλο',administrative:'Διοικητικό πρωτόκολλο',manual:'Εγχειρίδιο'},
 en:{medical:'Medical protocol',nursing:'Nursing protocol',administrative:'Administrative protocol',manual:'Manual'},
}

const KIND_KEYS=Object.keys(PROTOCOL_KINDS.el)
const clean=value=>String(value??'').replace(/\s+/g,' ').trim()

export const isProtocol=value=>value?.type==='protocol'

export function protocolFieldsFromRow(row){
 return {protocolKind:row?.protocol_kind||'',clinicalArea:row?.clinical_area||''}
}

// Columns written for a draft or patch. A non-protocol type clears both fields;
// an unknown kind is dropped rather than rejected by the database check.
export function protocolFieldsToRow(draft){
 if(!isProtocol(draft))return {protocol_kind:null,clinical_area:null}
 const kind=clean(draft.protocolKind),area=clean(draft.clinicalArea).slice(0,120)
 return {protocol_kind:KIND_KEYS.includes(kind)?kind:null,clinical_area:area||null}
}

export function protocolSummary(value,language='el'){
 if(!isProtocol(value))return ''
 const labels=PROTOCOL_KINDS[language]||PROTOCOL_KINDS.el
 return [labels[value.protocolKind]||'',clean(value.clinicalArea)].filter(Boolean).join(' · ')
}
