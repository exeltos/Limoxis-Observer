import { useCallback, useEffect, useState } from 'react'
import { useTenant } from '../../core/tenant/TenantContext'
import { cloudEnabled, loadEmployeesAsync } from './employeeService'
import { cachedEmployees } from './employeesCache'
import { isOwnerPreview } from '../../core/preview/ownerPreview'

export function useEmployeesData({ enabled = true } = {}) {
  const { tenant } = useTenant()
  const organizationId = tenant?.id ?? null
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)

  // The first read may come from the shared list (employeesCache.js); reload() reads again.
  const read = useCallback(async ({ fresh = true } = {}) => {
    setLoading(true); setError(null)
    try {
      const next = cloudEnabled() && organizationId && !isOwnerPreview()
        ? await cachedEmployees(organizationId, () => loadEmployeesAsync(organizationId), { fresh })
        : await loadEmployeesAsync(organizationId)
      setData(next)
      return next
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [organizationId])
  const reload = useCallback(() => read({ fresh: true }), [read])

  // enabled:false (the employee record in the cloud reads its own row) skips the register.
  useEffect(() => { if (enabled) void read({ fresh: false }).catch(() => {}) }, [enabled, read])

  return { data, setData, loading, error, reload }
}
