// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'
import { DemoCreateWizard, emptyDemoWizardDraft, evaluatorProblems, wizardEvaluators } from '../src/features/platform/DemoCreateWizard'

const read = path => fs.readFileSync(path, 'utf8')
const migration = read('supabase/migrations/20261016120000_demo_creation_wizard.sql')
const createDemo = read('supabase/functions/create-demo-access/index.ts')
const createUser = read('supabase/functions/create-organization-user/index.ts')
const wrap = node => <LanguageProvider>{node}</LanguageProvider>

afterEach(() => cleanup())

const draft = (patch = {}) => ({ ...emptyDemoWizardDraft(30), label: 'Γ.Ν. Λάρισας', contactName: 'Αθηνά Κ.', contactEmail: 'athina@larisa.example', ...patch })

describe('New Demo wizard', () => {
  it('makes the contact person the first evaluator, as Hospital Admin with an email invitation', () => {
    expect(wizardEvaluators(draft())).toEqual([{ fullName: 'Αθηνά Κ.', email: 'athina@larisa.example', role: 'hospital_admin', departmentCode: null, access: 'invite' }])
  })
  it('checks the evaluators: limit, names, emails, duplicates and one Hospital Admin', () => {
    const user = (email, role = 'hospital_admin') => ({ fullName: 'Χ', email, role, departmentCode: null, access: 'invite' })
    expect(evaluatorProblems([user('a@x.gr')], 5)).toEqual([])
    expect(evaluatorProblems([user('a@x.gr'), user('a@x.gr')], 5)).toContain('duplicate')
    expect(evaluatorProblems([user('a@x.gr', 'pharmacy')], 5)).toContain('admin')
    expect(evaluatorProblems([user('a@x.gr'), user('b@x.gr')], 1)).toContain('too_many')
    expect(evaluatorProblems([user('not-an-email')], 5)).toContain('email')
  })
  it('keeps a department only for department roles', () => {
    const rows = [{ key: 'a', fullName: 'Α', email: 'a@x.gr', role: 'department_manager', departmentCode: 'ΚΑΡΔ', access: 'password' }, { key: 'b', fullName: 'Β', email: 'b@x.gr', role: 'hospital_admin', departmentCode: 'ΚΑΡΔ', access: 'invite' }]
    expect(wizardEvaluators(draft({ evaluators: rows }))).toEqual([
      { fullName: 'Α', email: 'a@x.gr', role: 'department_manager', departmentCode: 'ΚΑΡΔ', access: 'password' },
      { fullName: 'Β', email: 'b@x.gr', role: 'hospital_admin', departmentCode: null, access: 'invite' },
    ])
  })
  it('moves through the four steps and sends the scenario and evaluators', () => {
    const onSubmit = vi.fn()
    render(wrap(<DemoCreateWizard language="el" initialDraft={draft()} onSubmit={onSubmit} onClose={vi.fn()}/>))
    fireEvent.click(screen.getByText('Επόμενο'))
    fireEvent.click(screen.getByText('Μόνο επιτήρηση'))
    fireEvent.click(screen.getByText('Επόμενο'))
    expect(screen.getByText('1 / 5')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Επόμενο'))
    fireEvent.click(screen.getByText('Δημιουργία Demo'))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ label: 'Γ.Ν. Λάρισας', seedProfile: 'surveillance', evaluators: [expect.objectContaining({ email: 'athina@larisa.example', role: 'hospital_admin' })] }))
  })
  it('shows a temporary password once after creation', () => {
    render(wrap(<DemoCreateWizard language="el" result={{ organization: { name: 'Γ.Ν. Λάρισας' }, evaluators: [{ fullName: 'Μαρία', role: 'department_manager', username: 'MO19084', temporaryPassword: 'Lx7k-R4pW-m2qT' }] }} onClose={vi.fn()}/>))
    expect(screen.getByText('Lx7k-R4pW-m2qT')).toBeInTheDocument()
    expect(screen.getByText('MO19084')).toBeInTheDocument()
  })
})

describe('Demo data scenarios and evaluator limit', () => {
  it('fills a Demo with its scenario on creation and on reset', () => {
    expect(migration).toContain("check (seed_profile in ('full', 'surveillance', 'empty'))")
    expect(migration).toContain('return private.demo_seed_data(v_org, p_actor);')
    expect(migration).toMatch(/return private\.demo_seed_profile\(p_organization_id, auth\.uid\(\),\s+coalesce\(\(select e\.seed_profile/)
    expect(migration).toContain('max_demo_users integer not null default 5')
  })
  it('writes the data before inviting anyone and sends the Limoxis Demo email', () => {
    expect(createDemo.indexOf("caller.rpc('platform_reset_demo_organization'")).toBeLessThan(createDemo.indexOf('for(const evaluator of list)results.push'))
    expect(createDemo).toContain("admin.auth.admin.generateLink({type:'invite'")
    expect(createDemo).toContain('demoAccessEmail({contactName:evaluator.fullName')
    expect(createDemo).toContain("event_type:'platform.demo.created'")
  })
  it('limits the users of a Demo, also when its own Hospital Admin adds them', () => {
    expect(createDemo).toContain("if((count||0)>=maxUsers)return reply")
    expect(createUser).toContain("if(!profile?.is_platform_owner&&(memberCount||0)>=maxUsers)return reply")
    expect(createUser).toContain("code:'DEMO_USER_LIMIT'")
  })
})
