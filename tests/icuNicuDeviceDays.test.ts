import { describe, expect, it } from 'vitest'
import { computeIndicator, periodOf } from '../src/features/registers/registerEngine'
import { registerFromTemplate } from '../src/features/registers/registerTemplates'
import type { Register, RegisterEntry } from '../src/features/registers/registerTypes'
import { readSource } from './helpers/readSource'

// ΜΕΘ / ΜΕΝΝ: ημέρες συσκευής από τα μητρώα (ιδιοκτήτης 22/11/2026, επιλογή Α).
const icu = registerFromTemplate('icu') as Register
const nicu = registerFromTemplate('nicu') as Register
const of = (register: Register, id: string) => register.indicators.find(item => item.id === id)!
const entry = (values: Record<string, unknown>): RegisterEntry => ({ id: Math.random().toString(36), entryDate: String(values.admission_date), values } as RegisterEntry)
const march = periodOf('month', '2026-03-10')
const registers = readSource('supabase/migrations/20261231626000_icu_nicu_register_device_days.sql')
const snapshot = readSource('supabase/migrations/20261231627000_icu_nicu_device_day_indicators.sql')
const ownerSql = readSource('docs/sql/surveillance_infection_type_cauti.sql')

describe('ICU register: device days', () => {
  it('has central line and urinary catheter days after the ventilator hours', () => {
    const keys = icu.fields.map(field => field.key)
    expect(keys.slice(keys.indexOf('ventilator_hours'), keys.indexOf('ventilator_hours') + 3)).toEqual(['ventilator_hours', 'central_line_days', 'urinary_catheter_days'])
    expect(icu.fields.find(field => field.key === 'central_line_days')).toMatchObject({ label: 'Ημέρες κεντρικού φλεβικού καθετήρα', labelEn: 'Central line days', type: 'number' })
    expect(icu.fields.find(field => field.key === 'urinary_catheter_days')).toMatchObject({ label: 'Ημέρες ουροκαθετήρα', labelEn: 'Urinary catheter days', type: 'number' })
  })

  it('computes device utilisation per 100 patient-days in the month of discharge, ventilator hours as days', () => {
    const entries = [
      entry({ admission_date: '2026-03-01', discharge_date: '2026-03-11', central_line_days: 8, urinary_catheter_days: 10, ventilator_hours: 120 }),
      entry({ admission_date: '2026-03-05', discharge_date: '2026-03-15', central_line_days: 2, urinary_catheter_days: 5, ventilator_hours: 0 }),
      entry({ admission_date: '2026-03-20', central_line_days: 3, ventilator_hours: 48 }),
    ]
    expect(computeIndicator(icu, of(icu, 'icu_days_total'), entries, march).value).toBe(20)
    const line = computeIndicator(icu, of(icu, 'central_line_use'), entries, march)
    expect([line.numerator, line.denominator, line.value]).toEqual([10, 20, 50])
    expect(computeIndicator(icu, of(icu, 'urinary_catheter_use'), entries, march).value).toBe(75)
    const vent = computeIndicator(icu, of(icu, 'ventilator_use'), entries, march)
    expect([vent.numerator, vent.denominator, vent.value]).toEqual([5, 20, 25])
  })

  it('says «not recorded» until an entry has the device days (the 2025–2026 back-fill)', () => {
    const entries = [entry({ admission_date: '2026-03-01', discharge_date: '2026-03-11', ventilator_hours: 24 })]
    expect(computeIndicator(icu, of(icu, 'central_line_use'), entries, march).notRecorded).toBe(true)
    expect(computeIndicator(icu, of(icu, 'ventilator_use'), entries, march).notRecorded).toBeUndefined()
  })
})

