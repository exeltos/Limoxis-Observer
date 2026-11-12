import { useCallback, useEffect, useState } from 'react'
import { READINESS } from '../../../core/data/repositoryResult'
import { useLaboratoryRepository } from './useLaboratoryRepository'
import { hospitalDate } from '../../../core/dates/hospitalDate'

const initialState = { rows: [], loading: true, error: null, readiness: READINESS.READY, missingConfiguration: [] }

// enabled:false skips the read (a screen that loads the samples itself and
// only needs the repository's actions). `scope` ({ patientRecordId, caseIds },
// kept stable by the caller) narrows the production read to one patient.
// `recent`: the laboratory's own list reads the last 12 months (and what is still open); showOlder() reads every sample.
export const RECENT_MONTHS = 12
const sinceDate = () => { const day = new Date(); day.setMonth(day.getMonth() - RECENT_MONTHS); return hospitalDate(day) }
export function useLaboratoryRegistry({ enabled = true, scope = null, recent = false } = {}) {
  const repository = useLaboratoryRepository()
  const [state, setState] = useState(enabled ? initialState : { ...initialState, loading: false })
  const [older, setOlder] = useState(false)

  const reload = useCallback(async () => {
    setState(current => ({ ...current, loading: true, error: null }))
    try {
      const result = await (scope ? repository.list(scope) : recent ? repository.list(null, { since: older ? null : sinceDate() }) : repository.list())
      setState({
        rows: result.data,
        loading: false,
        error: null,
        readiness: result.readiness,
        missingConfiguration: result.missingConfiguration,
      })
      return result
    } catch (error) {
      setState(current => ({ ...current, loading: false, error }))
      return null
    }
  }, [repository, scope, recent, older])

  useEffect(() => { if (enabled) void reload() }, [reload, enabled])

  const createSample = useCallback(async input => {
    const created = await repository.create(input)
    await reload()
    return created
  }, [repository, reload])

  return { ...state, repository, reload, createSample, recentOnly: recent && !older, showOlder: () => setOlder(true) }
}
