import { useCallback, useEffect, useState } from 'react'
import { READINESS } from '../../../core/data/repositoryResult'
import { useLaboratoryRepository } from './useLaboratoryRepository'

const initialState = { rows: [], loading: true, error: null, readiness: READINESS.READY, missingConfiguration: [] }

export function useLaboratoryRegistry() {
  const repository = useLaboratoryRepository()
  const [state, setState] = useState(initialState)

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

  useEffect(() => { void reload() }, [reload])

  const createSample = useCallback(async input => {
    const created = await repository.create(input)
    await reload()
    return created
  }, [repository, reload])

  return { ...state, repository, reload, createSample }
}
