import { hospitalInitials } from './supplierCertificateEmail.ts'

// The e-mails of the bulk creation of accounts (N1), in the visual language of
// supplierCertificateEmail.ts: the hospital's badge and name in the header, a
// details table, numbered steps, one button (VML for Outlook), the hospital's
// general contact for help (also the Reply-To), a security note and a short
// English section. Table-based with inline styles (Gmail, Outlook, mobile).
//   accountCreatedEmail       «Δημιουργήθηκε λογαριασμός για εσάς στο <νοσοκομείο>»
//                             with the username and the «Ορισμός κωδικού» link (7 days, single use);
//   accountAccessAddedEmail   an existing account (another hospital) also gets a role
//                             here: no new password, the usual sign-in;
//   accountBatchSummaryEmail  the hospital's administrators: who got accounts, with which role.

function esc(value:unknown){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]||ch))}
const font="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const dayText=(value:string|null|undefined)=>value?new Date(value).toLocaleDateString('el-GR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Athens'}):''
const timeText=(value:string|null|undefined)=>value?new Date(value).toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Europe/Athens'}):''
const h2=(text:string)=>`<h2 style="margin:26px 0 10px;font-size:15px;line-height:1.4;color:#172b43;${font}">${esc(text)}</h2>`
const p=(html:string,extra='')=>`<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#182433;${extra}">${html}</p>`
const detailRow=(label:string,html:string,first:boolean)=>`<tr><td style="padding:11px 14px;border-top:${first?'0':'1px solid #e3e9f0'};font-size:13px;color:#606e80;width:150px;vertical-align:top">${esc(label)}</td><td style="padding:11px 14px;border-top:${first?'0':'1px solid #e3e9f0'};font-size:14px;color:#182433">${html}</td></tr>`
const detailsTable=(rows:[string,string][])=>`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 4px;border:1px solid #e3e9f0;border-radius:10px;background:#f8fafb">${rows.map(([label,html],index)=>detailRow(label,html,index===0)).join('')}</table>`
const stepsTable=(steps:string[])=>`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${steps.map((text,index)=>`<tr><td width="34" style="padding:0 0 12px;vertical-align:top"><div style="width:26px;height:26px;border-radius:13px;background:#edf5fa;color:#256b9b;font-weight:700;font-size:13px;line-height:26px;text-align:center">${index+1}</div></td><td style="padding:2px 0 12px;font-size:14px;line-height:1.55;color:#182433">${esc(text)}</td></tr>`).join('')}</table>`
const button=(label:string,url:string)=>`<table role="presentation" cellspacing="0" cellpadding="0" border="0" class="lo-btn-wrap" style="margin:22px 0 8px"><tr><td align="center" bgcolor="#256b9b" style="border-radius:10px;background:#256b9b"><!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${esc(url)}" style="height:48px;v-text-anchor:middle;width:260px" arcsize="20%" stroke="f" fillcolor="#256b9b"><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold">${esc(label)}</center></v:roundrect><![endif]--><!--[if !mso]><!--><a href="${esc(url)}" class="lo-btn" style="display:inline-block;padding:14px 28px;border-radius:10px;background:#256b9b;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;line-height:20px;${font}">${esc(label)} &rarr;</a><!--<![endif]--></td></tr></table>`
const note=(text:string)=>`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 18px;background:#edf5fa;border-radius:10px"><tr><td style="padding:11px 14px;font-size:13px;line-height:1.5;color:#356982">&#128274; ${esc(text)}</td></tr></table>`

function contact({hospital,email,phone}:{hospital:string,email:string,phone:string}){
  const text=email||phone?`${hospital}${email?` · ${email}`:''}${phone?` · τηλ. ${phone}`:''}`:`Επικοινωνήστε με το ${hospital}.`
  const html=email||phone?`${esc(hospital)}${email?` · <a href="mailto:${esc(email)}" style="color:#256b9b">${esc(email)}</a>`:''}${phone?` · τηλ. ${esc(phone)}`:''}`:esc(text)
  return {text,html}
}

