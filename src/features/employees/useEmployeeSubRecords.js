import { useCallback, useEffect, useState } from 'react'

export function useEmployeeSubRecords(loader, organizationId, employeeDbId, employeeId) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Whose rows are on hand: after a move to another employee the previous
  // employee's rows are never shown, not even for the frame before the read starts.
  const key = `${organizationId}|${employeeDbId}|${employeeId}`
  const [loadedKey, setLoadedKey] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await loader(organizationId, employeeDbId, employeeId)
      setData(rows || [])
      setLoadedKey(key)
      return rows || []
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [loader, organizationId, employeeDbId, employeeId, key])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loader(organizationId, employeeDbId, employeeId)
      .then(rows => { if (!cancelled) { setData(rows || []); setLoadedKey(key) } })
      .catch(err => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // employeeId (the frontend id) is included so a switch between two
    // employees' records reloads even when their dbId briefly matches.
  }, [loader, organizationId, employeeDbId, employeeId, key])

  const current = loadedKey === key
  return { data: current ? data : [], loading: loading || (!current && !error), error, reload, setData }
}
