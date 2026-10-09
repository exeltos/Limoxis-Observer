function esc(value:unknown){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]||ch))}

// Lifecycle reminders: a Demo that is about to end (Platform Owner and the
// Demo's main user) and a hospital scheduled for deletion (Platform Owner).
export function lifecycleReminderEmail({kind='demo_expiry',audience='owner',days=7,name='',code='',date='',recipientName='',actionUrl='',language='el'}:{kind?:string,audience?:string,days?:number,name?:string,code?:string,date?:string,recipientName?:string,actionUrl:string,language?:'el'|'en'}){
  const en=language==='en'
  const day=date?new Date(`${String(date).slice(0,10)}T12:00:00Z`).toLocaleDateString(en?'en-GB':'el-GR',{day:'2-digit',month:'2-digit',year:'numeric'}):''
  const when=days<=0?(en?'today':'σήμερα'):days===1?(en?'tomorrow':'αύριο'):(en?`in ${days} days`:`σε ${days} ημέρες`)
  let title='',intro='',next='',button=''
  if(kind==='demo_expiry'&&audience==='evaluator'){
    title=en?`Your Demo ends ${when}`:`Το Demo σας λήγει ${when}`
    intro=en?`Access to the Limoxis Observer Demo “${name}” is valid until ${day}. After that date you will no longer be able to sign in to it.`:`Η πρόσβαση στο Demo του Limoxis Observer «${name}» ισχύει έως τις ${day}. Μετά από αυτή την ημερομηνία δεν θα μπορείτε να συνδεθείτε σε αυτό.`
    next=en?'If you would like more time or want to use Limoxis Observer in your hospital, press “I want the application” in the Demo bar, or reply to this e-mail.':'Αν χρειάζεστε περισσότερο χρόνο ή θέλετε να χρησιμοποιήσετε το Limoxis Observer στο νοσοκομείο σας, πατήστε «Θέλω την εφαρμογή» στη μπάρα του Demo ή απαντήστε σε αυτό το email.'
    button=en?'Open the Demo':'Άνοιγμα του Demo'
  }else if(kind==='demo_expiry'){
    title=en?`Demo “${name}” ends ${when}`:`Το Demo «${name}» λήγει ${when}`
    intro=en?`The Demo${code?` ${code}`:''} is valid until ${day}. Its main user has been notified too.`:`Το Demo${code?` ${code}`:''} ισχύει έως τις ${day}. Έχει ενημερωθεί και ο κύριος χρήστης του.`
    next=en?'You can extend it, convert it to a customer or let it end.':'Μπορείτε να το παρατείνετε, να το μετατρέψετε σε πελάτη ή να το αφήσετε να λήξει.'
    button=en?'Open the Demo record':'Άνοιγμα καρτέλας Demo'
  }else if(kind==='deletion_due'){
    title=en?`“${name}” reached its deletion date`:`Ο οργανισμός «${name}» έφτασε στην ημερομηνία διαγραφής`
    intro=en?`The grace period of ${name}${code?` (${code})`:''} ended on ${day}. Its users remain locked.`:`Η περίοδος χάριτος του οργανισμού ${name}${code?` (${code})`:''} έληξε στις ${day}. Οι χρήστες του παραμένουν κλειδωμένοι.`
    next=en?'The permanent deletion is not automatic: open the record to delete it permanently or to cancel the deletion.':'Η οριστική διαγραφή δεν γίνεται αυτόματα: ανοίξτε την καρτέλα για να τον διαγράψετε οριστικά ή να ακυρώσετε τη διαγραφή.'
    button=en?'Open “Export & deletion”':'Άνοιγμα «Αντίγραφο & διαγραφή»'
  }else{
    title=en?`“${name}” will be deleted ${when}`:`Ο οργανισμός «${name}» διαγράφεται ${when}`
    intro=en?`${name}${code?` (${code})`:''} is scheduled for permanent deletion on ${day}.`:`Ο οργανισμός ${name}${code?` (${code})`:''} είναι προγραμματισμένος για οριστική διαγραφή στις ${day}.`
    next=en?'Check that the export has been delivered. You can still cancel the deletion.':'Ελέγξτε ότι έχει παραδοθεί το αντίγραφο. Μπορείτε ακόμα να ακυρώσετε τη διαγραφή.'
    button=en?'Open “Export & deletion”':'Άνοιγμα «Αντίγραφο & διαγραφή»'
  }
  const greeting=recipientName?(en?`Hello ${recipientName},`:`Καλησπέρα ${recipientName},`):''
  const tone=kind==='demo_expiry'?'#0f6f7c':'#b42318'
  const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><style>@media only screen and (max-width:640px){.lo-wrap{padding:12px 8px!important}.lo-head{padding:20px 18px!important}.lo-body{padding:22px 18px!important}.lo-btn{display:block!important;width:100%!important;box-sizing:border-box!important;text-align:center!important}}</style></head><body style="margin:0;background:#f4f7fa;font-family:Arial,Helvetica,sans-serif;color:#172033"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="lo-wrap" style="width:100%;padding:28px 12px;background:#f4f7fa"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#fff;border-radius:14px;border:1px solid #dfe6ee;overflow:hidden"><tr><td class="lo-head" style="padding:24px 28px;background:#0f3557;color:#fff"><div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.82">Limoxis Observer</div><h1 style="margin:8px 0 0;font-size:21px;line-height:1.35">${esc(title)}</h1></td></tr><tr><td class="lo-body" style="padding:28px;word-break:break-word">${greeting?`<p style="margin:0 0 12px;font-size:16px">${esc(greeting)}</p>`:''}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-left:4px solid ${tone};background:#f7f9fb;border-radius:0 10px 10px 0"><tr><td style="padding:14px 16px;line-height:1.6">${esc(intro)}</td></tr></table><p style="margin:18px 0 0;line-height:1.6">${esc(next)}</p><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 0"><tr><td><a href="${esc(actionUrl)}" class="lo-btn" style="display:inline-block;background:#1565a8;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px">${esc(button)}</a></td></tr></table></td></tr></table></td></tr></table></body></html>`
  return {subject:title,html,text:[title,greeting,intro,next,`${button}: ${actionUrl}`].filter(Boolean).join('\n')}
}
