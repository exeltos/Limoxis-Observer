import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { hospitalDate, hospitalMonth } from '../src/core/dates/hospitalDate'

const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : /\.(js|jsx)$/.test(entry.name) ? [path.join(dir, entry.name)] : [])

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
    const offenders = files('src').filter(file => /new Date\(\)\.toISOString\(\)\.slice\(0, ?(7|10)\)/.test(fs.readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})
