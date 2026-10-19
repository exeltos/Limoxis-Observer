import { useCallback, useEffect, useState } from 'react'
import { loadAuditTemplates } from './auditTemplateService'
import { loadAuditorCompetence } from './auditCompetenceService'

// The questionnaires the hospital can use: its own copies and the platform library.
// `false` for the organization loads nothing (a form that does not need them).
export function useAuditTemplates(organizationId) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(organizationId !== false)
  const reload = useCallback(() => {
    if (organizationId === false) return Promise.resolve()
    setLoading(true)
    return loadAuditTemplates(organizationId).then(setTemplates).catch(error => { console.error(error); setTemplates([]) }).finally(() => setLoading(false))
  }, [organizationId])
  useEffect(() => { void reload() }, [reload])
  return { templates, loading, reload }
}

// The auditor certificates and trainings, for the competence check of a team.
export function useAuditorCompetence(organizationId) {
  const [competence, setCompetence] = useState({ certificates: [], assignments: [], programs: [] })
  useEffect(() => {
    let active = true
    if (organizationId === false) return () => { active = false }
    loadAuditorCompetence(organizationId).then(value => { if (active) setCompetence(value) }).catch(() => { if (active) setCompetence({ certificates: [], assignments: [], programs: [] }) })
    return () => { active = false }
  }, [organizationId])
  return competence
}
