// The change form of an expiry check, printed for the pharmacy or the
// administration to sign: what was replaced or updated at this check (before →
// after), what was checked with no change, and signature boxes.
import { expiryState,expiryWindow,formLabel } from './controlExpiry'
import { rowFindingText } from './controlVocabulary'

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const day=value=>{const [y,m,d]=String(value||'').slice(0,10).split('-');return y&&m&&d?`${d}/${m}/${y}`:(value||'')}
const same=(a,b)=>String(a??'').trim()===String(b??'').trim()

// What happened to one row at this check: a new lot or expiry is a replacement,
// a new quantity an update, an item that was not on the list is new.
export function expiryRowChange(row){
 const before=row?.previous
 if(row?.removedAt)return 'removed'
 if(!before)return row?.fromCatalogue?'unchanged':'new'
 if(!same(before.lot,row.lot)||!same(before.expiry,row.expiry))return 'replaced'
 if(!same(before.quantity,row.quantity))return 'updated'
 return 'unchanged'
}
const CHANGE_LABEL={replaced:'Αντικατάσταση',updated:'Ενημέρωση ποσότητας',new:'Νέο υλικό',removed:'Αφαιρέθηκε',unchanged:'Χωρίς αλλαγή'}

function beforeAfter(before,after,format=v=>v){
 const a=format(before),b=format(after)
 if(before===undefined||same(a,b))return esc(b||'—')
 return `<span class="was">${esc(a||'—')}</span> → <strong>${esc(b||'—')}</strong>`
}

export function expiryChangeFormHtml({record,department,execution,actorName}){
 const rows=(execution?.structuredData?.rows||[]).filter(row=>String(row?.item||'').trim())
 const window=expiryWindow(record)
 const at=new Date(execution?.at||Date.now())
 const changed=rows.filter(row=>expiryRowChange(row)!=='unchanged')
 const unchanged=rows.filter(row=>expiryRowChange(row)==='unchanged')
 const status=row=>{const {state,days}=expiryState(row.expiry,window,at);return state==='expired'?`Ληγμένο (${-days} ημ.)`:state==='expiring'?`Λήγει σε ${days} ημ.`:state==='ok'?'Εντός':'—'}
 const changeRows=changed.map(row=>{const before=row.previous||{};return `<tr class="${expiryRowChange(row)}"><td><strong>${esc(row.item)}</strong>${row.form?`<small>${esc(formLabel(row.form))}</small>`:''}</td><td>${beforeAfter(before.quantity,row.quantity)}</td><td>${beforeAfter(before.lot,row.lot)}</td><td>${beforeAfter(before.expiry,row.expiry,day)}</td><td>${esc(status(row))}</td><td><strong>${CHANGE_LABEL[expiryRowChange(row)]}</strong></td><td>${esc([rowFindingText(row),row.note].filter(Boolean).join(' · ')||'')}</td></tr>`}).join('')
 const sign=label=>`<div class="sign"><span>${label}</span><div class="line"></div><small>Ονοματεπώνυμο / Υπογραφή / Ημερομηνία</small></div>`
 return `<!doctype html><html lang="el"><head><meta charset="utf-8"><title>${esc(record.title)} · ${esc(department)}</title><style>
body{font-family:Arial,sans-serif;padding:28px;color:#17233a;font-size:12px}h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;margin:18px 0 8px}
.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid #cfd9e2;border-radius:6px;margin:12px 0}.meta div{padding:8px 10px;border-right:1px solid #e1e8ee}.meta div:last-child{border-right:0}.meta span{display:block;font-size:10px;color:#5d6f80}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #cfd9e2;padding:6px 7px;text-align:left;vertical-align:top}th{background:#eef3f7;font-size:11px}small{display:block;color:#5d6f80;font-size:10px}
.was{color:#8a96a3;text-decoration:line-through}tr.replaced td:nth-child(6){color:#9a4d00}tr.new td:nth-child(6){color:#1f6f9f}
.checked{color:#3c4d5d;line-height:1.6}.notes{border:1px solid #cfd9e2;border-radius:6px;padding:8px 10px;min-height:28px}
.signs{display:grid;grid-template-columns:repeat(2,1fr);gap:22px 32px;margin-top:28px}.sign span{font-weight:700}.sign .line{border-bottom:1px solid #17233a;height:34px}
.footer{margin-top:24px;font-size:10px;color:#6e7d8d}@media print{body{padding:0}}
</style></head><body>
<h1>Έντυπο αλλαγών · ${esc(record.title)}</h1>
<div class="meta"><div><span>Τμήμα</span><strong>${esc(department)}</strong></div><div><span>Ημερομηνία ελέγχου</span><strong>${esc(at.toLocaleString('el-GR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}))}</strong></div><div><span>Έλεγχος από</span><strong>${esc(execution?.by||actorName||'')}</strong></div><div><span>Υλικά που ελέγχθηκαν</span><strong>${rows.length} · ${changed.length} αλλαγές</strong></div></div>
<h2>Αλλαγές σε αυτόν τον έλεγχο</h2>
${changed.length?`<table><thead><tr><th>Υλικό / Φάρμακο</th><th>Ποσότητα</th><th>Παρτίδα</th><th>Ημερομηνία λήξης</th><th>Κατάσταση</th><th>Ενέργεια</th><th>Εύρημα / Παρατήρηση</th></tr></thead><tbody>${changeRows}</tbody></table>`:'<div class="notes">Δεν έγιναν αλλαγές σε αυτόν τον έλεγχο.</div>'}
${unchanged.length?`<h2>Ελέγχθηκαν χωρίς αλλαγή (${unchanged.length})</h2><div class="checked">${unchanged.map(row=>`${esc(row.item)} <small style="display:inline">(λήξη ${esc(day(row.expiry)||'—')})</small>`).join(' · ')}</div>`:''}
<h2>Σημειώσεις</h2><div class="notes">${esc(execution?.notes||'')}</div>
<div class="signs">${sign('Ο/Η ελέγξας/ασα')}${sign('Προϊστάμενος/η τμήματος')}${sign('Φαρμακείο')}${sign('Διεύθυνση — Έγκριση')}</div>
<div class="footer">Limoxis Observer · ${esc(record.id)}</div>
</body></html>`
}

