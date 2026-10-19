import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = fs.readFileSync('supabase/migrations/20261125100100_analysis_control_reads_speed.sql', 'utf8')

describe('Analysis control executions read', () => {
  it('reads a covering index with only the columns the metrics use', () => {
    expect(sql).toMatch(/create index if not exists control_executions_analysis_idx\s+on public\.control_executions \(organization_id, performed_at\)\s+include \(department_id, control_id, status, has_finding, created_at\)\s+where cancelled_at is null;/)
    expect(sql.match(/select c\.department_id, c\.control_id, c\.status, c\.has_finding, c\.performed_at, c\.created_at from public\.control_executions c/g)).toHaveLength(2)
  })

  it('filters the period on performed_at itself and stops when the function body has changed', () => {
    expect(sql).toContain("'(p_from is null or c.performed_at>=p_from)'")
    expect(sql).toContain("'(p_to is null or c.performed_at < p_to + 1)'")
    expect(sql.match(/raise exception 'analysis_(domain|crosstab)_metrics: control_executions CTE not found'/g)).toHaveLength(2)
  })
})
