import { useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { auditActorFromAuth } from './actor'

export function useAuditActor(){
  const {profile,user}=useAuth()
  return useMemo(()=>auditActorFromAuth({profile,user}),[profile,user])
}