describe('NICU register: central line days include the umbilical catheter', () => {
  it('adds PICC and umbilical days over the stay days', () => {
    const entries = [entry({ admission_date: '2026-03-01', discharge_date: '2026-03-21', central_line_days: 6, umbilical_days: 4, ventilator_days: 5 })]
    const line = computeIndicator(nicu, of(nicu, 'central_line_use'), entries, march)
    expect([line.numerator, line.denominator, line.value]).toEqual([10, 20, 50])
    expect(computeIndicator(nicu, of(nicu, 'ventilator_use'), entries, march).value).toBe(25)
    expect(computeIndicator(nicu, of(nicu, 'patient_days_total'), entries, march).value).toBe(20)
    expect(nicu.fields.find(field => field.key === 'umbilical_days')?.help).toContain('PICC')
  })
})

describe('database: registers and device-day indicators', () => {
  it('adds the ICU fields and the register indicators to every ICU/NICU register, and keeps them on a Demo reset', () => {
    expect(registers).toContain("perform private.register_add_field_after(r.id, 'ventilator_hours', jsonb_build_object('key', 'central_line_days'")
    expect(registers).toContain("'label_el', 'Ημέρες ουροκαθετήρα', 'label_en', 'Urinary catheter days'")
    expect(registers).toContain("'ventilator_hours/24'")
    expect(registers).toContain("'central_line_days+umbilical_days'")
    expect(registers.match(/perform private\.register_add_device_days\(p_register_id\);/g)).toHaveLength(2)
    expect(registers).not.toMatch(/^\s*(drop|delete|revoke)\b/im)
  })

  it('counts the register stays within the period, open stays to today in Athens, and only when there are no surveillance devices', () => {
    expect(snapshot).toContain("v_today date := (now() at time zone 'Europe/Athens')::date;")
    expect(snapshot).toContain('greatest(0, least(s.e, $2 + 1) - greatest(s.a, $1)) as days')
    expect(snapshot).toContain('and (discharge_date is not null or outcome is null)')
    expect(snapshot).toMatch(/if exists \(select 1 from public\.surveillance_devices d where d\.organization_id = p_organization_id and d\.department_id = p_department_id/)
    expect(snapshot).toContain("'ventilator_hours::numeric / 24'")
  })

  it('counts only hospital-acquired episodes in the unit and leaves the units out of the hospital-wide numerators', () => {
    expect(snapshot.match(/and \(v_unit is null or s\.hospital_acquired is true\)/g)).toHaveLength(3)
    expect(snapshot.match(/and \(s\.department_id is null or not \(s\.department_id = any\(v_register_units\)\)\)/g)).toHaveLength(3)
    expect(snapshot).toContain("it.infection_type in ('urinary_tract','catheter_urinary_tract')")
    expect(snapshot).toContain("'device_patient_days',v_unit->'unit_patient_days'")
  })

  it('ships the utilisation and NICU birth-weight CLABSI indicators', () => {
    for (const key of ['central-line-utilisation', 'urinary-catheter-utilisation', 'ventilator-utilisation', 'clabsi-rate-le750', 'clabsi-rate-bw751-1000', 'clabsi-rate-bw1001-1500', 'clabsi-rate-bw1501-2500', 'clabsi-rate-gt2500']) {
      expect(snapshot).toContain(`('${key}', `)
    }
    for (const band of ['le750', 'bw751_1000', 'bw1001_1500', 'bw1501_2500', 'gt2500']) {
      expect(snapshot).toContain(`'central_line_days_${band}'`)
      expect(snapshot).toContain(`'clabsi_events_${band}'`)
    }
  })

  it('leaves the CAUTI infection type check to the owner (it needs a drop)', () => {
    expect(snapshot).not.toMatch(/drop constraint/i)
    expect(ownerSql).toContain('drop constraint surveillance_case_infection_types_infection_type_check')
    expect(ownerSql).toContain("'catheter_urinary_tract'")
    expect(ownerSql).toContain('Ουρολοίμωξη σχετιζόμενη με καθετήρα (CAUTI)')
  })
})
