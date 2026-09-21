// @vitest-environment jsdom
import { describe, expect, it, beforeAll } from 'vitest'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'
import { loadDocuments } from '../src/features/documents/documentStore'
import { loadCommittees } from '../src/features/committees/committeeData'
import { loadPrevalenceSurveyLocal } from '../src/features/management/prevalenceSurveyStore'
import { loadHospitalStructureLocal } from '../src/features/management/hospitalStructureStore'
import { employeeEvaluations, employeeRows } from '../src/features/employees/employeeDemoData'

describe('platform demo data enrichment', () => {
  beforeAll(() => { configureDataEnvironment({ mode: 'demo' }) })

  it('shows the full controlled-document lifecycle in the demo roster', () => {
    const statuses = new Set(loadDocuments().map(doc => doc.status))
    for (const status of ['draft', 'review', 'approved', 'published', 'archived', 'superseded']) {
      expect(statuses.has(status)).toBe(true)
    }
  })

  it('gives every demo committee real meetings, decisions and an annual plan', () => {
    const committees = loadCommittees()
    expect(committees.length).toBeGreaterThanOrEqual(2)
    for (const committee of committees) {
      expect(committee.meetings.length).toBeGreaterThan(0)
      expect(committee.decisions.length).toBeGreaterThan(0)
      expect(committee.annualPlan.length).toBeGreaterThan(0)
    }
  })

  it('gives the prevalence survey and hospital structure enough points for a trend line', () => {
    expect(loadPrevalenceSurveyLocal().length).toBeGreaterThanOrEqual(5)
    expect(loadHospitalStructureLocal().length).toBeGreaterThanOrEqual(3)
  })

  it('gives every demo employee at least one evaluation', () => {
    const evaluatedIds = new Set(employeeEvaluations.map(row => row.employeeId))
    for (const employee of employeeRows) {
      expect(evaluatedIds.has(employee.id)).toBe(true)
    }
  })
})
