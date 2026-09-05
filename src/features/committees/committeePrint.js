function esc(value=''){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function fmtDate(value,en=false){if(!value)return '—';return new Date(`${String(value).slice(0,10)}T12:00:00`).toLocaleDateString(en?'en-GB':'el-GR')}
function row(label,value){return `<div class="field"><span>${esc(label)}</span><strong>${esc(value||'—')}</strong></div>`}

export function printCommitteeRecord(record,{en=false}={}){
  if(!record)return
  const members=(record.memberRefs||[]).filter(x=>x.active!==false)
  const meetings=record.meetings||[]
  const decisions=record.decisions||[]
  const plan=record.annualPlan||[]
  const w=window.open('','_blank','width=1040,height=780')
  if(!w)return
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>${esc(record.id)} · ${esc(record.name)}</title><style>
  *{box-sizing:border-box}body{margin:0;padding:28px;font-family:Inter,Arial,sans-serif;color:#173149;background:#fff}header{display:flex;justify-content:space-between;gap:24px;padding-bottom:18px;border-bottom:2px solid #1f5f7a}.eyebrow{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#71869a;font-weight:800}h1{margin:5px 0 2px;font-size:24px}.sub{color:#6d8092;font-size:12px}.status{align-self:flex-start;padding:6px 10px;border-radius:999px;background:#edf7f1;color:#2f7652;font-size:11px;font-weight:800}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:18px}.field{border:1px solid #dce5eb;border-radius:9px;padding:11px 12px}.field span{display:block;font-size:9px;text-transform:uppercase;color:#758698;margin-bottom:6px}.field strong{font-size:12px;line-height:1.4}.section{margin-top:20px}.section h2{font-size:15px;margin:0 0 9px}.text{white-space:pre-wrap;border:1px solid #e1e8ed;border-radius:9px;padding:12px;font-size:11.5px;line-height:1.55;color:#40586d}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:18px}.metric{padding:12px;border:1px solid #dce5eb;border-radius:9px}.metric b{display:block;font-size:21px}.metric span{font-size:9px;color:#758698}.footer{margin-top:24px;padding-top:10px;border-top:1px solid #e3e9ee;font-size:9px;color:#7a8996}@media print{body{padding:0}.footer{position:fixed;bottom:0;left:0;right:0}}</style></head><body>
  <header><div><div class="eyebrow">Limoxis Observer · ${esc(record.id)}</div><h1>${esc(record.name)}</h1><div class="sub">${esc(record.shortName||'')}</div></div><div class="status">${record.status==='active'?(en?'Active':'Ενεργή'):(en?'Inactive':'Ανενεργή')}</div></header>
  <div class="metrics"><div class="metric"><b>${members.length}</b><span>${en?'Active members':'Ενεργά μέλη'}</span></div><div class="metric"><b>${meetings.length}</b><span>${en?'Meetings':'Συνεδριάσεις'}</span></div><div class="metric"><b>${decisions.filter(x=>x.status!=='completed').length}</b><span>${en?'Open actions':'Ανοιχτές ενέργειες'}</span></div><div class="metric"><b>${plan.filter(x=>x.status==='completed').length}/${plan.length}</b><span>${en?'Plan objectives':'Στόχοι σχεδίου'}</span></div></div>
  <div class="grid">${row(en?'Chair':'Πρόεδρος / Συντονιστής',record.chair)}${row(en?'Secretary':'Γραμματέας',record.secretary)}${row(en?'Term':'Θητεία',`${fmtDate(record.termStart,en)} → ${fmtDate(record.termEnd,en)}`)}${row(en?'Decision number':'Αρ. απόφασης',record.decisionNumber)}${row(en?'Meeting frequency':'Συχνότητα συνεδριάσεων',record.meetingFrequency)}${row(en?'Quorum':'Απαρτία',record.quorumRule)}${row(en?'Legal basis':'Θεσμική βάση',record.legalBasis)}${row(en?'Status':'Κατάσταση',record.status==='active'?(en?'Active':'Ενεργή'):(en?'Inactive':'Ανενεργή'))}</div>
  <section class="section"><h2>${en?'Committee role':'Ρόλος επιτροπής'}</h2><div class="text">${esc(record.committeeRole||'—')}</div></section>
  <section class="section"><h2>${en?'Responsibilities / mandate':'Αρμοδιότητες / σκοπός'}</h2><div class="text">${esc(record.mandate||'—')}</div></section>
  ${record.notes?`<section class="section"><h2>${en?'Notes':'Σημειώσεις'}</h2><div class="text">${esc(record.notes)}</div></section>`:''}
  <div class="footer">Limoxis Observer · ${esc(record.id)} · ${new Date().toLocaleString(en?'en-GB':'el-GR')}</div></body></html>`
  w.document.open();w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),180)
}
