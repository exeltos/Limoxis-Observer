function esc(value:unknown){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]||ch))}

function frame({title,greeting,body,button,actionUrl,tone='#0f6f7c'}:{title:string,greeting:string,body:string,button:string,actionUrl:string,tone?:string}){
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><style>@media only screen and (max-width:640px){.lo-wrap{padding:12px 8px!important}.lo-head{padding:20px 18px!important}.lo-body{padding:22px 18px!important}.lo-btn{display:block!important;width:100%!important;box-sizing:border-box!important;text-align:center!important}}</style></head><body style="margin:0;background:#f4f7fa;font-family:Arial,Helvetica,sans-serif;color:#172033"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="lo-wrap" style="width:100%;padding:28px 12px;background:#f4f7fa"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#fff;border-radius:14px;border:1px solid #dfe6ee;overflow:hidden"><tr><td class="lo-head" style="padding:24px 28px;background:#0f3557;color:#fff"><div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.82">Limoxis Observer · ${'Νομοθεσία'}</div><h1 style="margin:8px 0 0;font-size:21px;line-height:1.35">${esc(title)}</h1></td></tr><tr><td class="lo-body" style="padding:28px;word-break:break-word">${greeting?`<p style="margin:0 0 12px;font-size:16px">${esc(greeting)}</p>`:''}<div style="border-left:4px solid ${tone};background:#f7f9fb;border-radius:0 10px 10px 0;padding:14px 16px;line-height:1.6">${body}</div><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 0"><tr><td><a href="${esc(actionUrl)}" class="lo-btn" style="display:inline-block;background:#1565a8;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px">${esc(button)}</a></td></tr></table></td></tr></table></td></tr></table></body></html>`
}

// To a hospital's administrator and quality manager: a text was published or updated.
export function legislationUpdateEmail(p:Record<string,unknown>,actionUrl:string){
  const isNew=p.kind==='new'
  const title=`${isNew?'Νέα νομοθεσία':'Ενημέρωση νομοθεσίας'}: ${p.title||''}`
  const greeting=p.recipientName?`Καλησπέρα ${p.recipientName},`:''
  const lines=[
    `${p.code||''}${p.reference?` · ${p.reference}`:''}`,
    isNew?'Το κείμενο προστέθηκε στη βιβλιοθήκη νομοθεσίας. Ορίστε αν αφορά το νοσοκομείο και αξιολογήστε τη συμμόρφωση ανά απαίτηση.':`Έκδοση ${p.version}: ${Number(p.changed||0)} απαιτήσεις άλλαξαν ή προστέθηκαν. Οι απαιτήσεις αυτές μπαίνουν σε επανεξέταση συμμόρφωσης· όσα έχετε ήδη δηλώσει δεν αλλάζουν.`,
    p.changeNote?`Τι άλλαξε: ${p.changeNote}`:'',
    p.status==='repealed'?'Το κείμενο καταργήθηκε.':'',
  ].filter(Boolean)
  const body=lines.map(line=>`<p style="margin:0 0 6px">${esc(line)}</p>`).join('')
  return {subject:title,html:frame({title,greeting,body,button:'Άνοιγμα στο μητρώο νομοθεσίας',actionUrl}),text:[title,greeting,...lines,`Άνοιγμα: ${actionUrl}`].filter(Boolean).join('\n')}
}

// To the Platform Owner, in the morning: what the check found, and sources that stopped answering.
export function legislationDigestEmail(p:{items?:{title:string,url?:string,source?:string,matched?:string[]}[],failing?:{name:string,error?:string}[],recipientName?:string},actionUrl:string){
  const items=p.items||[],failing=p.failing||[]
  const title=items.length?`Νομοθεσία: ${items.length} ${items.length===1?'νέο κείμενο':'νέα κείμενα'} προς έλεγχο`:'Νομοθεσία: πηγές που δεν απαντούν'
  const greeting=p.recipientName?`Καλησπέρα ${p.recipientName},`:''
  const list=items.slice(0,30).map(item=>`<li style="margin:0 0 8px">${item.url?`<a href="${esc(item.url)}" style="color:#1565a8">${esc(item.title)}</a>`:esc(item.title)}<br><span style="color:#5b6b7f;font-size:13px">${esc(item.source||'')}${item.matched?.length?` · ${esc(item.matched.join(', '))}`:''}</span></li>`).join('')
  const fails=failing.map(item=>`<li style="margin:0 0 6px">${esc(item.name)}${item.error?` <span style="color:#5b6b7f;font-size:13px">(${esc(item.error)})</span>`:''}</li>`).join('')
  const body=[
    items.length?`<p style="margin:0 0 8px">Ο αυτόματος έλεγχος βρήκε τα παρακάτω. Τίποτα δεν φτάνει στα νοσοκομεία πριν το εγκρίνετε.</p><ul style="margin:0;padding-left:18px">${list}</ul>`:'',
    failing.length?`<p style="margin:${items.length?'14px':'0'} 0 8px">Δεν απαντούν δύο φορές στη σειρά, άρα δεν ελέγχονται:</p><ul style="margin:0;padding-left:18px">${fails}</ul>`:'',
  ].join('')
  const text=[title,greeting,...items.map(item=>`- ${item.title}${item.url?` ${item.url}`:''}`),...(failing.length?['Πηγές που δεν απαντούν:',...failing.map(item=>`- ${item.name}${item.error?` (${item.error})`:''}`)]:[]),`Άνοιγμα: ${actionUrl}`].filter(Boolean).join('\n')
  return {subject:title,html:frame({title,greeting,body,button:'Άνοιγμα «Προς έλεγχο»',actionUrl,tone:items.length?'#0f6f7c':'#b42318'}),text}
}
