import { useCallback, useEffect, useState } from 'react'

export function useEmployeeSubRecords(loader, organizationId, employeeDbId, employeeId) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await loader(organizationId, employeeDbId, employeeId)
      setData(rows || [])
      return rows || []
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [loader, organizationId, employeeDbId, employeeId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loader(organizationId, employeeDbId, employeeId)
      .then(rows => { if (!cancelled) setData(rows || []) })
      .catch(err => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // employeeId (the frontend id) is included so a switch between two
    // employees' records reloads even when their dbId briefly matches.
  }, [loader, organizationId, employeeDbId, employeeId])

  return { data, loading, error, reload, setData }
}
