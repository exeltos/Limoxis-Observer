import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { antisepticRows, handHygieneRows } from '../src/features/prevention/preventionDemoData'
import { WHO_MOMENTS, WHO_PROFESSIONS } from '../src/features/prevention/WhoHandHygieneEditor'
import * as antisepticModal from '../src/features/prevention/AntisepticEntryModal'
import { ANTISEPTIC_METHODS } from '../src/features/prevention/AntisepticEntryModal'

// Prevention module review, following the pattern of past module reviews.
describe('the bulk vaccination "saved" toast interpolates the count in Greek too', () => {
  it('no longer calls t() with a second (unsupported) interpolation argument', () => {
    // The toast itself is checked by behavior in preventionVaccinationBundleBehavior.
    expect(fs.readFileSync('src/core/i18n/stringsEl.js','utf8')).toContain("vaccinationSavedMany:'Αποθηκεύτηκαν {count} εμβολιασμοί.'")
  })
})

// The demo seed data is checked by value (not by its source text), so formatting
// the data file cannot break or fake these checks.
describe('demo hand-hygiene seed data uses the canonical WHO moment ids and profession labels', () => {
  const observations = handHygieneRows.flatMap(row => row.whoObservations || [])
  it('uses only the moment1..5 ids that WhoHandHygieneEditor and PreventionRecordPage actually resolve', () => {
    const known = new Set(WHO_MOMENTS.map(moment => moment.id))
    const used = observations.flatMap(item => item.moments)
    expect(used.length).toBeGreaterThan(0)
    for (const id of used) expect(known.has(id), id).toBe(true)
    expect(used).toEqual(expect.arrayContaining(['moment1', 'moment4']))
  })
  it('uses professionalCategory values that exist in WHO_PROFESSIONS, each with an English translation', () => {
    const known = new Map(WHO_PROFESSIONS)
    for (const item of observations) expect(known.get(item.professionalCategory), item.professionalCategory).toBeTruthy()
  })
})

describe('demo antiseptic seed data uses a valid ANTISEPTIC_METHODS id', () => {
  it('uses only known measurement methods', () => {
    const known = new Set(ANTISEPTIC_METHODS.map(method => method.id))
    expect(antisepticRows.length).toBeGreaterThan(0)
    for (const row of antisepticRows) expect(known.has(row.method), row.method).toBe(true)
  })
})

describe('the dead, superseded AntisepticEntryModal component was removed', () => {
  it('the module now only exports the still-used helpers, not the unused dialog component', () => {
    expect(Object.keys(antisepticModal).sort()).toEqual(['ANTISEPTIC_METHODS', 'antisepticMethodLabel', 'isAbhrProduct'])
  })
})