function layout({subject,preheader,hospital,title,body,english,footerUrl}:{subject:string,preheader:string,hospital:string,title:string,body:string,english:string[],footerUrl?:string}){
  return `<!doctype html><html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(subject)}</title><style>@media only screen and (max-width:640px){.lo-wrap{padding:12px 8px!important}.lo-head,.lo-body,.lo-foot{padding-left:18px!important;padding-right:18px!important}.lo-hospital{font-size:19px!important}.lo-btn-wrap{width:100%!important}.lo-btn{display:block!important;text-align:center!important}}</style></head><body style="margin:0;padding:0;background:#f4f6f8;color:#182433;${font}"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f4f6f8;font-size:1px;line-height:1px">${esc(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="lo-wrap" bgcolor="#f4f6f8" style="width:100%;padding:28px 12px;background:#f4f6f8"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #dbe2e8;border-radius:14px;overflow:hidden"><tr><td style="height:5px;line-height:5px;font-size:0;background:#172b43">&nbsp;</td></tr><tr><td class="lo-head" style="padding:22px 32px 18px;border-bottom:1px solid #e3e9f0"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="56" style="vertical-align:middle;padding-right:14px"><div style="width:48px;height:48px;border-radius:12px;background:#172b43;color:#ffffff;font-weight:700;font-size:17px;line-height:48px;text-align:center;letter-spacing:.04em;${font}">${esc(hospitalInitials(hospital))}</div></td><td style="vertical-align:middle"><div class="lo-hospital" style="font-size:21px;font-weight:700;line-height:1.25;color:#172b43;${font}">${esc(hospital)}</div><div style="margin-top:3px;font-size:13px;color:#606e80">μέσω Limoxis Observer</div></td></tr></table></td></tr><tr><td class="lo-body" style="padding:26px 32px 8px;word-break:break-word"><h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#172b43;${font}">${esc(title)}</h1>${body}${p(`Με εκτίμηση,<br><strong>${esc(hospital)}</strong>`,'margin:0 0 22px')}</td></tr><tr><td class="lo-body" style="padding:18px 32px 22px;border-top:1px solid #e3e9f0;background:#f8fafb"><div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#606e80;margin:0 0 6px">English</div>${english.map(text=>`<p style="margin:0 0 8px;font-size:13px;line-height:1.55;color:#4a5868">${esc(text)}</p>`).join('')}</td></tr></table><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px"><tr><td class="lo-foot" style="padding:16px 32px;font-size:12px;line-height:1.55;color:#7a8696;text-align:center">Το μήνυμα στάλθηκε από το Limoxis Observer για λογαριασμό: ${esc(hospital)}.${footerUrl?`<br>Αν το κουμπί δεν ανοίγει, αντιγράψτε ολόκληρο τον σύνδεσμο: <a href="${esc(footerUrl)}" style="color:#256b9b;word-break:break-all">${esc(footerUrl)}</a>`:''}</td></tr></table></td></tr></table></body></html>`
}
const plain=(lines:string[])=>lines.filter((line,index,all)=>line!==''||all[index-1]!=='').join('\n')

type AccountEmail={organizationName?:string,organizationEmail?:string,organizationPhone?:string,recipientName?:string,username?:string,roleLabel?:string,departmentName?:string,expiresAt?:string|null,actionUrl:string,kind?:string}

