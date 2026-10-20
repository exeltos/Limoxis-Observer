import { useCallback, useEffect, useState } from 'react'
import { useTenant } from '../../core/tenant/TenantContext'
import { loadCommitteeRecordAsync, loadCommitteesAsync } from './committeeService'

// With a committee code, only that committee is read (with every attendance
// and decision row); without one, the list with its counts.
export function useCommitteesData(committeeCode = null) {
  const { tenant } = useTenant()
  const organizationId = tenant?.id ?? null
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const next = committeeCode ? await loadCommitteeRecordAsync(organizationId, committeeCode) : await loadCommitteesAsync(organizationId)
      setData(next)
      return next
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [organizationId, committeeCode])

  useEffect(() => { void reload().catch(() => {}) }, [reload])

  return { data, setData, loading, error, reload }
}
