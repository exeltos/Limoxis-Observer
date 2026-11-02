import { useCallback, useEffect, useState } from 'react'
import { loadSelfAssessments } from './selfAssessmentService'

// The self-assessments the signed-in member may read: all of them for Quality, the
// released ones of their own departments for staff (the database decides).
export function useSelfAssessments(organizationId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const reload = useCallback(() => {
    setLoading(true)
    return loadSelfAssessments(organizationId).then(rows => { setItems(rows); setError(false) }).catch(failure => { console.error(failure); setItems([]); setError(true) }).finally(() => setLoading(false))
  }, [organizationId])
  useEffect(() => { void reload() }, [reload])
  return { items, loading, error, reload }
}