export function accountCreatedEmail({organizationName='',organizationEmail='',organizationPhone='',recipientName='',username='',roleLabel='',departmentName='',expiresAt=null,actionUrl,kind='send'}:AccountEmail){
  const hospital=organizationName||'Limoxis Observer'
  const until=dayText(expiresAt),untilTime=timeText(expiresAt)
  const resend=kind==='resend'
  const subject=`${hospital} · Δημιουργήθηκε λογαριασμός για εσάς στο Limoxis Observer`
  const preheader=`Όνομα χρήστη ${username}. Ορίστε τον κωδικό σας${until?` έως ${until}`:''}.`
  const title='Δημιουργήθηκε λογαριασμός για εσάς'
  const greeting=recipientName?`Καλώς ήρθατε, ${recipientName}.`:'Καλώς ήρθατε.'
  const intro=`Δημιουργήθηκε για εσάς λογαριασμός στο Limoxis Observer στο ${hospital}. Είναι η πλατφόρμα που χρησιμοποιεί το νοσοκομείο για την πρόληψη και την επιτήρηση των λοιμώξεων και για την ποιότητα: επιτήρηση ασθενών, εργαστήριο, ελέγχους, δείκτες και εκπαίδευση, σε ένα σημείο.`
  const resendText='Σας στέλνουμε νέο σύνδεσμο. Ο προηγούμενος δεν ισχύει πλέον.'
  const role=[roleLabel,departmentName].filter(Boolean).join(' · ')
  const steps=[
    'Πατήστε «Ορισμός κωδικού». Ανοίγει η ασφαλής σελίδα ενεργοποίησης του Limoxis Observer.',
    'Ορίστε προσωπικό κωδικό (τουλάχιστον 12 χαρακτήρες, κεφαλαίο, πεζό, αριθμό και σύμβολο).',
    'Συνδεθείτε από το www.limoxis.com με το όνομα χρήστη σας και τον νέο κωδικό.',
  ]
  const deadline=`Ο σύνδεσμος ισχύει${until?` έως ${until}`:''} και χρησιμοποιείται μία φορά. Αν λήξει, ζητήστε νέο από το νοσοκομείο.`
  const help=contact({hospital,email:String(organizationEmail||'').trim(),phone:String(organizationPhone||'').trim()})
  const security='Ο σύνδεσμος είναι προσωπικός: μην τον προωθήσετε. Κανείς από το νοσοκομείο ή το Limoxis δεν θα σας ζητήσει ποτέ τον κωδικό σας. Αν δεν περιμένατε αυτό το email, ενημερώστε το νοσοκομείο.'
  const english=[`An account has been created for you in Limoxis Observer at ${hospital}, its infection-prevention and quality platform. Your username is ${username}. Use the «Ορισμός κωδικού» (Set password) button to choose your password; the link is personal, works once${until?` and is valid until ${until}`:''}.`]
  const body=[
    resend?`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;background:#fff6df;border:1px solid #f0dfae;border-radius:10px"><tr><td style="padding:12px 14px;font-size:14px;line-height:1.55;color:#5e4510"><strong style="color:#8a641d">Νέος σύνδεσμος</strong><br>${esc(resendText)}</td></tr></table>`:'',
    p(`<strong>${esc(greeting)}</strong>`),
    p(`Δημιουργήθηκε για εσάς λογαριασμός στο <strong>Limoxis Observer</strong> στο ${esc(hospital)}. Είναι η πλατφόρμα που χρησιμοποιεί το νοσοκομείο για την πρόληψη και την επιτήρηση των λοιμώξεων και για την ποιότητα: επιτήρηση ασθενών, εργαστήριο, ελέγχους, δείκτες και εκπαίδευση, σε ένα σημείο.`),
    detailsTable([
      ['Όνομα χρήστη',`<strong style="font-family:Consolas,Menlo,monospace;font-size:15px">${esc(username)}</strong>`],
      ...(role?[['Ρόλος',esc(role)] as [string,string]]:[]),
      ['Νοσοκομείο',esc(hospital)],
      ...(until?[['Ισχύει έως',`<strong style="color:#8a641d">${esc(until)}${untilTime?`, ${esc(untilTime)}`:''}</strong>`] as [string,string]]:[]),
    ]),
    h2('Πώς θα μπείτε'),stepsTable(steps),button('Ορισμός κωδικού',actionUrl),
    `<p style="margin:6px 0 0;font-size:14px;line-height:1.5;color:#182433"><strong>Προθεσμία:</strong> ${esc(deadline)}</p>`,
    h2('Χρειάζεστε βοήθεια;'),p(help.html),note(security),
  ].join('')
  const html=layout({subject,preheader,hospital,title,body,english,footerUrl:actionUrl})
  const text=plain([hospital,'μέσω Limoxis Observer','',title,'',resend?resendText:'',greeting,intro,'',`Όνομα χρήστη: ${username}`,role?`Ρόλος: ${role}`:'',`Νοσοκομείο: ${hospital}`,until?`Ισχύει έως: ${until}${untilTime?`, ${untilTime}`:''}`:'','','Πώς θα μπείτε:',...steps.map((step,index)=>`${index+1}. ${step}`),'',`Ορισμός κωδικού: ${actionUrl}`,deadline,'',`Βοήθεια: ${help.text}`,security,'','Με εκτίμηση,',hospital,'','English',...english])
  return {subject,html,text,replyTo:String(organizationEmail||'').trim()||undefined}
}

