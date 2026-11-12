// Licence-only fields of a controlled document (type «Άδεια / Πιστοποιητικό»):
// how often it is renewed (months) and what requires it (legislation, ISO 9001…).
// They live in their own columns (controlled_documents.renewal_months /
// required_by) and are empty for every other type. A licence's issue date is
// the document's effective date and its expiry is the review date, so the
// expiry shows wherever review dates already appear (calendar, «review due»).
import { protocolSummary } from './protocolFields'

export const LICENCE_TYPE='licence'

export const REQUIRED_BY={
 el:{legislation:'Νομοθεσία',iso9001:'ISO 9001',iso15189:'ISO 15189',accreditation:'Διαπίστευση',contract:'Σύμβαση',other:'Άλλο'},
 en:{legislation:'Legislation',iso9001:'ISO 9001',iso15189:'ISO 15189',accreditation:'Accreditation',contract:'Contract',other:'Other'},
}
const REQUIRED_KEYS=Object.keys(REQUIRED_BY.el)
export const MAX_RENEWAL_MONTHS=240

export const isLicence=value=>value?.type===LICENCE_TYPE

const months=value=>{
 if(value===''||value==null)return null
 const n=Number(value)
 return Number.isInteger(n)&&n>=1&&n<=MAX_RENEWAL_MONTHS?n:null
}
const requiredList=value=>[...new Set((Array.isArray(value)?value:[]).map(item=>String(item||'').trim()).filter(item=>REQUIRED_KEYS.includes(item)))]
 .sort((a,b)=>REQUIRED_KEYS.indexOf(a)-REQUIRED_KEYS.indexOf(b))

export function licenceFieldsFromRow(row){
 return {renewalMonths:row?.renewal_months??'',requiredBy:requiredList(row?.required_by)}
}

// Columns written for a draft or patch. Another type clears both fields; a value
// outside the database checks is dropped rather than rejected.
export function licenceFieldsToRow(draft){
 if(!isLicence(draft))return {renewal_months:null,required_by:null}
 const required=requiredList(draft.requiredBy)
 return {renewal_months:months(draft.renewalMonths),required_by:required.length?required:null}
}

export function toggleRequiredBy(list,key){
 const current=requiredList(list)
 return current.includes(key)?current.filter(item=>item!==key):requiredList([...current,key])
}

export function renewalLabel(value,language='el'){
 const n=months(value)
 if(!n)return ''
 const en=language==='en'
 if(n%12===0){const years=n/12;return en?`Renewal every ${years===1?'year':`${years} years`}`:`Ανανέωση ${years===1?'κάθε χρόνο':`κάθε ${years} χρόνια`}`}
 return en?`Renewal every ${n} month${n===1?'':'s'}`:`Ανανέωση κάθε ${n} ${n===1?'μήνα':'μήνες'}`
}

export function licenceSummary(value,language='el'){
 if(!isLicence(value))return ''
 const labels=REQUIRED_BY[language]||REQUIRED_BY.el
 const required=requiredList(value.requiredBy).map(key=>labels[key]).join(', ')
 return [renewalLabel(value.renewalMonths,language),required].filter(Boolean).join(' · ')
}

// The line under the type in the documents list: protocol kind/area or licence renewal.
export const documentTypeSummary=(value,language='el')=>protocolSummary(value,language)||licenceSummary(value,language)
