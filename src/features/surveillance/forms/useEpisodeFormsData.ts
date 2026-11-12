import { useCallback, useEffect, useRef, useState } from 'react'
import { visibleEpisodeFormSections } from './formsRegistry'

// Loads the data of every registered section that has a `load`, once per record (the key is
// ctx.scopeKey). Lives in the record page, not in the tab, so the tab header, the device row
// of the surveillance stage and the printed report read the same rows. Each section is
// { loading, value, error }; a failing section never blocks the others.
export function useEpisodeFormsData(ctx) {
  const [state, setState] = useState({})
  const ctxRef = useRef(ctx)
  ctxRef.current = ctx
  const generation = useRef(0)
  const enabled = Boolean(ctx?.enabled)
  const scopeKey = ctx?.scopeKey || ''

  const runOne = useCallback((section, token) => {
    setState(current => ({ ...current, [section.id]: { ...current[section.id], loading: true } }))
    return Promise.resolve()
      .then(() => section.load(ctxRef.current))
      .then(value => {
        if (token === generation.current) setState(current => ({ ...current, [section.id]: { loading: false, value, error: null } }))
      })
      .catch(error => {
        if (token === generation.current)
          setState(current => ({ ...current, [section.id]: { loading: false, value: current[section.id]?.value, error } }))
      })
  }, [])

  useEffect(() => {
    generation.current += 1
    const token = generation.current
    if (!enabled) return
    setState({})
    for (const section of visibleEpisodeFormSections(ctxRef.current)) if (section.load) void runOne(section, token)
  }, [enabled, scopeKey, runOne])

  const reload = useCallback(
    id => {
      const section = visibleEpisodeFormSections(ctxRef.current).find(item => item.id === id)
      return section?.load ? runOne(section, generation.current) : Promise.resolve()
    },
    [runOne],
  )
  return { data: state, reload }
}
