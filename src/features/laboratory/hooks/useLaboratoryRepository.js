import { useMemo } from 'react'
import { useAuth } from '../../../core/auth/AuthContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { auditActorFromAuth } from '../../../core/audit/actor'
import { createDemoLaboratoryRepository } from '../repositories/demoLaboratoryRepository'
import { createSupabaseLaboratoryRepository } from '../repositories/supabaseLaboratoryRepository'

export function useLaboratoryRepository() {
  const { isDemo, tenant } = useTenant()
  const { profile, user } = useAuth()
  const actorName = auditActorFromAuth({ profile, user }).name

  return useMemo(() => (
    isDemo
      ? createDemoLaboratoryRepository({ actorName })
      : createSupabaseLaboratoryRepository({ organizationId: tenant?.id })
  ), [isDemo, tenant?.id, actorName])
}
