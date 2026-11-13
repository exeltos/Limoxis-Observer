import { describe, expect, it } from 'vitest'
import { findingFlow, findingNeedsAction } from '../src/features/quality/qualityRecordRules'
import { readSource } from './helpers/readSource'

const status = (record, capas = []) => Object.fromEntries(findingFlow(record, capas).map(step => [step.id, step.status]))

describe('the flow of a deviation', () => {
  it('waits for the assessment first', () => {
    expect(status({ status: 'open' })).toEqual({ reported: 'done', assessment: 'current', capa: 'todo', effectiveness: 'todo', closed: 'todo' })
  })

  it('asks for a corrective action once the assessment says one is needed', () => {
    expect(status({ status: 'open', correctiveActionNeeded: true, assessedAt: '2026-11-11T10:00:00Z' }))
      .toEqual({ reported: 'done', assessment: 'done', capa: 'current', effectiveness: 'todo', closed: 'todo' })
  })

  it('skips the action and its effectiveness check when none is needed', () => {
    expect(status({ status: 'open', correctiveActionNeeded: false, noActionReason: 'Διορθώθηκε επί τόπου' }))
      .toEqual({ reported: 'done', assessment: 'done', capa: 'skipped', effectiveness: 'skipped', closed: 'current' })
  })

  it('follows the CAPA once there is one, and counts an old closed deviation as assessed', () => {
    expect(status({ status: 'open', correctiveActionNeeded: true }, [{ lifecycleStatus: 'active', effectivenessStatus: 'pending' }]).effectiveness).toBe('current')
    expect(status({ status: 'closed' }).assessment).toBe('done')
    // A deviation that already has a CAPA was decided: an action was needed.
    expect(status({ status: 'open' }, [{ lifecycleStatus: 'active' }]).assessment).toBe('done')
  })

  it('does not wait for an action when the assessment says none is needed', () => {
    expect(findingNeedsAction({ status: 'open' })).toBe(true)
    expect(findingNeedsAction({ status: 'open', correctiveActionNeeded: false })).toBe(false)
    expect(findingNeedsAction({ status: 'open' }, [{ lifecycleStatus: 'active' }])).toBe(false)
    expect(findingNeedsAction({ status: 'closed' })).toBe(false)
  })
})

describe('the assessment of a deviation on its record page', () => {
  const page = readSource('src/features/quality/QualityRecordPage.jsx')
  const register = readSource('src/features/quality/QualityReportRegister.jsx')
  const migration = readSource('supabase/migrations/20261231300000_finding_assessment.sql')

  it('has the «Αξιολόγηση» tab and the flow panel beside the details, like an incident', () => {
    expect(page).toContain("...(incident||recordType==='findings'?[{id:'assessment'")
    expect(page).toContain("kind={finding?'finding':'incident'}")
    expect(page).toContain("'Χρειάζεται διορθωτική ενέργεια;'")
  })

  it('asks why when no corrective action is needed', () => {
    expect(page).toContain("draft.correctiveActionNeeded===false&&!String(draft.noActionReason||'').trim()")
  })

  it('keeps a deviation decided as «no action» out of the «without action» views', () => {
    expect(register).toContain("hasCapa:handled.has(record.id)||record.correctiveActionNeeded===false")
  })

  it('does not warn about a missing action when the assessment says none is needed', () => {
    expect(readSource('src/features/quality/QualityGlance.jsx')).toContain("record.correctiveActionNeeded===false?{text:en?'no corrective action needed'")
  })

  it('adds the assessment columns without touching what is recorded', () => {
    expect(migration).toMatch(/add column if not exists corrective_action_needed boolean/)
    expect(migration).not.toMatch(/\b(drop table|delete from|alter policy|revoke)\b/i)
  })
})
