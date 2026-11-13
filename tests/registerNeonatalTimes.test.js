import { describe, expect, it } from 'vitest'
import { computeValues, derivedHours, formatValue, hoursField, validateEntry } from '../src/features/registers/registerEngine'
import { hospitalInstant } from '../src/core/dates/hospitalDate'
import { REGISTER_TEMPLATES } from '../src/features/registers/registerTemplates'
import { readSource } from './helpers/readSource'

const nicu = REGISTER_TEMPLATES.find(template => template.key === 'nicu')
const fields = nicu.fields
const migration = readSource('supabase/migrations/20261231490000_register_time_fields_nicu.sql')
const ownerSql = readSource('docs/sql/done/register_time_field_type.sql')

describe('NICU register: birth and admission times', () => {
  it('the template has the two times next to their dates and the hours after the age in days', () => {
    const keys = fields.filter(field => field.section === 'admission').map(field => field.key)
    expect(keys.slice(0, 6)).toEqual(['admission_date', 'admission_time', 'birth_date', 'birth_time', 'age_on_admission', 'admission_age_hours'])
    expect(fields.find(field => field.key === 'birth_time').type).toBe('time')
    expect(fields.find(field => field.key === 'admission_age_hours')).toMatchObject({ type: 'number', unit: 'ώρες', aliases: ['ΗΛΙΚΙΑ ΕΙΣΑΓΩΓΗΣ ΣΕ ΩΡΕΣ'] })
    expect(hoursField(fields, 'admission_age_hours')).toEqual({ from: 'birth_date', fromTime: 'birth_time', to: 'admission_date', toTime: 'admission_time', hours: 'admission_age_hours' })
    expect(hoursField(fields, 'birth_weight')).toBeNull()
  })
  it('reads the times on the Athens clock, summer time included', () => {
    expect(new Date(hospitalInstant('2026-01-15', '08:30')).toISOString()).toBe('2026-01-15T06:30:00.000Z')
    expect(new Date(hospitalInstant('2026-07-15', '08:30')).toISOString()).toBe('2026-07-15T05:30:00.000Z')
    expect(hospitalInstant('2026-07-15', '')).toBeNull()
    expect(hospitalInstant('2026-07-15', '25:00')).toBeNull()
  })
  it('calculates the hours from both times and keeps typed hours without them', () => {
    expect(derivedHours(fields, { birth_date: '2026-11-10', birth_time: '08:30', admission_date: '2026-11-10', admission_time: '14:00' })).toEqual({ admission_age_hours: 5.5 })
    expect(derivedHours(fields, { birth_date: '2026-11-09', birth_time: '22:00', admission_date: '2026-11-11', admission_time: '06:00' })).toEqual({ admission_age_hours: 32 })
    // The night summer time ends (25 October 2026) has 25 hours.
    expect(derivedHours(fields, { birth_date: '2026-10-24', birth_time: '12:00', admission_date: '2026-10-25', admission_time: '12:00' })).toEqual({ admission_age_hours: 25 })
    expect(computeValues(fields, { birth_date: '2026-11-10', admission_date: '2026-11-10', admission_age_hours: 7 }).admission_age_hours).toBe(7)
    expect(computeValues(fields, { birth_date: '2026-11-10', birth_time: '08:30', admission_date: '2026-11-10', admission_time: '14:00', admission_age_hours: 7 }).admission_age_hours).toBe(5.5)
  })
  it('the age on admission shows the calculated hours', () => {
    const values = computeValues(fields, { birth_date: '2026-11-10', birth_time: '08:30', admission_date: '2026-11-10', admission_time: '14:00' })
    expect(formatValue(fields.find(field => field.key === 'age_on_admission'), values.age_on_admission, 'el', values)).toBe('5,5 ώρες')
    expect(formatValue({ key: 'birth_time', type: 'time' }, '08:30:00', 'el')).toBe('08:30')
  })
  it('refuses an admission before the birth and a time that is not hh:mm', () => {
    const base = { admission_date: '2026-11-10', birth_date: '2026-11-10' }
    expect(validateEntry(fields, { ...base, birth_time: '14:00', admission_time: '08:30' }, 'el').errors.admission_time).toBe('Όχι πριν από «Ώρα γέννησης»')
    expect(validateEntry(fields, { ...base, birth_time: '8:3' }, 'en').errors.birth_time).toBe('Time as hh:mm')
    const ok = validateEntry(fields, { ...base, birth_time: '08:30', admission_time: '14:00' }, 'el').errors
    expect([ok.birth_time, ok.admission_time, ok.admission_age_hours]).toEqual([undefined, undefined, undefined])
  })
  it('the form saves the calculated hours and draws the times with the shared time field', () => {
    const page = readSource('src/features/registers/RegisterEntryPage.jsx')
    expect(page).toContain('const saved = { ...values, ...derivedHours(register!.fields, values) }')
    expect(page).toContain("if (field.type === 'time') return <div className={`register-field ${error ? 'has-error' : ''}`}><TimeField")
    expect(page).toContain('disabled={disabled || calculated}')
  })
  it('the database gets the time type from the owner and the fields in every NICU register, without touching FileMaker hours', () => {
    expect(ownerSql).toContain("check (field_type in ('number','date','time','yes_no','choice','multi_choice','gestation','text','computed'))")
    expect(migration).toContain("when 'time' then return 'time';")
    expect(migration).toContain("perform private.register_add_neonatal_times(p_register_id);")
    expect(migration).toContain("for v_id in select id from public.department_registers where template_key = 'nicu' loop")
    expect(migration).toContain("if exists (select 1 from public.department_register_fields where register_id = p_register_id and key = p_field ->> 'key') then return; end if;")
    expect(migration).not.toMatch(/\bdelete\s+from\b|\bdrop\s+(table|function|column)\b|\brevoke\s+all\s+on\s+table\b/i)
    expect(migration).not.toMatch(/update\s+public\.register_nicu/i)
    // The helpers refuse app users; the owner's SQL also revokes them.
    expect(migration.split("if current_user in ('authenticated', 'anon') then raise exception 'Not allowed' using errcode = '42501'; end if;").length - 1).toBe(2)
    expect(ownerSql).toContain('revoke all on function private.register_add_field_after(uuid, text, jsonb) from public, anon, authenticated;')
    expect(ownerSql).toContain('revoke all on function private.register_add_neonatal_times(uuid) from public, anon, authenticated;')
  })
})
