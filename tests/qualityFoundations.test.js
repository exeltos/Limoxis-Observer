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

  it('keeps the incident report out of every menu (it opens from the top bar) and the Quality Center in Quality\'s', () => {
    const keys = role => navigationFor({ role }).map(item => item.key)
    for (const role of Object.values(ROLES)) expect(keys(role), role).not.toContain('reportIncident')
    expect(keys(ROLES.QUALITY_MANAGER)).toContain('quality')
  })

  it('reads incident categories from the library and keeps the short key on records', () => {
    expect(SYSTEM_BASELINE_LIBRARY_KEYS).toContain('incidentCategories')
    expect(DEFAULT_INCIDENT_CATEGORIES.map(([key]) => key)).toEqual(expect.arrayContaining(['clinical', 'medication', 'equipment', 'process', 'complaint', 'staff', 'facility', 'security', 'other', 'fall', 'infection', 'identification']))
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
    expect(draft).toMatchObject({ reportKind: 'report', title: 'Αναφορά από έλεγχο: Θερμοκρασία ψυγείου', department: 'ΜΕΘ', category: 'other', date: '2026-10-15' })
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
    expect(service).toContain("reported_by:reportPrivacy(draft)==='anonymous'?null:userId||null")
    expect(service).toContain("is_anonymous:reportPrivacy(draft)==='anonymous'")
    expect(migration).toContain('add column if not exists is_anonymous boolean not null default false')
    expect(migration).toContain('check (not is_anonymous or (reported_by is null and reported_by_label is null))')
  })

  it('keeps a confidential report with its reporter, who follows it in My reports', async () => {
    const { isOwnReport } = await import('../src/features/quality/MyReportsPage')
    expect(isOwnReport({ privacy: 'confidential', anonymous: false, reportedById: 'u1' }, 'u1')).toBe(true)
    expect(isOwnReport({ privacy: 'anonymous', anonymous: true, reportedById: null }, 'u1')).toBe(false)
    expect(service).toContain("privacy==='named') return {}")
    const sql = fs.readFileSync('supabase/migrations/20261230110000_quality_report_privacy.sql', 'utf8')
    expect(sql).toContain('as restrictive for select')
    expect(sql).not.toMatch(/\bdrop\b|\brevoke\b|alter policy/i)
  })
})

describe('review follow-ups', () => {
  it('prefills both language fields so an English screen sees the control text', () => {
    const draft = incidentPrefill({ controlSource: { controlTitle: 'Fridge', value: 9 } }, 'en')
    expect(draft.titleEn).toBe(draft.title)
    expect(draft.descriptionEn).toBe(draft.description)
    expect(incidentPrefill({ qualitySource: { title: 'X', description: 'Y' } })).toMatchObject({ titleEn: 'X', descriptionEn: 'Y' })
  })

  it('lets the default staff_user account report (from the sidebar button, not a menu entry)', () => {
    expect(can('staff_user', CAPABILITIES.REPORT_INCIDENT)).toBe(true)
    expect(navigationFor({ role: 'staff_user' }).map(item => item.key)).not.toContain('reportIncident')
    expect(migration).toContain("'staff_user'::app_role")
  })

  it('keeps typed names as responsible people and sends report-only users back to their list', () => {
    const fields = fs.readFileSync('src/features/quality/QualityFields.jsx', 'utf8')
    const report = fs.readFileSync('src/features/quality/IncidentReportPage.jsx', 'utf8')
    expect(fields).toContain('allowCustom')
    expect(report).toContain("useContextualNavigation(canViewQuality ? '/quality' : '/quality/my-reports')")
  })
})

describe('phase 2: one register, kinds, WHO harm and sentinel', async () => {
  const { harmLevel, isSentinelHarm, rcaDueDate, incidentCategoryOptions: options, reportKindOf } = await import('../src/features/quality/qualityVocabulary')
  const { withHarm, incidentFlow } = await import('../src/features/quality/qualityRecordRules')
  const { registerRows, filterRegister, registerCounts } = await import('../src/features/quality/qualityRegister')

  it('reads older harm values on the WHO scale and flags death or severe harm as sentinel', () => {
    expect(harmLevel('minor')).toBe('mild')
    expect(harmLevel('major')).toBe('severe')
    expect(isSentinelHarm('death')).toBe(true)
    expect(isSentinelHarm('moderate')).toBe(false)
    expect(rcaDueDate('2026-10-01')).toBe('2026-11-15')
    expect(withHarm({ impact: 'mild' }, 'severe')).toMatchObject({ impact: 'severe', sentinel: true })
    expect(withHarm({ impact: 'severe', sentinel: true }, 'moderate').sentinel).toBe(false)
    expect(withHarm({ impact: 'mild', sentinel: true }, 'moderate').sentinel).toBe(true)
  })

  it('offers each kind its own categories and gives older records a kind from their category', () => {
    const complaint = options([], 'el', 'complaint').map(option => option.value)
    expect(complaint).toContain('complaintwaiting')
    expect(complaint).not.toContain('fall')
    expect(options([], 'el', 'clinical').map(option => option.value)).toContain('fall')
    expect(reportKindOf({ category: 'equipment' })).toBe('nonClinical')
    expect(reportKindOf({ reportKind: 'suggestion', category: 'other' })).toBe('suggestion')
  })

  it('puts reports and deviations without CAPA in one register with their source', () => {
    const rows = registerRows([{ id: 'INC-1', title: 'A', date: '2026-10-02', status: 'reported', category: 'fall', sentinel: true }], [{ key: 'control:e1', kind: 'control', sourceId: 'CTRL-1#e1', title: 'Fridge', at: '2026-10-05T08:00:00Z', priority: 'high', path: '/controls/CTRL-1' }])
    expect(rows.map(row => row.source)).toEqual(['control', 'report'])
    expect(rows[0]).toMatchObject({ type: 'deviation', status: 'withoutCapa', code: 'CTRL-1' })
    expect(filterRegister(rows, { quick: 'sentinel' }).map(row => row.id)).toEqual(['INC-1'])
    expect(filterRegister(rows, { kind: 'deviation' })).toHaveLength(1)
    expect(registerCounts(rows)).toMatchObject({ total: 2, open: 1, sentinel: 1, deviations: 1 })
  })

  it('shows where an incident stands: reported, assessed, CAPA, effective, closed', () => {
    const status = (record, capas) => incidentFlow(record, capas).map(step => step.status)
    expect(status({ status: 'reported' })).toEqual(['done', 'current', 'todo', 'todo', 'todo'])
    expect(status({ status: 'underReview' }, [{ effectivenessStatus: 'pending' }])).toEqual(['done', 'done', 'done', 'current', 'todo'])
    expect(status({ status: 'closed' }, [{ effectivenessStatus: 'effective' }])).toEqual(['done', 'done', 'done', 'done', 'done'])
    expect(status({ status: 'closed' })).toEqual(['done', 'done', 'skipped', 'skipped', 'done'])
  })

  it('stores the kind, the sentinel flag and the root cause analysis due date', () => {
    expect(migration).toContain("check (report_kind in ('clinical','nonClinical','complaint','suggestion'))")
    expect(migration).toContain('add column if not exists is_sentinel boolean not null default false')
    expect(service).toContain('is_sentinel:Boolean(record.sentinel)')
  })
})
