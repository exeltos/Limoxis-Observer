import { expiryChangeFormHtml,printHtml } from './controlExpiryPrint'
import { answerLabel,checklistScore,checklistSummary,rowFindingText } from './controlVocabulary'
import type { ChecklistItem, ControlExecution, ControlRecord, StructuredRow } from './controlTypes'

// A control as an entry's summary and print read it.
type EntryControl = Pick<ControlRecord, 'id' | 'title' | 'responseConfig'>
// An entry as its summary and print read it.
type EntryView = Partial<Pick<ControlExecution, 'at' | 'by' | 'value' | 'resultText' | 'checkedPoints' | 'notes' | 'structuredData'>>

export function emptyStructuredRow(template='generic_findings'){
 if(template==='medication_expiry')return {item:'',quantity:'',lot:'',expiry:'',finding:'',findingOther:''}
 return {item:'',finding:'',action:''}
}
// The rows a checklist entry starts with: one per item of the control.
export function checklistRows(record:{responseConfig?:EntryControl['responseConfig']|null}|null|undefined){
 return (record?.responseConfig?.checklist||[]).filter((item:ChecklistItem)=>String(item?.el||item?.label||'').trim()).map((item:ChecklistItem)=>({id:item.id,item:item.el||item.label,itemEn:item.en||item.el||item.label,required:item.required!==false,answer:'',note:''}))
}
export function listHasFinding(rows:(StructuredRow|null|undefined)[]=[]){
 return rows.some(r=>r&&('answer' in r?r.answer==='no':Object.values(r).some(v=>String(v??'').trim())&&Boolean(r.finding||r.action)))
}
// One line for an entry in the executions table.
export function structuredSummary(execution:EntryView|null|undefined,{record,language='el'}:{record?:Pick<EntryControl,'responseConfig'>|null,language?:string}={}){
 const en=language==='en'
 const structured=execution?.structuredData
 const rows:StructuredRow[]=structured?.rows||[]
 if(structured?.template==='checklist')return checklistSummary(rows,language)
 if(!rows.length){
  if(!execution?.value)return en?'Completed':'Ολοκληρώθηκε'
  const unit=record?.responseConfig?.mode==='numeric'&&record.responseConfig.unit?` ${record.responseConfig.unit}`:''
  return `${['choice','list'].includes(record?.responseConfig?.mode as string)?answerLabel(execution.value,language):execution.value}${unit}`
 }
 const findings=rows.filter(r=>r.finding||r.action).length
 return en?`${rows.length} rows${findings?` · ${findings} findings`:''}`:`${rows.length} εγγραφές${findings?` · ${findings} ευρήματα`:''}`
}
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as Record<string,string>)[c])
const CHECK_ANSWER:Record<string,string>={yes:'Ναι',no:'Όχι',na:'Δ/Ε'}
interface PrintControlArgs { record:EntryControl, department:string, execution:EntryView|null|undefined, actorName?:string }
function printableControlHtml({record,department,execution,actorName}:PrintControlArgs){
 if(record.responseConfig?.template==='medication_expiry')return expiryChangeFormHtml({record,department,execution,actorName})
 const rows:StructuredRow[]=execution?.structuredData?.rows||[]
 const checklist=execution?.structuredData?.template==='checklist'
 const headers=checklist
  ? [['item','Σημείο ελέγχου'],['answerDisplay','Απάντηση'],['note','Παρατήρηση']]
  : [['item','Στοιχείο'],['findingDisplay','Εύρημα'],['action','Ενέργεια']]
 const cell=(r:StructuredRow,k:string)=>k==='answerDisplay'?CHECK_ANSWER[r.answer as string]||'—':k==='findingDisplay'?rowFindingText(r)||r.finding:r[k as keyof StructuredRow]
 const score=checklist?checklistScore(rows):null
 return `<!doctype html><html lang="el"><head><meta charset="utf-8"><title>${esc(record.title)}</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#17233a}h1{font-size:20px;margin:0 0 6px}.meta{font-size:12px;color:#58697b;margin-bottom:20px}.box{border:1px solid #dbe3ea;border-radius:8px;padding:12px;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #dbe3ea;padding:7px;text-align:left}th{background:#f3f6f8}small{color:#6e7d8d}.footer{margin-top:24px;font-size:11px;color:#6e7d8d}@media print{body{padding:0}}</style></head><body><h1>${esc(record.title)}</h1><div class="meta">${esc(department)} · ${new Date(execution?.at||Date.now()).toLocaleString('el-GR',{hour12:false})}</div><div class="box"><strong>Καταχώρηση από:</strong> ${esc(execution?.by||actorName||'')}${score?`<br><strong>Συμμόρφωση:</strong> ${esc(checklistSummary(rows))}`:''}${execution?.resultText?`<br><strong>Αναλυτικό αποτέλεσμα:</strong> ${esc(execution.resultText)}`:''}${execution?.checkedPoints?`<br><strong>Σημεία ελέγχου:</strong> ${esc(execution.checkedPoints)}`:''}<br><strong>Σημειώσεις:</strong> ${esc(execution?.notes||'—')}</div>${rows.length?`<table><thead><tr>${headers.map(([,l])=>`<th>${l}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${headers.map(([k])=>`<td>${esc(cell(r,k))}</td>`).join('')}</tr>`).join('')}</tbody></table>`:`<div class="box"><strong>Αποτέλεσμα:</strong> ${esc(record.responseConfig?.mode==='choice'?answerLabel(execution?.value):execution?.value||'—')}</div>`}<div class="footer">Limoxis Observer · ${esc(record.id)}</div></body></html>`
}
export function printControlForm(args:PrintControlArgs){return printHtml(printableControlHtml(args))}
