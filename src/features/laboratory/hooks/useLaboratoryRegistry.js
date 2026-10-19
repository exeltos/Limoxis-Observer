import { useCallback, useEffect, useState } from 'react'
import { READINESS } from '../../../core/data/repositoryResult'
import { useLaboratoryRepository } from './useLaboratoryRepository'

const initialState = { rows: [], loading: true, error: null, readiness: READINESS.READY, missingConfiguration: [] }

// enabled:false skips the read (a screen that loads the samples itself and
// only needs the repository's actions).
export function useLaboratoryRegistry({ enabled = true } = {}) {
  const repository = useLaboratoryRepository()
  const [state, setState] = useState(enabled ? initialState : { ...initialState, loading: false })

  const reload = useCallback(async () => {
    setState(current => ({ ...current, loading: true, error: null }))
    try {
      const result = await repository.list()
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
  }, [repository])

  useEffect(() => { if (enabled) void reload() }, [reload, enabled])

  const createSample = useCallback(async input => {
    const created = await repository.create(input)
    await reload()
    return created
  }, [repository, reload])

  return { ...state, repository, reload, createSample }
}
