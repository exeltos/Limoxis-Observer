import type { AuthUser, Profile } from '../auth/authTypes'

// Ποιος έκανε μια ενέργεια, όπως γράφεται στο ιστορικό μιας εγγραφής.
export interface AuditActor {
  id: string
  name: string
  email?: string | null
}

export function auditActorFromAuth({profile,user}:{profile?:Partial<Profile>|null,user?:AuthUser|null}={}): AuditActor{
  return {
    id: profile?.id || user?.id || 'unknown',
    name: profile?.fullName || user?.email || 'Άγνωστος χρήστης',
    email: profile?.email || user?.email || '',
  }
}

export function auditEvent(action: string,{actor,reason='',detail=null}:{actor?:Partial<AuditActor>|null,reason?:string|null,detail?:unknown}={}){
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
