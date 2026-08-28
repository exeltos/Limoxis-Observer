import { useAuth } from '../auth/AuthContext'
import { auditActorFromAuth } from './actor'

export function useAuditActor(){
  const {profile,user}=useAuth()
  return auditActorFromAuth({profile,user})
}
