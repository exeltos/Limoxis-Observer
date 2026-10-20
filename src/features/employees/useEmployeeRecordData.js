import { useCallback, useEffect, useRef, useState } from 'react'
import { useTenant } from '../../core/tenant/TenantContext'
import { isOwnerPreview } from '../../core/preview/ownerPreview'
import { cloudEnabled, loadEmployeeRecordAsync, loadSelfEmployeeCandidatesAsync } from './employeeService'
import { useEmployeesData } from './useEmployeesData'

// The employee record reads its own employee, not the whole register: by code
// (/employees/:code) or, for "My profile", the few rows that can be the
// signed-in user's. Same shape as useEmployeesData (rows, loading, error,
// reload, setData), so the page finds the employee the same way. The demo and
// the owner preview keep the register (useEmployeesData).
export function useEmployeeRecordData({ code = null, selfMode = false, self = {} } = {}) {
  const { tenant } = useTenant()
  const organizationId = tenant?.id ?? null
  const single = cloudEnabled() && Boolean(organizationId) && !isOwnerPreview()
  const roster = useEmployeesData({ enabled: !single })
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(single)
  const [error, setError] = useState(null)
  const loaded = useRef(null)
  // The code the rows on hand were read for: moving to another employee shows the
  // placeholder, not one frame of the previous employee (or «not found»).
  const [loadedCode, setLoadedCode] = useState(undefined)
  const { employeeCode = null, userId = null, email = null } = self

  const read = useCallback(async ({ keep = false } = {}) => {
    setLoading(true); setError(null)
    try {
      // After a save the open record is read again by database id, so a new code still finds it.
      const dbId = keep && loaded.current?.code === code ? loaded.current.dbId : null
      const next = selfMode
        ? await loadSelfEmployeeCandidatesAsync(organizationId, { employeeCode, userId, email })
        : await loadEmployeeRecordAsync(organizationId, dbId ? { dbId } : { code })
      loaded.current = { code, dbId: next.length === 1 ? next[0].dbId : null }
      setData(next)
      return next
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setLoadedCode(code)
      setLoading(false)
    }
  }, [organizationId, code, selfMode, employeeCode, userId, email])
  const reload = useCallback(() => read({ keep: true }), [read])

  useEffect(() => { if (single) void read().catch(() => {}) }, [single, read])

  return single ? { data, setData, loading: loading || (!selfMode && loadedCode !== code), error, reload } : roster
}
