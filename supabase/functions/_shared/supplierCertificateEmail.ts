function esc(value:unknown){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]||ch))}

type Certificate={type?:string,title?:string,number?:string,expiresOn?:string|null,reviewComment?:string|null}

// The hospital's initials for the badge of the e-mail header (no public logo URL:
// the logo of organizations.branding is a data URL, which Gmail and Outlook drop).
export function hospitalInitials(name:string){
  const skip=new Set(['και','του','της','των','το','η','ο','of','the','and'])
  const words=String(name||'').replace(/\([^)]*\)/g,' ').normalize('NFD').replace(/[̀-ͯ]/g,'').split(/[^\p{L}\p{N}]+/u).filter(word=>word&&!skip.has(word.toLowerCase()))
  return (words.slice(0,3).map(word=>word[0]).join('')||'LO').toLocaleUpperCase('el')
}

// Some of a supplier's certificates have expired or expire soon: the hospital's
// Quality Office asks, through Limoxis Observer, for the renewed ones through one
// personal link (no account), listing each certificate. The e-mail says who writes,
// why, what is asked, how (three steps), until when, what happens next and whom to
// ask; Greek first, a short English section below. kind 'reminder': the same link
// again, valid 14 more days, with a banner and the days since the first e-mail.
// Table-based with inline styles (Gmail, Outlook). The single-certificate fields of
// the first version still render.
export function supplierCertificateRenewalEmail({organizationName='',organizationEmail='',organizationPhone='',supplierName='',certificates=[],kind='send',certificateType='',certificateTitle='',certificateNumber='',certificateExpiresOn=null,expiresAt=null,firstSentAt=null,actionUrl='',now=new Date()}:{organizationName?:string,organizationEmail?:string,organizationPhone?:string,supplierName?:string,certificates?:Certificate[],kind?:string,certificateType?:string,certificateTitle?:string,certificateNumber?:string,certificateExpiresOn?:string|null,expiresAt?:string|null,firstSentAt?:string|null,actionUrl:string,now?:Date}){
  const day=(value:string|null|undefined)=>value?new Date(String(value).length===10?`${value}T12:00:00Z`:value).toLocaleDateString('el-GR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Athens'}):''
  const list:Certificate[]=certificates.length?certificates:[{type:certificateType,title:certificateTitle,number:certificateNumber,expiresOn:certificateExpiresOn}]
  const until=day(expiresAt)
  const hospital=organizationName||'Limoxis Observer'
  const reminder=kind==='reminder'
  const today=now.toISOString().slice(0,10)
  const expired=(item:Certificate)=>Boolean(item.expiresOn)&&String(item.expiresOn).slice(0,10)<=today
  const name=(item:Certificate)=>[item.type,item.title&&item.title!==item.type?item.title:''].filter(Boolean).join(' · ')||'—'
  const count=list.length
  const one=count===1
  const sinceDays=reminder&&firstSentAt?Math.max(1,Math.floor((now.getTime()-new Date(firstSentAt).getTime())/86400000)):null
  const contactEmail=String(organizationEmail||'').trim()
  const contactPhone=String(organizationPhone||'').trim()
  const title=one?'Ανανέωση πιστοποιητικού προμηθευτή':'Ανανέωση πιστοποιητικών προμηθευτή'
  const subject=`${reminder?'Υπενθύμιση · ':''}${hospital} · Ανανέωση πιστοποιητικών προμηθευτή (${count})`
  const preheader=reminder
    ?`Υπενθύμιση από: ${hospital}. Περιμένουμε ακόμη ${one?'το ανανεωμένο πιστοποιητικό':`${count} ανανεωμένα πιστοποιητικά`}${until?`, ο σύνδεσμος ισχύει έως ${until}`:''}.`
    :`${hospital}: το Γραφείο Ποιότητας ζητά ${one?'το ανανεωμένο πιστοποιητικό':`${count} ανανεωμένα πιστοποιητικά`} σας${until?`, έως ${until}`:''}.`
  const greeting=supplierName?`Προς: ${supplierName}`:'Αγαπητέ συνεργάτη,'
  const who=`Σας γράφει το Γραφείο Ποιότητας του νοσοκομείου «${hospital}» μέσω της πλατφόρμας Limoxis Observer.`
  const why=`Το νοσοκομείο τηρεί στο αρχείο του τα πιστοποιητικά των προμηθευτών του, όπως απαιτεί το σύστημα διαχείρισης ποιότητας και ασφάλειας τροφίμων (π.χ. ISO 22000 / HACCP) και η αξιολόγηση προμηθευτών. ${one?'Το παρακάτω πιστοποιητικό σας έχει λήξει ή λήγει σύντομα':`Τα παρακάτω ${count} πιστοποιητικά σας έχουν λήξει ή λήγουν σύντομα`}.`
  const ask=one?'Σας παρακαλούμε να ανεβάσετε το ανανεωμένο πιστοποιητικό.':'Σας παρακαλούμε να ανεβάσετε το ανανεωμένο πιστοποιητικό για το καθένα.'
  const banner=reminder?(sinceDays?`Σας στείλαμε το πρώτο email πριν από ${sinceDays} ${sinceDays===1?'ημέρα':'ημέρες'} και δεν έχουμε λάβει ακόμη ${one?'το ανανεωμένο πιστοποιητικό':'όλα τα ανανεωμένα πιστοποιητικά'}. Ο σύνδεσμος είναι ο ίδιος και ισχύει 14 ημέρες ακόμη.`:`Δεν έχουμε λάβει ακόμη ${one?'το ανανεωμένο πιστοποιητικό':'όλα τα ανανεωμένα πιστοποιητικά'}. Ο σύνδεσμος είναι ο ίδιος και ισχύει 14 ημέρες ακόμη.`):''
  const steps=[
    'Πατήστε το κουμπί «Ανέβασμα πιστοποιητικών» παρακάτω. Ανοίγει μια ασφαλής σελίδα με τα πιστοποιητικά που ζητάμε.',
    'Για κάθε πιστοποιητικό συμπληρώστε αριθμό, φορέα έκδοσης και ημερομηνίες, και επισυνάψτε το αρχείο (PDF ή εικόνα, έως 10 MB).',
    'Πατήστε «Υποβολή». Μπορείτε να στείλετε κάποια τώρα και τα υπόλοιπα αργότερα από τον ίδιο σύνδεσμο.',
  ]
  const deadline=until?`Ο σύνδεσμος ισχύει έως ${until}.`:''
  const next='Το Γραφείο Ποιότητας θα ελέγξει όσα στείλετε. Αν κάτι χρειάζεται διόρθωση, θα σας ζητηθεί ξανά από τον ίδιο σύνδεσμο με σχετικό σχόλιο.'
  const contactText=contactEmail||contactPhone?`Για απορίες: Γραφείο Ποιότητας, ${hospital}${contactEmail?` · ${contactEmail}`:''}${contactPhone?` · τηλ. ${contactPhone}`:''}`:'Για απορίες επικοινωνήστε με το Γραφείο Ποιότητας του νοσοκομείου.'
  const security='Ο σύνδεσμος είναι προσωπικός: μην τον προωθήσετε. Δεν χρειάζεται λογαριασμός ή κωδικός.'
  const english=[
    `The Quality Office of ${hospital} is writing to you via Limoxis Observer. The hospital keeps its suppliers' certificates on file, as its quality and food-safety system (e.g. ISO 22000 / HACCP) requires. ${one?'The certificate below has':`The ${count} certificates below have`} expired or will expire soon.`,
    `Please open the link, fill in number, issuer and dates for each certificate, attach the file (PDF or image, up to 10 MB) and submit. You may send some now and the rest later${until?`; the link is valid until ${until}`:''}. It is personal: do not forward it. No account or password is needed.`,
  ]
  const button=one?'Ανέβασμα πιστοποιητικού':'Ανέβασμα πιστοποιητικών'
  const font="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
  const h2=(text:string)=>`<h2 style="margin:26px 0 10px;font-size:15px;line-height:1.4;color:#172b43;${font}">${esc(text)}</h2>`
  const p=(text:string,extra='')=>`<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#182433;${extra}">${text}</p>`
  const pill=(item:Certificate)=>expired(item)
    ?'<span style="display:inline-block;padding:2px 9px;border-radius:999px;background:#fff0f0;border:1px solid #efcfd2;color:#a23f46;font-size:12px;font-weight:700;line-height:18px">Έληξε</span>'
    :'<span style="display:inline-block;padding:2px 9px;border-radius:999px;background:#fff6df;border:1px solid #f0dfae;color:#8a641d;font-size:12px;font-weight:700;line-height:18px">Λήγει</span>'
  const rowsHtml=list.map((item,index)=>`<tr><td style="padding:12px 14px;border-top:${index?'1px solid #e3e9f0':'0'};vertical-align:top;font-size:14px;line-height:1.5;color:#182433"><strong>${esc(name(item))}</strong>${item.number?`<br><span style="color:#606e80;font-size:13px">Αριθμός: ${esc(item.number)}</span>`:''}${item.reviewComment?`<br><span style="color:#8a4a12;font-size:13px">Σχόλιο Γραφείου Ποιότητας: ${esc(item.reviewComment)}</span>`:''}</td><td align="right" class="lo-date" style="padding:12px 14px;border-top:${index?'1px solid #e3e9f0':'0'};vertical-align:top;white-space:nowrap;font-size:13px;line-height:1.5"><span style="color:${expired(item)?'#a23f46':'#8a641d'};font-weight:700">${item.expiresOn?esc(day(item.expiresOn)):'—'}</span><br>${pill(item)}</td></tr>`).join('')
  const stepsHtml=steps.map((text,index)=>`<tr><td width="34" style="padding:0 0 12px;vertical-align:top"><div style="width:26px;height:26px;border-radius:13px;background:#edf5fa;color:#256b9b;font-weight:700;font-size:13px;line-height:26px;text-align:center">${index+1}</div></td><td style="padding:2px 0 12px;font-size:14px;line-height:1.55;color:#182433">${esc(text)}</td></tr>`).join('')
  const contactHtml=contactEmail||contactPhone
    ?`Για απορίες: Γραφείο Ποιότητας, ${esc(hospital)}${contactEmail?` · <a href="mailto:${esc(contactEmail)}" style="color:#256b9b">${esc(contactEmail)}</a>`:''}${contactPhone?` · τηλ. ${esc(contactPhone)}`:''}`
    :esc(contactText)
  const buttonHtml=`<table role="presentation" cellspacing="0" cellpadding="0" border="0" class="lo-btn-wrap" style="margin:22px 0 8px"><tr><td align="center" bgcolor="#256b9b" style="border-radius:10px;background:#256b9b"><!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${esc(actionUrl)}" style="height:48px;v-text-anchor:middle;width:300px" arcsize="20%" stroke="f" fillcolor="#256b9b"><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold">${esc(button)}</center></v:roundrect><![endif]--><!--[if !mso]><!--><a href="${esc(actionUrl)}" class="lo-btn" style="display:inline-block;padding:14px 28px;border-radius:10px;background:#256b9b;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;line-height:20px;${font}">${esc(button)} &rarr;</a><!--<![endif]--></td></tr></table>`
  const html=`<!doctype html><html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(subject)}</title><style>@media only screen and (max-width:640px){.lo-wrap{padding:12px 8px!important}.lo-head,.lo-body,.lo-foot{padding-left:18px!important;padding-right:18px!important}.lo-hospital{font-size:19px!important}.lo-btn-wrap{width:100%!important}.lo-btn{display:block!important;text-align:center!important}}</style></head><body style="margin:0;padding:0;background:#f4f6f8;color:#182433;${font}"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f4f6f8;font-size:1px;line-height:1px">${esc(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="lo-wrap" bgcolor="#f4f6f8" style="width:100%;padding:28px 12px;background:#f4f6f8"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #dbe2e8;border-radius:14px;overflow:hidden"><tr><td style="height:5px;line-height:5px;font-size:0;background:#172b43">&nbsp;</td></tr><tr><td class="lo-head" style="padding:22px 32px 18px;border-bottom:1px solid #e3e9f0"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="56" style="vertical-align:middle;padding-right:14px"><div style="width:48px;height:48px;border-radius:12px;background:#172b43;color:#ffffff;font-weight:700;font-size:17px;line-height:48px;text-align:center;letter-spacing:.04em;${font}">${esc(hospitalInitials(hospital))}</div></td><td style="vertical-align:middle"><div class="lo-hospital" style="font-size:21px;font-weight:700;line-height:1.25;color:#172b43;${font}">${esc(hospital)}</div><div style="margin-top:3px;font-size:13px;color:#606e80">Γραφείο Ποιότητας · μέσω Limoxis Observer</div></td></tr></table></td></tr><tr><td class="lo-body" style="padding:26px 32px 8px;word-break:break-word">${reminder?`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;background:#fff6df;border:1px solid #f0dfae;border-radius:10px"><tr><td style="padding:12px 14px;font-size:14px;line-height:1.55;color:#5e4510"><strong style="color:#8a641d">Υπενθύμιση</strong><br>${esc(banner)}</td></tr></table>`:''}<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#172b43;${font}">${esc(title)}</h1>${p(`<strong>${esc(greeting)}</strong>`)}${p(esc(who))}${p(esc(why))}${p(esc(ask))}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 4px;border:1px solid #e3e9f0;border-radius:10px;background:#f8fafb"><tr><td style="padding:9px 14px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#606e80;border-bottom:1px solid #e3e9f0">Πιστοποιητικό</td><td align="right" style="padding:9px 14px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#606e80;border-bottom:1px solid #e3e9f0">Λήξη</td></tr>${rowsHtml}</table>${h2('Πώς θα τα στείλετε')}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${stepsHtml}</table>${buttonHtml}${deadline?`<p style="margin:6px 0 0;font-size:14px;line-height:1.5;color:#182433"><strong>Προθεσμία:</strong> ${esc(deadline)}</p>`:''}${h2('Τι γίνεται μετά')}${p(esc(next))}${p(contactHtml)}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 18px;background:#edf5fa;border-radius:10px"><tr><td style="padding:11px 14px;font-size:13px;line-height:1.5;color:#356982">&#128274; ${esc(security)}</td></tr></table>${p(`Με εκτίμηση,<br>Γραφείο Ποιότητας<br><strong>${esc(hospital)}</strong>`,'margin:0 0 22px')}</td></tr><tr><td class="lo-body" style="padding:18px 32px 22px;border-top:1px solid #e3e9f0;background:#f8fafb"><div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#606e80;margin:0 0 6px">English</div>${english.map(text=>`<p style="margin:0 0 8px;font-size:13px;line-height:1.55;color:#4a5868">${esc(text)}</p>`).join('')}</td></tr></table><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px"><tr><td class="lo-foot" style="padding:16px 32px;font-size:12px;line-height:1.55;color:#7a8696;text-align:center">Το μήνυμα στάλθηκε από το Limoxis Observer για λογαριασμό του νοσοκομείου «${esc(hospital)}».<br>Αν το κουμπί δεν ανοίγει, αντιγράψτε ολόκληρο τον σύνδεσμο: <a href="${esc(actionUrl)}" style="color:#256b9b;word-break:break-all">${esc(actionUrl)}</a></td></tr></table></td></tr></table></body></html>`
  const text=[
    hospital,'Γραφείο Ποιότητας · μέσω Limoxis Observer','',
    reminder?`ΥΠΕΝΘΥΜΙΣΗ: ${banner}`:'',
    title,'',greeting,who,why,ask,'',
    ...list.map(item=>`- ${name(item)}${item.number?` · αρ. ${item.number}`:''}${item.expiresOn?` · ${expired(item)?'έληξε':'λήγει'} ${day(item.expiresOn)}`:''}${item.reviewComment?` · σχόλιο: ${item.reviewComment}`:''}`),'',
    'Πώς θα τα στείλετε:',...steps.map((step,index)=>`${index+1}. ${step}`),'',
    `${button}: ${actionUrl}`,deadline,'',next,contactText,security,'',
    'Με εκτίμηση,','Γραφείο Ποιότητας',hospital,'','English',...english,
  ].filter((line,index,all)=>line!==''||all[index-1]!=='').join('\n')
  return {subject,html,text,replyTo:contactEmail||undefined}
}

