import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const matrix = fs.readFileSync(new URL('../src/core/permissions/systemRoleMatrix.js', import.meta.url), 'utf8')
const workflow = fs.readFileSync(new URL('../src/features/committees/committeeWorkflowService.js', import.meta.url), 'utf8')
const migration = fs.readFileSync(new URL('../supabase/migrations/20260902150000_committee_framework_governance.sql', import.meta.url), 'utf8')

describe('committee framework governance boundary', () => {
  it('does not grant committee creation governance to committee secretariat', () => {
    const secretariat = matrix.match(/\[ROLES\.COMMITTEE_SECRETARIAT\]:\[([^\]]+)\]/)?.[1] ?? ''
    const capabilities = secretariat.match(/CAPABILITIES\.[A-Z0-9_]+/g) ?? []
    expect(capabilities).not.toContain('CAPABILITIES.CREATE_COMMITTEE')
    expect(capabilities).toContain('CAPABILITIES.MANAGE_COMMITTEE_MEMBERS')
  })

  it('updates framework through the committees table rather than member workflow', () => {
    expect(workflow).toContain("export async function updateCommitteeFrameworkAsync")
    expect(workflow).toContain("supabase.from('committees').update")
  })

  it('requires create_committee governance capability for committee record edits', () => {
    expect(migration).toMatch(/committees_edit[\s\S]*current_user_has_governance_capability\(organization_id,'create_committee'\)/)
  })
})
