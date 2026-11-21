import { useEffect, useState } from 'react'
import { useTenant } from '../../../core/tenant/TenantContext'
import { countSamplesAwaitingReview } from '../laboratoryCloudService'
import { createDemoLaboratoryRepository } from '../repositories/demoLaboratoryRepository'

// The administrator's «Δείγματα προς έλεγχο» figure: how many positive samples wait for a decision, counted from a
// light read (countSamplesAwaitingReview) instead of the whole worklist. undefined while it counts; null when it
// cannot be read (or takes longer than READ_LIMIT_MS), so the home leaves the figure out instead of loading forever.
const READ_LIMIT_MS = 20000
export function useSamplesAwaitingReviewCount({ enabled = true }: { enabled?: boolean } = {}) {
  const { isDemo, tenant } = useTenant()
  const [count, setCount] = useState<number | null | undefined>(enabled ? undefined : null)
  useEffect(() => {
    let active = true
    if (!enabled) { setCount(null); return () => { active = false } }
    setCount(undefined)
    let timer: ReturnType<typeof setTimeout> | undefined
    const limit = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('SAMPLES_AWAITING_REVIEW_TIMEOUT')), READ_LIMIT_MS) })
    const read = isDemo ? createDemoLaboratoryRepository().listAwaitingReview().then(rows => rows.length) : countSamplesAwaitingReview(tenant?.id)
    Promise.race([read, limit]).then(value => { if (active) setCount(value) }).catch(() => { if (active) setCount(null) }).finally(() => clearTimeout(timer))
    return () => { active = false; clearTimeout(timer) }
  }, [enabled, isDemo, tenant?.id])
  return count
}
