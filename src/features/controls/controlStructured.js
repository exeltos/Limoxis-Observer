import { expiryChangeFormHtml,printHtml } from './controlExpiryPrint'
import { answerLabel,checklistScore,checklistSummary,rowFindingText } from './controlVocabulary'

export function emptyStructuredRow(template='generic_findings'){
 if(template==='medication_expiry')return {item:'',quantity:'',lot:'',expiry:'',finding:'',findingOther:''}
 return {item:'',finding:'',action:''}
}
// The rows a checklist entry starts with: one per item of the control.
export function checklistRows(record){
 return (record?.responseConfig?.checklist||[]).filter(item=>String(item?.el||item?.label||'').trim()).map(item=>({id:item.id,item:item.el||item.label,itemEn:item.en||item.el||item.label,required:item.required!==false,answer:'',note:''}))
}
export function listHasFinding(rows=[]){
 return rows.some(r=>r&&('answer' in r?r.answer==='no':Object.values(r).some(v=>String(v??'').trim())&&Boolean(r.finding||r.action)))
}
// One line for an entry in the executions table.
export function structuredSummary(execution,{record,language='el'}={}){
 const en=language==='en'
 const structured=execution?.structuredData
 const rows=structured?.rows||[]
 if(structured?.template==='checklist')return checklistSummary(rows,language)
 if(!rows.length){
  if(!execution?.value)return en?'Completed':'Ολοκληρώθηκε'
  const unit=record?.responseConfig?.mode==='numeric'&&record.responseConfig.unit?` ${record.responseConfig.unit}`:''
  return `${record?.responseConfig?.mode==='choice'?answerLabel(execution.value,language):execution.value}${unit}`
 }
 const findings=rows.filter(r=>r.finding||r.action).length
 return en?`${rows.length} rows${findings?` · ${findings} findings`:''}`:`${rows.length} εγγραφές${findings?` · ${findings} ευρήματα`:''}`
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const CHECK_ANSWER={yes:'Ναι',no:'Όχι',na:'Δ/Ε'}
function printableControlHtml({record,department,execution,actorName}){
 if(record.responseConfig?.template==='medication_expiry')return expiryChangeFormHtml({record,department,execution,actorName})
 const rows=execution?.structuredData?.rows||[]
 const checklist=execution?.structuredData?.template==='checklist'
 const headers=checklist
  ? [['item','Σημείο ελέγχου'],['answerDisplay','Απάντηση'],['note','Παρατήρηση']]
  : [['item','Στοιχείο'],['findingDisplay','Εύρημα'],['action','Ενέργεια']]
 const cell=(r,k)=>k==='answerDisplay'?CHECK_ANSWER[r.answer]||'—':k==='findingDisplay'?rowFindingText(r)||r.finding:r[k]
 const score=checklist?checklistScore(rows):null
 return `<!doctype html><html lang="el"><head><meta charset="utf-8"><title>${esc(record.title)}</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#17233a}h1{font-size:20px;margin:0 0 6px}.meta{font-size:12px;color:#58697b;margin-bottom:20px}.box{border:1px solid #dbe3ea;border-radius:8px;padding:12px;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #dbe3ea;padding:7px;text-align:left}th{background:#f3f6f8}small{color:#6e7d8d}.footer{margin-top:24px;font-size:11px;color:#6e7d8d}@media print{body{padding:0}}</style></head><body><h1>${esc(record.title)}</h1><div class="meta">${esc(department)} · ${new Date(execution?.at||Date.now()).toLocaleString('el-GR',{hour12:false})}</div><div class="box"><strong>Καταχώρηση από:</strong> ${esc(execution?.by||actorName||'')}${score?`<br><strong>Συμμόρφωση:</strong> ${esc(checklistSummary(rows))}`:''}${execution?.resultText?`<br><strong>Αναλυτικό αποτέλεσμα:</strong> ${esc(execution.resultText)}`:''}${execution?.checkedPoints?`<br><strong>Σημεία ελέγχου:</strong> ${esc(execution.checkedPoints)}`:''}<br><strong>Σημειώσεις:</strong> ${esc(execution?.notes||'—')}</div>${rows.length?`<table><thead><tr>${headers.map(([,l])=>`<th>${l}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${headers.map(([k])=>`<td>${esc(cell(r,k))}</td>`).join('')}</tr>`).join('')}</tbody></table>`:`<div class="box"><strong>Αποτέλεσμα:</strong> ${esc(record.responseConfig?.mode==='choice'?answerLabel(execution?.value):execution?.value||'—')}</div>`}<div class="footer">Limoxis Observer · ${esc(record.id)}</div></body></html>`
}
export function printControlForm(args){return printHtml(printableControlHtml(args))}
