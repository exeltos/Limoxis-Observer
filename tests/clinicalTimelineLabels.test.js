import { describe, expect, it } from 'vitest'
import { formatDayTime } from '../src/core/i18n/formatDay'
import { readFileSync } from 'node:fs'
import { translate } from '../src/core/i18n/LanguageContext'
import { timelineLabel } from '../src/features/surveillance/clinicalRecordLabels'

// The page's t is scoped to the clinical record strings.
const scoped = language => key => {
  const text = translate(`clinicalRecords.${key}`, language)
  return text && text !== `clinicalRecords.${key}` ? text : key
}
const t = scoped('el')
const english = readFileSync('src/core/i18n/stringsEn.js', 'utf8')

describe('episode history labels', () => {
  it('names the events a production case stores in words, not as codes', () => {
    expect(timelineLabel('device_added', 'el', t)).toBe('Καταχώριση συσκευής')
    // Every event name has an English text too.
    for (const key of ['deviceAdded', 'deviceRemoved', 'therapyEnded', 'therapyAdministered', 'therapyApproval']) expect(english).toContain(`${key}:'`)
    expect(timelineLabel('hai_classification', 'el', t)).not.toContain('_')
  })

  it('writes a day and a time in the day format of the lists, in Athens time', () => {
    expect(formatDayTime('2026-06-11T08:10:00Z', 'el')).toBe('11/6/2026 11:10')
    expect(formatDayTime('2026-06-11T08:10:00Z', 'en')).toBe('11/06/2026 11:10')
  })
})