export function accountAccessAddedEmail({organizationName='',organizationEmail='',organizationPhone='',recipientName='',username='',roleLabel='',departmentName='',actionUrl}:AccountEmail){
  const hospital=organizationName||'Limoxis Observer'
  const subject=`${hospital} · Αποκτήσατε πρόσβαση και στο ${hospital}`
  const preheader=`Ο λογαριασμός σας ${username} έχει πλέον ρόλο και στο ${hospital}. Δεν χρειάζεται νέος κωδικός.`
  const title=`Αποκτήσατε πρόσβαση και στο ${hospital}`
  const greeting=recipientName?`Καλημέρα, ${recipientName}.`:'Καλημέρα.'
  const intro=`Ο λογαριασμός σας στο Limoxis Observer απέκτησε πρόσβαση και στο ${hospital}. Δεν δημιουργήθηκε νέος λογαριασμός και δεν χρειάζεται νέος κωδικός: συνδέεστε όπως πάντα, με το ίδιο όνομα χρήστη και τον κωδικό σας, και επιλέγετε το νοσοκομείο από τη λίστα σας.`
  const role=[roleLabel,departmentName].filter(Boolean).join(' · ')
  const help=contact({hospital,email:String(organizationEmail||'').trim(),phone:String(organizationPhone||'').trim()})
  const security='Αν δεν περιμένατε αυτή την αλλαγή, ενημερώστε το νοσοκομείο. Κανείς δεν θα σας ζητήσει ποτέ τον κωδικό σας.'
  const english=[`Your Limoxis Observer account (${username}) now also has access to ${hospital}. No new account or password: sign in as usual and choose the hospital from your list.`]
  const body=[
    p(`<strong>${esc(greeting)}</strong>`),p(esc(intro)),
    detailsTable([['Όνομα χρήστη',`<strong style="font-family:Consolas,Menlo,monospace;font-size:15px">${esc(username)}</strong>`],...(role?[['Ρόλος',esc(role)] as [string,string]]:[]),['Νοσοκομείο',esc(hospital)]]),
    button('Σύνδεση',actionUrl),h2('Χρειάζεστε βοήθεια;'),p(help.html),note(security),
  ].join('')
  const html=layout({subject,preheader,hospital,title,body,english,footerUrl:actionUrl})
  const text=plain([hospital,'μέσω Limoxis Observer','',title,'',greeting,intro,'',`Όνομα χρήστη: ${username}`,role?`Ρόλος: ${role}`:'',`Νοσοκομείο: ${hospital}`,'',`Σύνδεση: ${actionUrl}`,'',`Βοήθεια: ${help.text}`,security,'','Με εκτίμηση,',hospital,'','English',...english])
  return {subject,html,text,replyTo:String(organizationEmail||'').trim()||undefined}
}

type SummaryPerson={name?:string,roleLabel?:string,departmentName?:string,username?:string,outcome?:string}
const OUTCOME:Record<string,string>={created:'Δημιουργήθηκε · στάλθηκε',linked_existing:'Συνδέθηκε υπάρχων λογαριασμός',failed:'Απέτυχε'}