// To the Platform Owner: suppliers have submitted renewed certificates, waiting for the
// Quality Office's review (sent by the nightly check, once per certificate).
export function supplierCertificateSubmittedEmail({organizationName='',certificates=[],actionUrl=''}:{organizationName?:string,certificates?:{supplier?:string,type?:string,number?:string,expiresOn?:string|null}[],actionUrl?:string}){
  const day=(value:string|null|undefined)=>value?new Date(`${String(value).slice(0,10)}T12:00:00Z`).toLocaleDateString('el-GR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Athens'}):''
  const hospital=organizationName||'Limoxis Observer'
  const count=certificates.length
  const subject=`Νέα πιστοποιητικά προμηθευτών (${count}) · ${hospital}`
  const line=(item:{supplier?:string,type?:string,number?:string,expiresOn?:string|null})=>[item.supplier||'—',[item.type,item.number].filter(Boolean).join(' · '),item.expiresOn?`λήξη ${day(item.expiresOn)}`:''].filter(Boolean).join(' — ')
  const rows=certificates.map(item=>`<li style="margin:0 0 6px">${esc(line(item))}</li>`).join('')
  const html=`<!doctype html><html lang="el"><head><meta charset="utf-8"><title>${esc(subject)}</title></head><body style="margin:0;padding:24px;background:#f4f7fa;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#182433"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e3e9f0;border-radius:12px;padding:24px"><h1 style="margin:0 0 12px;font-size:18px;color:#172b43">Νέα πιστοποιητικά προμηθευτών</h1><p style="margin:0 0 12px;font-size:15px;line-height:1.6">${esc(hospital)}: προμηθευτές υπέβαλαν ${count===1?'1 ανανεωμένο πιστοποιητικό':`${count} ανανεωμένα πιστοποιητικά`}, που περιμένουν έλεγχο.</p><ul style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.5">${rows}</ul>${actionUrl?`<p style="margin:0"><a href="${esc(actionUrl)}" style="display:inline-block;padding:10px 18px;border-radius:10px;background:#256b9b;color:#fff;text-decoration:none;font-weight:600">Έλεγχος υποβολών</a></p>`:''}</div></body></html>`
  const text=[`${hospital}: ${count===1?'1 ανανεωμένο πιστοποιητικό':`${count} ανανεωμένα πιστοποιητικά`} προμηθευτών περιμένουν έλεγχο.`,'',...certificates.map(item=>`- ${line(item)}`),'',actionUrl?`Έλεγχος υποβολών: ${actionUrl}`:''].join('\n')
  return {subject,html,text}
}
