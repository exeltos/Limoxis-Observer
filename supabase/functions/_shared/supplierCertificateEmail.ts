function esc(value:unknown){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]||ch))}

type Certificate={type?:string,title?:string,number?:string,expiresOn?:string|null,reviewComment?:string|null}

// Some of a supplier's certificates have expired: the hospital asks for the renewed
// ones through one personal link (no account), listing each certificate to replace.
// kind 'reminder': the same link again, valid 14 more days. Greek first, with an
// English line. The single-certificate fields of the first version still render.
export function supplierCertificateRenewalEmail({organizationName='',supplierName='',certificates=[],kind='send',certificateType='',certificateTitle='',certificateNumber='',certificateExpiresOn=null,expiresAt=null,actionUrl=''}:{organizationName?:string,supplierName?:string,certificates?:Certificate[],kind?:string,certificateType?:string,certificateTitle?:string,certificateNumber?:string,certificateExpiresOn?:string|null,expiresAt?:string|null,actionUrl:string}){
  const day=(value:string|null|undefined)=>value?new Date(value).toLocaleDateString('el-GR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Athens'}):''
  const list:Certificate[]=certificates.length?certificates:[{type:certificateType,title:certificateTitle,number:certificateNumber,expiresOn:certificateExpiresOn}]
  const until=day(expiresAt)
  const hospital=organizationName||'Limoxis Observer'
  const reminder=kind==='reminder'
  const name=(item:Certificate)=>[item.type,item.title&&item.title!==item.type?item.title:''].filter(Boolean).join(' · ')||'—'
  const count=list.length
  const title=(reminder?'Υπενθύμιση: ':'')+(count===1?'Ανανέωση πιστοποιητικού':`Ανανέωση πιστοποιητικών (${count})`)
  const greeting=supplierName?`Προς: ${supplierName}`:''
  const intro=reminder
    ?`Δεν έχουμε λάβει ακόμη ${count===1?'το ανανεωμένο πιστοποιητικό':'τα ανανεωμένα πιστοποιητικά'} που ζητήσαμε. Ο σύνδεσμος παραμένει ο ίδιος και ισχύει για 14 ημέρες ακόμη.`
    :`${count===1?'Το παρακάτω πιστοποιητικό σας':`Τα παρακάτω ${count} πιστοποιητικά σας`} στο αρχείο προμηθευτών του ${hospital} ${count===1?'έχει λήξει ή λήγει σύντομα':'έχουν λήξει ή λήγουν σύντομα'}. Παρακαλούμε ανεβάστε ${count===1?'το ανανεωμένο':'το καθένα ανανεωμένο'} από τον σύνδεσμο· μπορείτε να στείλετε κάποια τώρα και τα υπόλοιπα αργότερα από τον ίδιο σύνδεσμο.`
  const english=reminder
    ?`English: a reminder from ${hospital}: please upload the renewed certificate${count===1?'':'s'} listed below using the same link, now valid 14 more days.`
    :`English: ${count===1?'a certificate':`${count} certificates`} on file with ${hospital} ${count===1?'has':'have'} expired. Please upload each renewed certificate using the link below; you may send some now and the rest later.`
  const button=count===1?'Ανέβασμα νέου πιστοποιητικού / Upload certificate':'Ανέβασμα νέων πιστοποιητικών / Upload certificates'
  const note=`Ο σύνδεσμος είναι προσωπικός και δεν χρειάζεται λογαριασμό${until?` (ισχύει έως ${until})`:''}. Μην τον προωθήσετε.`
  const rowsHtml=list.map((item,index)=>`<tr><td style="padding:10px 14px;border-top:${index?'1px solid #e3e9f0':'0'};line-height:1.5"><strong>${esc(name(item))}</strong>${item.number?`<br><span style="color:#596579;font-size:13px">Αριθμός: ${esc(item.number)}</span>`:''}${item.reviewComment?`<br><span style="color:#9a3412;font-size:13px">Σχόλιο νοσοκομείου: ${esc(item.reviewComment)}</span>`:''}</td><td align="right" style="padding:10px 14px;border-top:${index?'1px solid #e3e9f0':'0'};white-space:nowrap;color:#b42318;font-size:13px">${item.expiresOn?`Λήξη ${esc(day(item.expiresOn))}`:''}</td></tr>`).join('')
  const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><style>@media only screen and (max-width:640px){.lo-wrap{padding:12px 8px!important}.lo-card{border-radius:12px!important}.lo-head{padding:20px 18px!important}.lo-body{padding:22px 18px!important}.lo-btn{display:block!important;width:100%!important;box-sizing:border-box!important;text-align:center!important}}</style></head><body style="margin:0;background:#f4f7fa;font-family:Arial,Helvetica,sans-serif;color:#172033"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="lo-wrap" style="width:100%;padding:28px 12px;background:#f4f7fa"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="lo-card" style="width:100%;max-width:620px;background:#fff;border-radius:14px;border:1px solid #dfe6ee;overflow:hidden"><tr><td class="lo-head" style="padding:24px 28px;background:#0f3557;color:#fff"><div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.82">${esc(hospital)}</div><h1 style="margin:8px 0 0;font-size:22px;line-height:1.3">${esc(title)}</h1></td></tr><tr><td class="lo-body" style="padding:28px;word-break:break-word">${greeting?`<p style="margin:0 0 12px;font-size:16px">${esc(greeting)}</p>`:''}<p style="margin:0 0 20px;line-height:1.6">${esc(intro)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7f9fb;border-radius:10px">${rowsHtml}</table><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0 18px"><tr><td><a href="${esc(actionUrl)}" class="lo-btn" style="display:inline-block;background:#1565a8;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px">${esc(button)}</a></td></tr></table><p style="margin:0 0 12px;color:#596579;font-size:13px;line-height:1.55">${esc(note)}</p><p style="margin:0;color:#596579;font-size:13px;line-height:1.55">${esc(english)}</p></td></tr></table></td></tr></table></body></html>`
  const text=[title,greeting,intro,...list.map(item=>`- ${name(item)}${item.number?` · ${item.number}`:''}${item.expiresOn?` · λήξη ${day(item.expiresOn)}`:''}`),`${button}: ${actionUrl}`,note,english].filter(Boolean).join('\n')
  return {subject:`${title} · ${hospital}`,html,text}
}