export function accountBatchSummaryEmail({organizationName='',recipientName='',createdAt=null,people=[],actionUrl}:{organizationName?:string,recipientName?:string,createdAt?:string|null,people?:SummaryPerson[],actionUrl:string}){
  const hospital=organizationName||'Limoxis Observer'
  const ok=people.filter(person=>person.outcome!=='failed'),failed=people.length-ok.length
  const when=[dayText(createdAt),timeText(createdAt)].filter(Boolean).join(', ')
  const subject=`${hospital} · Νέοι λογαριασμοί από το μητρώο εργαζομένων (${ok.length})`
  const preheader=`${ok.length} εργαζόμενοι απέκτησαν λογαριασμό${failed?`, ${failed} απέτυχαν`:''}.`
  const title='Νέοι λογαριασμοί από το μητρώο εργαζομένων'
  const greeting=recipientName?`Προς: ${recipientName}`:'Προς τη Διαχείριση του νοσοκομείου,'
  const intro=`Δημιουργήθηκαν${when?` στις ${when}`:''} λογαριασμοί στο Limoxis Observer για ${ok.length} εργαζόμενους του ${hospital}, από το μητρώο εργαζομένων${failed?` (${failed} δεν ολοκληρώθηκαν)`:''}. Ο καθένας έλαβε δικό του email με όνομα χρήστη και σύνδεσμο «Ορισμός κωδικού». Η ενέργεια καταγράφηκε στο Ιστορικό του νοσοκομείου.`
  const rowsHtml=people.map((person,index)=>`<tr><td style="padding:10px 14px;border-top:${index?'1px solid #e3e9f0':'0'};font-size:14px;line-height:1.45;color:#182433;vertical-align:top"><strong>${esc(person.name||'—')}</strong><br><span style="color:#606e80;font-size:13px">${esc([person.roleLabel,person.departmentName].filter(Boolean).join(' · ')||'—')}</span></td><td align="right" style="padding:10px 14px;border-top:${index?'1px solid #e3e9f0':'0'};font-size:13px;line-height:1.45;vertical-align:top;white-space:nowrap"><span style="font-family:Consolas,Menlo,monospace">${esc(person.username||'—')}</span><br><span style="color:${person.outcome==='failed'?'#a23f46':'#2f6f4d'};font-weight:700">${esc(OUTCOME[person.outcome||'']||person.outcome||'')}</span></td></tr>`).join('')
  const body=[
    p(`<strong>${esc(greeting)}</strong>`),p(esc(intro)),
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 4px;border:1px solid #e3e9f0;border-radius:10px;background:#f8fafb"><tr><td style="padding:9px 14px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#606e80;border-bottom:1px solid #e3e9f0">Εργαζόμενος · ρόλος</td><td align="right" style="padding:9px 14px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#606e80;border-bottom:1px solid #e3e9f0">Username</td></tr>${rowsHtml}</table>`,
    button('Χρήστες του νοσοκομείου',actionUrl),
  ].join('')
  const english=[`Limoxis Observer accounts were created for ${ok.length} employees of ${hospital} from the staff roster${failed?` (${failed} failed)`:''}. Each received a personal e-mail with a username and a set-password link. The action is recorded in the hospital's history.`]
  const html=layout({subject,preheader,hospital,title,body,english})
  const text=plain([hospital,'μέσω Limoxis Observer','',title,'',greeting,intro,'',...people.map(person=>`- ${person.name||'—'} · ${[person.roleLabel,person.departmentName].filter(Boolean).join(' · ')||'—'} · ${person.username||'—'} · ${OUTCOME[person.outcome||'']||person.outcome||''}`),'',`Χρήστες του νοσοκομείου: ${actionUrl}`,'','Με εκτίμηση,',hospital,'','English',...english])
  return {subject,html,text}
}
