import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'

const sql = readSource('supabase/migrations/20261231624000_fm_daily_sheets_by_day.sql')
const body = sql.replace(/--[^\n]*/g, '')

describe('FileMaker daily sheets go to the row of their day', () => {
  it('uses the day row when the register is daily (daily_from), the month row otherwise', () => {
    expect(body).toContain('select d.daily_from into v_daily_from from public.department_registers d where d.id = v_register')
    expect(body).toContain("v_month := case when v_daily_from is not null and v_day >= v_daily_from then v_day else date_trunc('month', v_day)::date end")
    expect(body).toContain("md5('fm-' || p_base_table || '-' || v_month)::uuid")
  })
  it('recomputes 1/10 and 31/10 onward from the staged FileMaker records, relinks, and backs up the old rows', () => {
    expect(body).toContain("array['2026-10-01'::date] || array(select d::date from generate_series('2026-10-31'::date")
    for (const table of ['Indicators TEP', 'Indicators Α.Τ', 'Indicators Ενδοσκοπικό', 'Indicators eyelab']) {
      expect(body).toContain(`private.fm_resync_daily_counts('${table}'`)
    }
    expect(body).toContain('not coalesce(locked, false)')
    expect(body).toContain('update public.fm_stage_links l set target_id = t.id')
    expect(body).toContain('insert into private.bk_fm_daily_rows_20261122')
    expect(body).toContain("to_regclass('public.register_emergency_f6ceb2a5') is null")
  })
  it('never deletes, drops, revokes or truncates', () => {
    expect(/\bdelete\s+from\b|\btruncate\b|\bdrop\s+|\brevoke\b|\balter\s+policy\b/i.test(body)).toBe(false)
  })
})
