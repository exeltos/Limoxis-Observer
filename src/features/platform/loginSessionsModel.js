// Sign-ins (Ιστορικό & Υγεία › Συνδέσεις): device, duration and status of a session, in words.

// «Chrome · Windows», «Safari · iPhone» from the browser's user agent.
export function deviceLabel(userAgent,en=false){
  const ua=String(userAgent||'')
  if(!ua)return en?'Unknown':'Άγνωστη'
  const browser=/Edg\//.test(ua)?'Edge':/OPR\/|Opera/.test(ua)?'Opera':/Firefox\//.test(ua)?'Firefox':/Chrome\/|CriOS\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':/Deno|node|undici|supabase/i.test(ua)?(en?'App service':'Υπηρεσία εφαρμογής'):(en?'Browser':'Φυλλομετρητής')
  const system=/iPhone/.test(ua)?'iPhone':/iPad/.test(ua)?'iPad':/Android/.test(ua)?'Android':/Windows/.test(ua)?'Windows':/Mac OS X|Macintosh/.test(ua)?'Mac':/Linux/.test(ua)?'Linux':''
  return system?`${browser} · ${system}`:browser
}

// From the sign-in to the end (or to the last activity while it is still open).
export function durationText(row,now=Date.now(),en=false){
  const start=new Date(row?.startedAt).getTime()
  const endValue=row?.endedAt||(row?.online?new Date(now).toISOString():row?.lastSeenAt)
  const end=new Date(endValue).getTime()
  if(!Number.isFinite(start)||!Number.isFinite(end))return '—'
  const minutes=Math.max(0,Math.round((end-start)/60000))
  if(minutes<1)return en?'< 1 min':'< 1 λεπτό'
  if(minutes<60)return en?`${minutes} min`:`${minutes} λεπτά`
  const hours=Math.floor(minutes/60),rest=minutes%60
  if(hours<48)return en?`${hours} h${rest?` ${rest} min`:''}`:`${hours} ώρ${hours===1?'α':'ες'}${rest?` ${rest}′`:''}`
  const days=Math.round(hours/24)
  return en?`${days} days`:`${days} ημέρες`
}

export function sessionStatus(row,en=false){
  if(row?.online)return {tone:'good',label:en?'Online now':'Συνδεδεμένος τώρα'}
  if(row?.active)return {tone:'neutral',label:en?'Open (idle)':'Ανοιχτή (αδράνεια)'}
  if(row?.endedReason==='ended_by_owner')return {tone:'danger',label:en?'Ended by the Owner':'Τερματίστηκε από τον Ιδιοκτήτη'}
  if(row?.endedReason==='signed_out')return {tone:'muted',label:en?'Signed out':'Αποσυνδέθηκε'}
  return {tone:'muted',label:en?'Expired':'Έληξε'}
}
