// The Committees list reads counts (committee_overview_counts, 20261201120000)
// and only the open decisions; a committee's record reads its own rows.
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { committeeMeetingCount } from '../src/features/committees/committeeService'

const read = path => fs.readFileSync(path, 'utf8')
const migration = read('supabase/migrations/20261201120000_committee_overview_counts.sql')
const sql = migration.split('\n').filter(line => !line.trim().startsWith('--')).join('\n')
const service = read('src/features/committees/committeeService.js')

describe('committee overview reads', () => {
  it('counts under the caller RLS', () => {
    expect(sql).toContain('create or replace function public.committee_overview_counts(p_organization_id uuid)')
    expect(sql).toContain('security invoker')
    expect(sql).not.toContain('security definer')
    expect(sql).not.toMatch(/\b(drop|revoke|delete)\b/i)
  })

  it('reads the list without every attendance and decision row, with a fallback', () => {
    expect(service).toContain("supabase.rpc('committee_overview_counts',{p_organization_id:organizationId})")
    expect(service).toContain("selectRows('committee_decisions',DECISION_COLUMNS,organizationId,null,openDecisions)")
    expect(service).toContain('if(counted?.error||!Array.isArray(counted?.data))return loadCommitteesFullAsync(organizationId)')
    expect(service).toContain("readWorkflow(organizationId,query=>query.eq('committee_id',data.id))")
    expect(read('src/features/committees/CommitteeRecordPage.jsx')).toContain('useCommitteesData(committeeId)')
  })

  it('takes the meeting count from the counts, else from the meetings', () => {
    expect(committeeMeetingCount({ overview: { meetings: 12 }, meetings: [{}] })).toBe(12)
    expect(committeeMeetingCount({ meetings: [{}, {}] })).toBe(2)
    expect(committeeMeetingCount({})).toBe(0)
  })
})