// The return and replacement request: the items that have expired or expire
// soon, per department, for the pharmacy to take back and replace. Quantities to
// return and to replace are left to fill in by hand, with signature boxes.
export function expiryReturnFormHtml({title,items,actorName,now=new Date()}){
 const departments=[...new Set(items.map(item=>item.department))]
 const status=item=>item.state==='expired'?`Ληγμένο (${-item.days} ημ.)`:`Λήγει σε ${item.days} ημ.`
 const rows=items.map((item,index)=>`<tr class="${item.state}"><td>${index+1}</td><td><strong>${esc(item.row.item)}</strong>${item.row.form?`<small>${esc(formLabel(item.row.form))}</small>`:''}</td>${departments.length>1?`<td>${esc(item.department)}</td>`:''}<td>${esc(item.row.lot||'—')}</td><td>${esc(day(item.row.expiry))}</td><td>${esc(status(item))}</td><td>${esc(item.row.quantity||'')}</td><td class="fill"></td><td class="fill"></td><td>${esc(item.row.note||'')}</td></tr>`).join('')
 const sign=label=>`<div class="sign"><span>${label}</span><div class="line"></div><small>Ονοματεπώνυμο / Υπογραφή / Ημερομηνία</small></div>`
 return `<!doctype html><html lang="el"><head><meta charset="utf-8"><title>Επιστροφή και αντικατάσταση · ${esc(title)}</title><style>
body{font-family:Arial,sans-serif;padding:28px;color:#17233a;font-size:12px}h1{font-size:18px;margin:0 0 4px}
.meta{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #cfd9e2;border-radius:6px;margin:12px 0 16px}.meta div{padding:8px 10px;border-right:1px solid #e1e8ee}.meta div:last-child{border-right:0}.meta span{display:block;font-size:10px;color:#5d6f80}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #cfd9e2;padding:6px 7px;text-align:left;vertical-align:top}th{background:#eef3f7;font-size:11px}small{display:block;color:#5d6f80;font-size:10px}
tr.expired td:nth-child(${departments.length>1?6:5}){color:#b42318;font-weight:700}tr.expiring td:nth-child(${departments.length>1?6:5}){color:#9a4d00;font-weight:700}td.fill{min-width:70px}
.signs{display:grid;grid-template-columns:repeat(2,1fr);gap:22px 32px;margin-top:28px}.sign span{font-weight:700}.sign .line{border-bottom:1px solid #17233a;height:34px}
.footer{margin-top:24px;font-size:10px;color:#6e7d8d}@media print{body{padding:0}}
</style></head><body>
<h1>Επιστροφή και αντικατάσταση φαρμάκων / υλικών</h1>
<div class="meta"><div><span>Έλεγχος</span><strong>${esc(title)}</strong></div><div><span>${departments.length>1?'Τμήματα':'Τμήμα'}</span><strong>${esc(departments.join(', ')||'—')}</strong></div><div><span>Ημερομηνία · Συντάκτης</span><strong>${esc(now.toLocaleDateString('el-GR'))} · ${esc(actorName||'')}</strong></div></div>
${items.length?`<table><thead><tr><th>#</th><th>Υλικό / Φάρμακο</th>${departments.length>1?'<th>Τμήμα</th>':''}<th>Παρτίδα</th><th>Λήξη</th><th>Κατάσταση</th><th>Ποσότητα</th><th>Προς επιστροφή</th><th>Αντικατάσταση</th><th>Παρατήρηση</th></tr></thead><tbody>${rows}</tbody></table>`:'<p>Δεν υπάρχουν ληγμένα ή κοντόληκτα υλικά.</p>'}
<div class="signs">${sign('Ο/Η συντάξας/ασα')}${sign('Προϊστάμενος/η τμήματος')}${sign('Φαρμακείο — Παραλαβή / Αντικατάσταση')}${sign('Διεύθυνση — Έγκριση')}</div>
<div class="footer">Limoxis Observer</div>
</body></html>`
}

export function printHtml(html){
 const w=window.open('','_blank','width=980,height=760')
 if(!w)return false
 w.document.open();w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),150);return true
}
