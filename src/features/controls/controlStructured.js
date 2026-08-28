export function emptyStructuredRow(template='generic_findings'){
 if(template==='medication_expiry')return {item:'',quantity:'',expiry:'',finding:'',findingOther:''}
 return {item:'',finding:'',action:''}
}
export function listHasFinding(rows=[]){
 return rows.some(r=>Object.values(r||{}).some(v=>String(v??'').trim()) && (r.finding||r.action))
}
export function structuredSummary(execution){
 const rows=execution?.structuredData?.rows||[]
 if(!rows.length)return execution?.value||'Ολοκληρώθηκε'
 const findings=rows.filter(r=>r.finding||r.action).length
 return `${rows.length} εγγραφές${findings?` · ${findings} ευρήματα`:''}`
}
export function printableControlHtml({record,department,execution,actorName}){
 const rows=execution?.structuredData?.rows||[]
 const template=record.responseConfig?.template
 const headers=template==='medication_expiry'
  ? [['item','Υλικό / Φάρμακο'],['quantity','Ποσότητα'],['expiry','Ημερομηνία λήξης'],['findingDisplay','Εύρημα']]
  : [['item','Στοιχείο'],['finding','Εύρημα'],['action','Ενέργεια']]
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
 return `<!doctype html><html lang="el"><head><meta charset="utf-8"><title>${esc(record.title)}</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#17233a}h1{font-size:20px;margin:0 0 6px}.meta{font-size:12px;color:#58697b;margin-bottom:20px}.box{border:1px solid #dbe3ea;border-radius:8px;padding:12px;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #dbe3ea;padding:7px;text-align:left}th{background:#f3f6f8}small{color:#6e7d8d}.footer{margin-top:24px;font-size:11px;color:#6e7d8d}@media print{body{padding:0}}</style></head><body><h1>${esc(record.title)}</h1><div class="meta">${esc(department)} · ${new Date(execution?.at||Date.now()).toLocaleString('el-GR',{hour12:false})}</div><div class="box"><strong>Καταχώρηση από:</strong> ${esc(execution?.by||actorName||'')}<br><strong>Σημειώσεις:</strong> ${esc(execution?.notes||'—')}</div>${rows.length?`<table><thead><tr>${headers.map(([,l])=>`<th>${l}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${headers.map(([k])=>`<td>${esc(k==='findingDisplay'?(r.finding==='Άλλο'&&r.findingOther?`Άλλο — ${r.findingOther}`:r.finding):r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>`:`<div class="box"><strong>Αποτέλεσμα:</strong> ${esc(execution?.value||'—')}</div>`}<div class="footer">Limoxis Observer · ${esc(record.id)}</div></body></html>`
}
export function printControlForm(args){
 const w=window.open('','_blank','width=980,height=760')
 if(!w)return false
 w.document.open();w.document.write(printableControlHtml(args));w.document.close();w.focus();setTimeout(()=>w.print(),150);return true
}
