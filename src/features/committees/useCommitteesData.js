import { useCallback, useEffect, useState } from 'react'
import { useTenant } from '../../core/tenant/TenantContext'
import { loadCommitteesAsync } from './committeeService'

export function useCommitteesData() {
  const { tenant } = useTenant()
  const organizationId = tenant?.id ?? null
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const next = await loadCommitteesAsync(organizationId)
      setData(next)
      return next
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => { void reload().catch(() => {}) }, [reload])

  return { data, setData, loading, error, reload }
}
