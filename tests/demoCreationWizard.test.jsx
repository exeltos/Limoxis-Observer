// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'
import { DemoCreateWizard, emptyDemoWizardDraft, wizardAdmin } from '../src/features/platform/DemoCreateWizard'

const read = path => fs.readFileSync(path, 'utf8')
const migration = read('supabase/migrations/20261016120000_demo_creation_wizard.sql')
const createDemo = read('supabase/functions/create-demo-access/index.ts')
const createUser = read('supabase/functions/create-organization-user/index.ts')
const wrap = node => <LanguageProvider>{node}</LanguageProvider>

afterEach(() => cleanup())

const draft = (patch = {}) => ({ ...emptyDemoWizardDraft(30), label: 'Γ.Ν. Λάρισας', contactName: 'Αθηνά Κ.', contactEmail: 'athina@larisa.example', ...patch })

describe('New Demo wizard', () => {
  it('creates one user, the Hospital Admin, from the contact person unless someone else is named', () => {
    expect(wizardAdmin(draft())).toEqual({ fullName: 'Αθηνά Κ.', email: 'athina@larisa.example', role: 'hospital_admin', departmentCode: null, access: 'invite' })
    expect(wizardAdmin(draft({ adminName: 'Νίκος Π.', adminEmail: 'Nikos@Larisa.example', access: 'password' }))).toEqual({ fullName: 'Νίκος Π.', email: 'nikos@larisa.example', role: 'hospital_admin', departmentCode: null, access: 'password' })
  })
  it('moves through the three steps and sends the admin', () => {
    const onSubmit = vi.fn()
    render(wrap(<DemoCreateWizard language="el" maxUsers={5} initialDraft={draft()} onSubmit={onSubmit} onClose={vi.fn()}/>))
    fireEvent.click(screen.getByText('Επόμενο'))
    expect(screen.getByText(/έως 5 συνολικά/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Επόμενο'))
    fireEvent.click(screen.getByText('Δημιουργία Demo'))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ label: 'Γ.Ν. Λάρισας', evaluators: [expect.objectContaining({ email: 'athina@larisa.example', role: 'hospital_admin' })] }))
  })
  it('shows a temporary password once after creation', () => {
    render(wrap(<DemoCreateWizard language="el" result={{ organization: { name: 'Γ.Ν. Λάρισας' }, evaluators: [{ fullName: 'Μαρία', role: 'hospital_admin', username: 'MO19084', temporaryPassword: 'Lx7k-R4pW-m2qT' }] }} onClose={vi.fn()}/>))
    expect(screen.getByText('Lx7k-R4pW-m2qT')).toBeInTheDocument()
    expect(screen.getByText('MO19084')).toBeInTheDocument()
  })
})

describe('Demo data and user limit', () => {
  it('has a platform limit on the users of a Demo', () => {
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
