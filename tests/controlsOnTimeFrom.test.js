import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

// «Οι παλιές να μετράνε στην ώρα τους» (owner, 2/11/2026): entries before the hospital's controls_on_time_from count as on time.
describe('controls judged on time from a day', () => {
  const sql = fs.readFileSync('supabase/migrations/20261231221800_controls_on_time_from.sql', 'utf8')
  it('counts the entries before the day as on time in the adherence counts', () => {
    expect(sql).toContain('add column if not exists controls_on_time_from date')
    expect(sql).toContain('(m.on_time or (v_judged_from is not null and m.performed_at < v_judged_from))')
    expect(sql).toContain("controls_on_time_from::timestamp at time zone 'Europe/Athens'")
  })
  it('marks the entries before the day on time in the control page as well', () => {
    const page = fs.readFileSync('src/features/controls/ControlRecordPage.jsx', 'utf8')
    expect(page).toContain('loadControlsOnTimeFrom(tenant?.id)')
    expect(page).toContain('onTime:Boolean(before)||')
  })
})
