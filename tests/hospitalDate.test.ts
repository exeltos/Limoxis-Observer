import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { hospitalDate, hospitalMonth } from '../src/core/dates/hospitalDate'
import { readSource } from './helpers/readSource'

const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : /\.(js|jsx|ts|tsx)$/.test(entry.name) ? [path.join(dir, entry.name)] : [])

describe('The hospital counts days on the Europe/Athens clock', () => {
  it('after midnight in Athens it is already the next day, while UTC is still on the previous one', () => {
    // 23:30 UTC on 14 March = 01:30 in Athens on 15 March (winter, UTC+2).
    expect(hospitalDate(new Date('2026-03-14T23:30:00Z'))).toBe('2026-03-15')
    // Summer time (UTC+3): 21:30 UTC on 31 July = 00:30 on 1 August.
    expect(hospitalDate(new Date('2026-07-31T21:30:00Z'))).toBe('2026-08-01')
    expect(hospitalMonth(new Date('2026-07-31T21:30:00Z'))).toBe('2026-08')
  })
  it('keeps a date-only value on its own day and returns an empty string for nonsense', () => {
    expect(hospitalDate('2026-11-12')).toBe('2026-11-12')
    expect(hospitalDate('not a date')).toBe('')
  })
  it('«today» is never taken from the UTC clock again', () => {
    const offenders = files('src').filter(file => /new Date\(\)\.toISOString\(\)\.slice\(0, ?(7|10)\)/.test(readSource(file)))
    expect(offenders).toEqual([])
  })
})

describe('One set of Athens clock helpers (src/core/dates/hospitalDate.ts)', () => {
  it('gives the hour, the time and the day of a database timestamp on the Athens clock', async () => {
    const { hospitalDay, hospitalHour, hospitalNow } = await import('../src/core/dates/hospitalDate')
    expect(hospitalNow(new Date('2026-10-20T22:30:00Z'))).toEqual({ date: '2026-10-21', time: '01:30' })
    expect(hospitalHour(new Date('2026-10-20T21:05:00Z'))).toBe(0)
    expect(hospitalDay('2026-03-14T22:30:00+00:00')).toBe('2026-03-15')
    expect(hospitalDay('2026-03-14')).toBe('2026-03-14')
  })
  it('the screens use it instead of their own Intl.DateTimeFormat for Athens', () => {
    for (const file of ['src/features/surveillance/forms/formStatus.js', 'src/features/surveillance/patientRecordScope.js', 'src/features/platform/platformHealthService.js', 'src/features/surveillance/AdmissionDischargeDialog.jsx']) {
      expect(readSource(file)).not.toContain("timeZone: 'Europe/Athens'")
      expect(readSource(file)).not.toContain('HOSPITAL_TIME_ZONE')
      expect(readSource(file)).toContain('core/dates/hospitalDate')
    }
  })
})
