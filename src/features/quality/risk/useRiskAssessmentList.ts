import { useCallback, useEffect, useState } from 'react'
import { loadRiskAssessments } from './riskService'
import type { AnyRecord } from '../../../types/featureTypes'

// The organization's assessments, shared by the Quality Center's summary strip and the list.
export function useRiskAssessmentList(organizationId: string | null | undefined, enabled = true) {
  const [items, setItems] = useState<AnyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    if (!enabled) return undefined
    let active = true
    setLoading(true)
    loadRiskAssessments(organizationId).then((rows) => { if (active) setItems(rows) }).catch(() => { if (active) setItems([]) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [organizationId, enabled, version])
  const reload = useCallback(() => setVersion((n) => n + 1), [])
  return { items, loading, reload }
}
