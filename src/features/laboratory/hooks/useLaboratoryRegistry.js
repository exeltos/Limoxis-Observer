import { useCallback, useEffect, useState } from 'react'
import { READINESS } from '../../../core/data/repositoryResult'
import { useLaboratoryRepository } from './useLaboratoryRepository'

const initialState = { rows: [], loading: true, error: null, readiness: READINESS.READY, missingConfiguration: [] }

// enabled:false skips the read (a screen that loads the samples itself and
// only needs the repository's actions). `scope` ({ patientRecordId, caseIds },
// kept stable by the caller) narrows the production read to one patient.
export function useLaboratoryRegistry({ enabled = true, scope = null } = {}) {
  const repository = useLaboratoryRepository()
  const [state, setState] = useState(enabled ? initialState : { ...initialState, loading: false })

  const reload = useCallback(async () => {
    setState(current => ({ ...current, loading: true, error: null }))
    try {
      const result = await (scope ? repository.list(scope) : repository.list())
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
  }, [repository, scope])

  useEffect(() => { if (enabled) void reload() }, [reload, enabled])

  const createSample = useCallback(async input => {
    const created = await repository.create(input)
    await reload()
    return created
  }, [repository, reload])

  return { ...state, repository, reload, createSample }
}
