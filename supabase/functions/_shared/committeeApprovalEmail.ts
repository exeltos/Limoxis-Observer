function esc(value:unknown){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]||ch))}

export function committeeMinutesApprovalEmail({committeeName='',meetingTitle='',scheduledAt=null,actionUrl='',language='el'}:{committeeName?:string,meetingTitle?:string,scheduledAt?:string|null,actionUrl:string,language?:'el'|'en'}){
  const en=language==='en'
  const date=scheduledAt?new Date(scheduledAt).toLocaleDateString(en?'en-GB':'el-GR',{day:'2-digit',month:'2-digit',year:'numeric'}):''
  const title=en?'Minutes approval required':'Απαιτείται έγκριση πρακτικών'
  const intro=en?'Minutes have been submitted and require your review.':'Έχουν υποβληθεί πρακτικά συνεδρίασης και απαιτείται η έγκρισή σας.'
  const committeeLabel=en?'Committee':'Επιτροπή'
  const meetingLabel=en?'Meeting':'Συνεδρίαση'
  const dateLabel=en?'Date':'Ημερομηνία'
  const button=en?'Review minutes':'Προβολή πρακτικών'
  const security=en?'For security, approval or rejection is completed only after you sign in to Limoxis Observer.':'Για λόγους ασφάλειας, η έγκριση ή η απόρριψη ολοκληρώνεται μόνο αφού συνδεθείτε στο Limoxis Observer.'
  const html=`<!doctype html><html><body style="margin:0;background:#f4f7fa;font-family:Arial,sans-serif;color:#172033"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border-radius:14px;border:1px solid #dfe6ee;overflow:hidden"><tr><td style="padding:24px 28px;background:#0f3557;color:#fff"><div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.82">Limoxis Observer</div><h1 style="margin:8px 0 0;font-size:22px">${esc(title)}</h1></td></tr><tr><td style="padding:28px"><p style="margin:0 0 20px;line-height:1.6">${esc(intro)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f9fb;border-radius:10px"><tr><td style="padding:16px 18px;line-height:1.7"><strong>${esc(committeeLabel)}:</strong> ${esc(committeeName||'—')}<br><strong>${esc(meetingLabel)}:</strong> ${esc(meetingTitle||'—')}${date?`<br><strong>${esc(dateLabel)}:</strong> ${esc(date)}`:''}</td></tr></table><p style="margin:24px 0"><a href="${esc(actionUrl)}" style="display:inline-block;background:#1565a8;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px">${esc(button)}</a></p><p style="margin:0;color:#596579;font-size:13px;line-height:1.55">${esc(security)}</p></td></tr></table></td></tr></table></body></html>`
  const text=[title,intro,`${committeeLabel}: ${committeeName||'—'}`,`${meetingLabel}: ${meetingTitle||'—'}`,date?`${dateLabel}: ${date}`:'',`${button}: ${actionUrl}`,security].filter(Boolean).join('\n')
  return {subject:title,html,text}
}
