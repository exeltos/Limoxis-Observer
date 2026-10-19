import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { APPLICATION_STEPS, CONSENTS, LIMITS, applicationErrorText, applicationPath, applicationProblems, cleanApplication, demoApplication, firstStepWithProblems, formatCode, isDemoToken, maskDay, maskMonth, newApplication, normalizeCode, parseDay, parseMonth, stepProblems, validCode } from '../src/features/interviews/applicationModel'
import { LEVELS, certificateLabel, languageSkillsText, levelLabel } from '../src/features/interviews/interviewsModel'

const fields = problems => problems.map(([field]) => field)
const sql = fs.readFileSync('supabase/migrations/20261129300000_hr_application_tablet.sql', 'utf8')

describe('Tablet application: steps and validation', () => {
  it('has the nine steps in order', () => {
    expect(APPLICATION_STEPS.map(([key]) => key)).toEqual(['welcome', 'personal', 'contact', 'education', 'languages', 'experience', 'about', 'consents', 'review'])
  })

  it('asks per step only for what that step needs', () => {
    const draft = newApplication()
    expect(stepProblems('welcome', draft)).toEqual([])
    expect(fields(stepProblems('personal', draft, 'en'))).toEqual(['lastName', 'firstName'])
    expect(fields(stepProblems('personal', { ...draft, lastName: 'Νικολάου', firstName: 'Ελένη', birthDate: '31/02/1990', children: '40' }))).toEqual(['birthDate', 'children'])
    expect(fields(stepProblems('personal', { ...draft, lastName: 'Νικολάου', firstName: 'Ελένη', birthDate: '01/01/2020' }, 'el', '2026-10-19'))).toEqual(['birthDate'])
    expect(fields(stepProblems('contact', draft))).toEqual(['phoneMobile'])
    expect(fields(stepProblems('contact', { ...draft, phoneMobile: '69 0000 0123', email: 'no-at', postcode: '412' }))).toEqual(['email', 'postcode'])
    expect(stepProblems('education', draft)).toEqual([])
    expect(fields(stepProblems('education', { ...draft, education: [{ title: '', school: '', year: '19' }] }))).toEqual(['education.0.title', 'education.0.year'])
    expect(fields(stepProblems('languages', draft))).toEqual(['languages.0.levels'])
    expect(stepProblems('languages', { ...draft, languages: [{ language: 'el', speaking: 'fluent' }] })).toEqual([])
    expect(fields(stepProblems('experience', { ...draft, employers: [{ employer: '', from: '13/2020', to: '01/2019' }] }))).toEqual(['employers.0.employer', 'employers.0.from'])
    expect(fields(stepProblems('experience', { ...draft, employers: [{ employer: 'Χ', from: '05/2020', to: '01/2019' }] }))).toEqual(['employers.0.to'])
    expect(stepProblems('experience', { ...draft, employers: [{ employer: 'Χ', from: '05/2020', current: true, to: 'x' }] })).toEqual([])
    expect(fields(stepProblems('consents', { ...draft, consents: { gdpr: true } }))).toEqual(['consents.truth', 'signature'])
  })

  it('sends the candidate back to the first step with something missing', () => {
    const draft = demoApplication()
    expect(applicationProblems(draft)).toEqual([])
    expect(firstStepWithProblems({ ...draft, phoneMobile: '' })).toBe(2)
    expect(firstStepWithProblems({ ...draft, consents: { ...draft.consents, gdpr: false } })).toBe(7)
    expect(stepProblems('review', { ...draft, signature: '' }).map(([field]) => field)).toEqual(['signature'])
  })

  it('reads the dates typed on the tablet and masks them while typing', () => {
    expect(parseDay('14/03/1996')).toBe('1996-03-14')
    expect(parseDay('29/02/2023')).toBeNull()
    expect(parseDay('')).toBe('')
    expect(parseMonth('6/2019')).toBe('2019-06-01')
    expect(parseMonth('13/2019')).toBeNull()
    expect(maskDay('14031996')).toBe('14/03/1996')
    expect(maskMonth('0620199')).toBe('06/2019')
  })
})

