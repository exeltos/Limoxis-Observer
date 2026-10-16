import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { navigationFor } from '../src/app/navigation'
import { can, CAPABILITIES, ROLES } from '../src/core/permissions/roles'
import { demoLibrarySeed } from '../src/features/management/managementData'
import { SYSTEM_BASELINE_LIBRARY_KEYS } from '../src/features/management/libraryGovernance'
import { DEFAULT_INCIDENT_CATEGORIES, incidentCategoryLabel, incidentCategoryOptions, incidentCategoryValue, qualityStatusTone } from '../src/features/quality/qualityVocabulary'
import { incidentPrefill } from '../src/features/quality/IncidentReportPage'

const migration = fs.readFileSync('supabase/migrations/20261103100000_quality_foundations.sql', 'utf8')
const previous = fs.readFileSync('supabase/migrations/20261102100000_controls_reference_libraries.sql', 'utf8')
const service = fs.readFileSync('src/features/quality/qualityService.js', 'utf8')

describe('Quality foundations', () => {
  it('lets every role report an incident', () => {
    for (const role of Object.values(ROLES)) expect(can(role, CAPABILITIES.REPORT_INCIDENT), role).toBe(true)
  })

  it('gives staff without the Quality Center the report form in the menu', () => {
    const keys = role => navigationFor({ role }).map(item => item.key)
    expect(keys(ROLES.DEPARTMENT_USER)).toContain('reportIncident')
    expect(keys(ROLES.LABORATORY)).toContain('reportIncident')
    expect(keys(ROLES.QUALITY_MANAGER)).not.toContain('reportIncident')
    expect(keys(ROLES.QUALITY_MANAGER)).toContain('quality')
  })

  it('reads incident categories from the library and keeps the short key on records', () => {
    expect(SYSTEM_BASELINE_LIBRARY_KEYS).toContain('incidentCategories')
    expect(DEFAULT_INCIDENT_CATEGORIES.map(([key]) => key)).toEqual(['clinical', 'medication', 'equipment', 'process', 'complaint', 'staff', 'facility', 'security', 'other'])
    const items = [{ value: 'Φάρμακο', code: 'INC-MEDICATION', el: 'Φάρμακο', en: 'Medication' }, { value: 'Πτώση', code: null, el: 'Πτώση', en: 'Fall' }]
    expect(incidentCategoryOptions(items, 'en').map(option => option.value)).toEqual(['medication', 'Πτώση'])
    expect(incidentCategoryValue(items[0])).toBe('medication')
    expect(incidentCategoryLabel('medication', items, 'en')).toBe('Medication')
    expect(incidentCategoryLabel('Πτώση', items, 'el')).toBe('Πτώση')
    expect(incidentCategoryLabel('complaint', [], 'el')).toBe('Παράπονο (ασθενούς / συνοδού)')
  })

  it('seeds the same categories in the Demo and the database, keeping every earlier baseline row', () => {
    const lines = previous.split('\n').filter(line => /^ {4}\('/.test(line)).map(line => line.replace(/,$/, ''))
    for (const line of lines) expect(migration).toContain(line)
    for (const [, , meta] of demoLibrarySeed.incidentCategories) expect(migration).toContain(`('incidentCategories','${meta.code}',`)
    expect(migration).toContain('on conflict (organization_id,library_key,name_el) do nothing')
  })

  it('opens the older Quality tables to the capabilities, not only the roles', () => {
    expect(migration).toContain("current_user_has_capability(organization_id, 'view_quality')")
    expect(migration).toContain("current_user_has_capability(organization_id, 'report_incident')")
    expect(migration).toContain("'link_nurse'::app_role")
    for (const policy of ['quality_incident_org_read', 'quality_incident_report', 'quality_incident_manage', 'quality_finding_authorized_read', 'quality_capa_authorized_read', 'quality_audit_authorized_read']) expect(migration).toContain(`alter policy ${policy} `)
  })

  it('saves the department id and the responsible user, never a name as an id', () => {
    expect(service).toContain('department_id:isUuid(record.departmentId)?record.departmentId:null')
    expect(service).toContain('owner_id:isUuid(record.ownerId)?record.ownerId:null')
    expect(service).toContain("...(section==='audits'?{}:{owner_id")
  })

  it('prefills a report from a control entry with a finding', () => {
    const draft = incidentPrefill({ controlSource: { controlTitle: 'Θερμοκρασία ψυγείου', department: 'ΜΕΘ', value: 11, notes: 'Πάνω από 8°C', scheduledAt: '2026-10-15T08:00:00Z' } })
    expect(draft).toMatchObject({ title: 'Απόκλιση στον έλεγχο: Θερμοκρασία ψυγείου', department: 'ΜΕΘ', category: 'process', date: '2026-10-15' })
    expect(draft.description).toContain('Καταγεγραμμένη τιμή: 11')
    expect(incidentPrefill({})).toBeNull()
  })

  it('shows statuses with the shared tones', () => {
    expect(qualityStatusTone('closed')).toBe('success')
    expect(qualityStatusTone('verification')).toBe('warning')
    expect(qualityStatusTone('reported')).toBe('info')
  })
})

describe('anonymous and own incident reports', () => {
  it('lists only the reporter’s own named reports', async () => {
    const { isOwnReport } = await import('../src/features/quality/MyReportsPage')
    expect(isOwnReport({ reportedById: 'u1' }, 'u1')).toBe(true)
    expect(isOwnReport({ reportedById: 'u2' }, 'u1')).toBe(false)
    expect(isOwnReport({ reportedById: 'u1', anonymous: true }, 'u1')).toBe(false)
    expect(isOwnReport({ reportedById: null }, null)).toBe(false)
  })

  it('stores no reporter on an anonymous report, in the app and in the database', () => {
    expect(service).toContain('reported_by:draft.anonymous?null:userId||null')
    expect(service).toContain('is_anonymous:Boolean(draft.anonymous)')
    expect(migration).toContain('add column if not exists is_anonymous boolean not null default false')
    expect(migration).toContain('check (not is_anonymous or (reported_by is null and reported_by_label is null))')
  })
})
