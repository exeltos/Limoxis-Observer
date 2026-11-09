// Shared by the Overview, the Organizations list and the organization record (Platform Owner):
// the initials avatar, «πριν από …» times, the one status of an organization and the latest sign-in per user.

// Two letters per organization: an abbreviation (Γ.Ν.) counts as one word, so «Γ.Ν. Κομοτηνής» is ΓΚ.
export const initialsOf=name=>String(name||'').split(/\s+/).map(word=>word.replace(/[^\p{L}]/gu,'')).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toLocaleUpperCase('el-GR')||'—'

export const sinceText=(value,tx)=>{if(!value)return tx('Καμία καταγραφή','No activity recorded');const minutes=Math.max(0,Math.round((Date.now()-new Date(value).getTime())/60000));if(minutes<1)return tx('μόλις τώρα','just now');if(minutes<60)return tx(`πριν από ${minutes} λεπτά`,`${minutes} min ago`);const hours=Math.round(minutes/60);if(hours<24)return tx(`πριν από ${hours} ώρες`,`${hours} h ago`);const days=Math.round(hours/24);if(days===1)return tx('χθες','yesterday');return tx(`πριν από ${days} ημέρες`,`${days} days ago`)}

// [tone, label, key]: one status per organization (deletion, pause, inactive, admin pending, active).
export function statusOf(tx,organization,adminStatus){
  if(organization.deletion_scheduled_at)return ['danger',tx('Προς διαγραφή','Deletion scheduled'),'deletion']
  if(organization.status==='suspended'||organization.paused_at)return ['danger',tx('Σε παύση','Paused'),'paused']
  if(organization.status!=='active')return ['neutral',tx('Ανενεργός','Inactive'),'inactive']
  if(adminStatus==='invited')return ['warning',tx('Εκκρεμεί διαχειριστής','Admin pending'),'pending']
  return ['success',tx('Ενεργός','Active'),'active']
}

// The latest sign-in (session start) of each user, from listLoginSessions.
export function latestSessionByUser(sessions=[]){
  const latest=new Map()
  for(const row of sessions){if(!row?.userId)continue;const current=latest.get(row.userId);if(!current||String(row.startedAt||'')>String(current.startedAt||''))latest.set(row.userId,row)}
  return latest
}