describe('Tablet application: the payload', () => {
  it('trims, limits and keeps only known values', () => {
    const draft = { ...demoApplication(), lastName: '  Νικολάου \u0007', firstName: ' Ελένη  Μαρία ', gender: 'robot', children: '45', email: ' E.Nikolaou@Example.org ', whyUs: 'Α\r\nΒ\u0000',
      education: Array.from({ length: 14 }, (_, i) => ({ title: `Τίτλος ${i}`, school: '', year: i ? '' : '19x9' })).concat([{ title: '', school: '', year: '2020' }]),
      languages: [{ language: 'en', speaking: 'superb', reading: 'very_good', writing: 'fair', certificate: false, certificateName: 'κρυφό' }, { language: ' ', speaking: 'fluent' }],
      employers: [{ employer: 'Κλινική', from: '05/2020', to: '01/2021', current: true, jobTitle: 'Νοσηλεύτρια', leavingReason: '' }, { employer: '', from: '01/2010' }],
      consents: { gdpr: 'yes', truth: true, future: 1 }, signature: 'data:image/svg+xml;base64,AAAA' }
    const payload = cleanApplication(draft, { language: 'en' })
    expect(payload).toMatchObject({ language: 'en', fullName: 'Νικολάου Ελένη Μαρία', gender: '', children: '', email: 'e.nikolaou@example.org', whyUs: 'Α\nΒ', birthDate: '1996-03-14', signature: '' })
    expect(payload.education).toHaveLength(LIMITS.education)
    expect(payload.education[0]).toEqual({ title: 'Τίτλος 0', school: '', year: '', completed: true })
    expect(payload.languages).toEqual([{ language: 'en', speaking: '', reading: 'very_good', writing: 'fair', certificate: false, certificateName: '' }])
    expect(payload.employers).toEqual([{ employer: 'Κλινική', fromOn: '2020-05-01', toOn: '', jobTitle: 'Νοσηλεύτρια', leavingReason: '' }])
    expect(payload.consents).toEqual({ gdpr: false, future: false, references: false, truth: true })
    expect(cleanApplication(demoApplication()).signature.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('shows and accepts the link code in groups of four', () => {
    expect(normalizeCode('abcd-efgh 2345')).toBe('ABCDEFGH2345')
    expect(formatCode('ABCDEFGH2345')).toBe('ABCD-EFGH-2345')
    expect(validCode('abcd-efgh-2345')).toBe(true)
    expect(validCode('ABCD-EFGH-IO01')).toBe(false)
    expect(isDemoToken('demo')).toBe(true)
    expect(applicationPath('ABCDEFGH2345')).toBe('/apply/ABCD-EFGH-2345')
    expect(applicationPath('demo')).toBe('/apply/demo')
    expect(applicationErrorText(new Error('HR_APPLICATION_USED'), 'en')).toContain('already been used')
  })
})

describe('Language levels and the three skills', () => {
  it('names every level in full and prints speaking, reading and writing', () => {
    expect(Object.keys(LEVELS)).toEqual(['fluent', 'very_good', 'good', 'fair', 'basic'])
    expect(levelLabel('fluent')).toBe('Άριστα (ευχερώς)')
    expect(levelLabel('fair')).toBe('Μέτρια')
    expect(languageSkillsText({ language: 'en', speaking: 'fluent', reading: 'good', writing: 'fair', certificate: true, certificateName: 'B2' })).toBe('Αγγλικά — Ομιλία: Άριστα (ευχερώς) · Ανάγνωση: Καλά · Γραφή: Μέτρια · Πιστοποιητικό: B2')
    expect(languageSkillsText({ language: 'el', speaking: 'very_good' }, 'en')).toBe('Greek — Speaking: Very good')
    expect(certificateLabel({ certificate: false }, 'en')).toBe('No certificate')
    const sources = ['src/features/interviews/InterviewRecordPage.jsx', 'src/features/interviews/interviewsReports.js', 'src/features/interviews/apply/ApplicationPage.jsx'].map(file => fs.readFileSync(file, 'utf8')).join('\n')
    expect(sources).not.toMatch(/Copy2|ΕΥΧ|ΜΕΤΡ/)
  })
})

describe('Tablet application: database', () => {
  it('keeps the same consent texts as the app', () => {
    for (const consent of CONSENTS) { expect(sql).toContain(`'${consent.key}', '${consent.text.el}'`); expect(sql).toContain(`'${consent.key}', '${consent.text.en}'`) }
    expect(sql).toContain("'version', '2026-10', 'retentionMonths', 24")
  })

  it('stores only the hash of a single-use, 24-hour link bound to the organization and position', () => {
    expect(sql).toContain("encode(sha256(convert_to(v_code, 'UTF8')), 'hex')")
    expect(sql).toContain("l.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')")
    expect(sql).toContain("interval '24 hours'")
    expect(sql).toContain("public.current_user_has_capability(p_organization_id, 'manage_interviews')")
    expect(sql).toContain('set used_at = now() where l.id = v_link.id and l.used_at is null')
    expect(sql).toContain("raise exception 'HR_APPLICATION_USED'")
    expect(sql).toContain("raise exception 'HR_APPLICATION_EXPIRED'")
    expect(sql).toContain("coalesce(v_link.requested_position, private.hr_app_t(v_p, 'requestedPosition', 160))")
  })

  it('lets anon only see the welcome step and submit one application, rate-limited', () => {
    expect(sql).toContain('grant execute on function public.hr_application_public(text) to anon, authenticated;')
    expect(sql).toContain('grant execute on function public.hr_application_submit(text, jsonb) to anon, authenticated;')
    expect(sql).toContain('revoke all on function public.hr_application_link_create(uuid, text) from public, anon;')
    expect(sql).toContain('revoke all on public.hr_candidate_signatures from anon;')
    expect(sql).toContain("interval '1 minute') >= 10")
    expect(sql).toContain("raise exception 'HR_APPLICATION_CONSENT_REQUIRED'")
    expect(sql).toContain("raise exception 'HR_APPLICATION_SIGNATURE_REQUIRED'")
    expect(sql).toContain("'new', 'tablet', v_link.id")
    expect(sql).toMatch(/where n <= 12/)
    expect(sql).toMatch(/where n <= 15/)
    const publicBody = sql.slice(sql.indexOf('create or replace function public.hr_application_public'), sql.indexOf('revoke all on function public.hr_application_public'))
    expect(publicBody).not.toMatch(/hr_candidates/)
    const manifest = JSON.parse(fs.readFileSync('supabase/security-definer-manifest.json', 'utf8')).functions
    expect(manifest.hr_application_submit).toMatchObject({ category: 'public-token', anon: true })
    expect(manifest.hr_application_link_create).toMatchObject({ category: 'rpc', authenticated: true })
    expect(manifest.hr_application_link_create.anon).toBeUndefined()
  })

  it('adds the consent columns, the «tablet» source and the «very good» level', () => {
    for (const column of ['consent_future', 'consent_references', 'declaration_truth', 'consent_version', 'consent_texts', 'signed_at']) expect(sql).toContain(`add column if not exists ${column}`)
    expect(sql).toContain("check (source in ('app','filemaker','demo','tablet'))")
    expect(sql).toContain("check (speaking in ('fluent','very_good','good','fair','basic'))")
  })
})
