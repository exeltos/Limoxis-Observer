// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'
import {
  FORM_STATUS,
  addDays,
  athensToday,
  bundleKeysForDevice,
  bundleStatusForDevice,
  deviceDayNumber,
  shiftForHour,
} from '../src/features/surveillance/forms/formStatus'
import { buildBundlePrefill } from '../src/features/surveillance/forms/formPrefill'
import { bundleRowsFor, bundlesSection } from '../src/features/surveillance/forms/sections/bundlesSection'
import { makeDeviceBundles } from '../src/features/surveillance/forms/deviceBundles'
import { episodeFormSections, registerEpisodeFormSection } from '../src/features/surveillance/forms/formsRegistry'

const today = '2026-10-20'
const line = { id: 'D1', name: 'Κεντρικός φλεβικός καθετήρας', insertedAt: '2026-10-15', status: 'active' }
const foley = { id: 'D2', name: 'Ουροκαθετήρας (Foley)', insertedAt: '2026-10-16', status: 'active' }
const check = (deviceId, date, extra = {}) => ({ id: `${deviceId}-${date}`, surveillanceDeviceId: deviceId, date, status: 'completed', score: 75, answers: { a: 'yes', b: 'yes', c: 'yes', d: 'no' }, ...extra })

describe('device bundle status', () => {
  it('maps a device type to its bundle and counts the device day from the insertion day', () => {
    expect(bundleKeysForDevice(line)).toEqual(['CLABSI'])
    expect(bundleKeysForDevice(foley)).toEqual(['CAUTI'])
    expect(bundleKeysForDevice({ name: 'Μηχανικός αερισμός' })).toEqual(['VAP', 'VAE'])
    expect(bundleKeysForDevice({ name: 'Τραχειοστομία' })).toEqual([])
    expect(deviceDayNumber('2026-10-15', today)).toBe(6)
    expect(deviceDayNumber('2026-10-20T08:00:00', today)).toBe(1)
  })

  it('is overdue after the day following the last completed check, pending on that day, done once checked today', () => {
    expect(bundleStatusForDevice({ device: line, assessments: [check('D1', '2026-10-18')], today }).status).toBe(FORM_STATUS.OVERDUE)
    const pending = bundleStatusForDevice({ device: line, assessments: [check('D1', '2026-10-19')], today })
    expect(pending.status).toBe(FORM_STATUS.PENDING)
    expect(pending.dueOn).toBe('2026-10-20')
    expect(bundleStatusForDevice({ device: line, assessments: [check('D1', '2026-10-20')], today }).status).toBe(FORM_STATUS.DONE)
  })

  it('reports compliance of the latest check, ignores other devices and drafts for the status', () => {
    const info = bundleStatusForDevice({ device: line, assessments: [check('D1', '2026-10-19'), check('D2', '2026-10-20')], today })
    expect(info.compliance).toBe(75)
    expect([info.yes, info.applicable]).toEqual([3, 4])
    const draftOnly = bundleStatusForDevice({ device: line, assessments: [check('D1', '2026-10-20', { status: 'draft' })], today })
    expect(draftOnly.status).toBe(FORM_STATUS.OVERDUE)
    expect(bundleStatusForDevice({ device: foley, assessments: [], today }).status).toBe(FORM_STATUS.OVERDUE)
  })

  it('works in Europe/Athens days and shifts', () => {
    expect(athensToday(new Date('2026-10-20T22:30:00Z'))).toBe('2026-10-21')
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect([shiftForHour(8), shiftForHour(16), shiftForHour(2)]).toEqual(['Πρωινή', 'Απογευματινή', 'Νυχτερινή'])
  })
})

describe('bundle prefill and rows', () => {
  const ctx = {
    language: 'el',
    patient: { id: 'PT-1', name: 'Ελένη Παπαδοπούλου', recordId: 'uuid-p' },
    admission: { id: 'ADM-1', admissionDate: '2026-10-15', department: 'ΜΕΘ' },
    record: null,
    fmtDate: value => String(value).slice(0, 10),
    has: () => true,
    episodes: [{ id: 'SUR-1', recordId: 'uuid-c', departmentId: 'dep-1', department: 'ΜΕΘ', startedAt: '2026-10-15', devices: [line, foley, { id: 'D3', name: 'Τραχειοστομία' }, { ...line, id: 'D4', removedAt: '2026-10-17', status: 'removed' }] }],
  }
  it('fills patient, episode, device, day and bundle from the device row', () => {
    const info = bundleStatusForDevice({ device: line, assessments: [], today })
    const prefill = buildBundlePrefill({ ctx, device: line, episode: ctx.episodes[0], info, now: new Date('2026-10-20T09:00:00Z') })
    expect(prefill).toMatchObject({ surveillanceCaseId: 'uuid-c', surveillanceDeviceId: 'D1', patientRecordId: 'uuid-p', deviceDay: info.deviceDay, bundleKeys: ['CLABSI'], date: '2026-10-20', shift: 'Πρωινή', departmentId: 'dep-1' })
    expect(prefill.patientLabel).toBe('PT-1 · Ελένη Παπαδοπούλου')
  })
  it('lists only active devices that have a bundle', () => {
    expect(bundleRowsFor(ctx, [], today).map(row => row.device.id)).toEqual(['D1', 'D2'])
  })
  it('gives the device row its status, and a check button only to roles that record bundles', () => {
    const deviceBundles = makeDeviceBundles({ ...ctx, has: () => true }, [])
    expect(deviceBundles.canCheck).toBe(true)
    expect(deviceBundles.info(line).bundleKeys).toEqual(['CLABSI'])
    expect(makeDeviceBundles({ ...ctx, has: cap => cap !== 'record_prevention_bundle' }, []).canCheck).toBe(false)
    expect(makeDeviceBundles({ ...ctx, has: () => false }, [])).toBeNull()
  })
})

describe('forms registry', () => {
  it('lists the sections in order and accepts a later section without changes elsewhere', () => {
    expect(episodeFormSections().map(item => item.id).slice(0, 2)).toEqual(['bundles', 'scales'])
    registerEpisodeFormSection({ id: 'zz-test', order: 999, Component: () => null })
    expect(episodeFormSections().at(-1).id).toBe('zz-test')
    expect(() => registerEpisodeFormSection({ id: 'broken' })).toThrow()
  })
})

describe('bundles section', () => {
  it('shows a row per device with plain-word status, and a history action only', async () => {
    const ctx = {
      language: 'el',
      has: () => true,
      fmtDate: value => String(value).slice(0, 10),
      goTo: () => {},
      episodes: [{ id: 'SUR-1', devices: [{ ...line, insertedAt: addDays(athensToday(), -5) }] }],
    }
    const Section = bundlesSection.Component
    render(
      <MemoryRouter>
        <LanguageProvider>
          <Section ctx={ctx} section={{ value: [] }} />
        </LanguageProvider>
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Δέσμες πρόληψης συσκευών' })).toBeInTheDocument()
    expect(screen.getByText('Κεντρικός φλεβικός καθετήρας')).toBeInTheDocument()
    expect(screen.getByText('Εκπρόθεσμη')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ιστορικό' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Έλεγχος δέσμης/ })).toBeNull()
  })
})
