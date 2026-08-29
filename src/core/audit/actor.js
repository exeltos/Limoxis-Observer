export function auditActorFromAuth({profile,user}={}){
  return {
    id: profile?.id || user?.id || 'unknown',
    name: profile?.fullName || user?.email || 'Άγνωστος χρήστης',
    email: profile?.email || user?.email || '',
  }
}

export function auditEvent(action,{actor,reason='',detail=null}={}){
  return {
    id:`AUD-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    at:new Date().toISOString(),
    action,
    actorId:actor?.id||'unknown',
    actor:actor?.name||'Άγνωστος χρήστης',
    actorEmail:actor?.email||'',
    reason:reason||null,
    detail,
  }
}


export function creationMetadata(actor,at=new Date().toISOString()){
  return {
    createdAt:at,
    createdBy:actor?.name||'Άγνωστος χρήστης',
    createdById:actor?.id||'unknown',
    updatedAt:at,
    updatedBy:actor?.name||'Άγνωστος χρήστης',
    updatedById:actor?.id||'unknown',
  }
}

export function updateMetadata(actor,at=new Date().toISOString()){
  return {
    updatedAt:at,
    updatedBy:actor?.name||'Άγνωστος χρήστης',
    updatedById:actor?.id||'unknown',
  }
}
