// What a control's fields mean, independent of the screen's language: control
// types (library controlTypes) and the result format each one starts with,
// status answers (library controlAnswers) and which of them count as a finding,
// and the findings of an expiry check. Records store the Greek library name (or
// a code), never the label the screen happened to show.
import { DEFAULT_EXPIRY_AFTER_DAYS,DEFAULT_EXPIRY_BEFORE_DAYS } from './controlExpiry'

const COMPLIANT='Συμμορφώνεται',NON_COMPLIANT='Μη συμμόρφωση'

// The result format a control type starts with. Keyed by library code; the
// names cover control types typed before the library existed.
const PRESET_BY_CODE={
 'CTRL-TEMP':{mode:'numeric',label:'Θερμοκρασία',unit:'°C',min:'',max:''},
 'CTRL-EXPIRY':{mode:'list',label:'Ευρήματα',template:'medication_expiry',expiryBeforeDays:DEFAULT_EXPIRY_BEFORE_DAYS,expiryAfterDays:DEFAULT_EXPIRY_AFTER_DAYS},
 'CTRL-ENV':{mode:'list',label:'Δείγματα / ευρήματα',template:'generic_findings'},
 'CTRL-EQUIP':{mode:'choice',label:'Κατάσταση',options:['Λειτουργικό','Εκτός λειτουργίας'],reportOn:['Εκτός λειτουργίας']},
 'CTRL-HYGIENE':{mode:'choice',label:'Κατάσταση',options:[COMPLIANT,NON_COMPLIANT],reportOn:[NON_COMPLIANT]},
 'CTRL-DISINF':{mode:'choice',label:'Κατάσταση',options:[COMPLIANT,NON_COMPLIANT],reportOn:[NON_COMPLIANT]},
 'CTRL-AUDIT':{mode:'checklist',label:'Λίστα ελέγχου',checklist:[]},
}
const CODE_BY_NAME={
 'θερμοκρασίες':'CTRL-TEMP','έλεγχος θερμοκρασίας':'CTRL-TEMP',
 'φάρμακα / υλικά':'CTRL-EXPIRY','λήξεις':'CTRL-EXPIRY','έλεγχος ημερομηνιών λήξης':'CTRL-EXPIRY',
 'καλλιέργειες':'CTRL-ENV','περιβαλλοντικός μικροβιολογικός έλεγχος':'CTRL-ENV',
 'εξοπλισμός':'CTRL-EQUIP','έλεγχος εξοπλισμού':'CTRL-EQUIP',
 'καθαριότητα / απολύμανση':'CTRL-HYGIENE','έλεγχος υγιεινής / καθαριότητας':'CTRL-HYGIENE',
 'έλεγχος απολύμανσης / αποστείρωσης':'CTRL-DISINF','επιθεώρηση με λίστα ελέγχου':'CTRL-AUDIT',
}
export function controlTypeCode(category,typeItems=[]){
 const text=String(category||'').trim().toLocaleLowerCase('el')
 if(!text)return null
 const item=typeItems.find(x=>[x.el,x.en,x.value].some(name=>String(name||'').trim().toLocaleLowerCase('el')===text))
 return item?.code||CODE_BY_NAME[text]||null
}
export function categoryPreset(category,typeItems=[]){
 const preset=PRESET_BY_CODE[controlTypeCode(category,typeItems)]
 return preset?structuredClone(preset):null
}

// Status answers that are a finding when no reportOn list says otherwise.
const FINDING_ANSWERS=new Set([NON_COMPLIANT,'Non-compliant','Μερική συμμόρφωση','Partially compliant','Μη καθαρό','Not clean','Εκτός λειτουργίας','Out of order'])
const ANSWER_EN={[COMPLIANT]:'Compliant',[NON_COMPLIANT]:'Non-compliant','Μερική συμμόρφωση':'Partially compliant','Καθαρό':'Clean','Μη καθαρό':'Not clean','Λειτουργικό':'Working','Εκτός λειτουργίας':'Out of order','Δεν εφαρμόζεται':'Not applicable'}
const ANSWER_EL=Object.fromEntries(Object.entries(ANSWER_EN).map(([el,en])=>[en,el]))

// A stored answer in Greek: entries recorded from the English screen held the
// English label.
export const canonicalAnswer=value=>ANSWER_EL[String(value||'')]||String(value||'')

// The status choices of a control: [{value,finding}] in the order shown.
export function choiceOptions(response={},answerItems=[]){
 const options=(Array.isArray(response?.options)&&response.options.length?response.options:[COMPLIANT,NON_COMPLIANT]).map(canonicalAnswer).filter(Boolean)
 const reportOn=Array.isArray(response?.reportOn)?new Set(response.reportOn.map(canonicalAnswer)):null
 const codeOf=value=>answerItems.find(item=>item.value===value)?.code||null
 return [...new Set(options)].map(value=>({value,code:codeOf(value),finding:reportOn?reportOn.has(value):FINDING_ANSWERS.has(value)}))
}
export function answerLabel(value,language='el',answerItems=[]){
 const text=canonicalAnswer(value)
 if(language!=='en')return text
 return answerItems.find(item=>item.value===text)?.en||ANSWER_EN[text]||text
}
export function isFindingAnswer(response,value,answerItems=[]){
 const text=canonicalAnswer(value)
 return Boolean(text)&&choiceOptions(response,answerItems).some(option=>option.value===text&&option.finding)
}

// Findings of an expiry row, stored as codes.
export const EXPIRY_FINDINGS=['expired','expiring','other']
const EXPIRY_FINDING_LABEL={expired:['Ληγμένο','Expired'],expiring:['Κοντόληκτο','Near expiry'],other:['Άλλο','Other']}
export function expiryFindingCode(value){
 const text=String(value||'').trim()
 if(!text)return ''
 if(EXPIRY_FINDINGS.includes(text))return text
 const match=Object.entries(EXPIRY_FINDING_LABEL).find(([,labels])=>labels.includes(text))
 return match?match[0]:'other'
}
export function expiryFindingLabel(value,language='el'){
 const code=expiryFindingCode(value)
 return code?EXPIRY_FINDING_LABEL[code][language==='en'?1:0]:''
}
// What a row's finding says, with the free text of «Other».
export function rowFindingText(row,language='el'){
 const code=expiryFindingCode(row?.finding)
 if(code==='other')return String(row?.findingOther||'').trim()||(EXPIRY_FINDINGS.includes(String(row?.finding))?expiryFindingLabel(code,language):String(row?.finding||''))
 return expiryFindingLabel(code,language)
}

// Checklist answers.
export const CHECKLIST_ANSWERS=['yes','no','na']
export function checklistScore(rows=[]){
 const answered=rows.filter(row=>row.answer==='yes'||row.answer==='no')
 const yes=answered.filter(row=>row.answer==='yes').length
 return {applicable:answered.length,yes,no:answered.length-yes,unanswered:rows.filter(row=>!row.answer).length,rate:answered.length?Math.round(yes*100/answered.length):null}
}
export function checklistSummary(rows=[],language='el'){
 const {applicable,yes,rate}=checklistScore(rows)
 if(!applicable)return language==='en'?'No applicable items':'Κανένα εφαρμόσιμο σημείο'
 return language==='en'?`${yes}/${applicable} compliant (${rate}%)`:`${yes}/${applicable} συμμόρφωση (${rate}%)`
}
