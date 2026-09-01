import { useEffect, useState } from 'react'

export function useEmployeeSubRecords(loader, organizationId, employeeDbId, employeeId) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    loader(organizationId, employeeDbId, employeeId)
      .then(rows => { if (!cancelled) setData(rows) })
      .catch(err => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // employeeId (the frontend id) is included so a switch between two
    // employees' records reloads even when their dbId briefly matches
    // (e.g. both undefined for two different local/demo rows).
  }, [loader, organizationId, employeeDbId, employeeId])

  return { data, loading, error }
}
