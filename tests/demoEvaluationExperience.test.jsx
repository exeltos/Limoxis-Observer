// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'
import { DemoGuideDialog } from '../src/features/demo/DemoGuideDialog'
import { DemoApplicationDialog } from '../src/features/demo/DemoApplicationDialog'
import { DEMO_SCENARIOS } from '../src/features/demo/demoScenarios'
import { DEMO_REPORT_MARK_EL, isDemoReport, setReportBranding } from '../src/core/organization/branding'

const read = path => fs.readFileSync(path, 'utf8')
const migration = read('supabase/migrations/20261014120000_demo_evaluation_experience.sql')
const outbox = read('supabase/functions/process-notification-outbox/index.ts')
const pdf = read('src/core/export/pdfReportExport.js')
const wrap = node => <LanguageProvider>{node}</LanguageProvider>

afterEach(() => { cleanup(); setReportBranding(null) })

describe('Evaluation guide', () => {
  it('lists six scenarios, each opening its screen, and lets the evaluator mark them', () => {
    const onOpenScenario = vi.fn(), onToggle = vi.fn()
    render(wrap(<DemoGuideDialog language="el" progress={{ patient_admission: '2026-10-08T10:00:00Z' }} onOpenScenario={onOpenScenario} onToggle={onToggle} onClose={vi.fn()}/>))
    expect(DEMO_SCENARIOS).toHaveLength(6)
    expect(screen.getByText('1 από 6 ολοκληρωμένα')).toBeInTheDocument()
    fireEvent.click(screen.getAllByText('Ξεκινήστε')[1])
    expect(onOpenScenario).toHaveBeenCalledWith(DEMO_SCENARIOS[1])
    fireEvent.click(screen.getAllByText('Το έκανα')[0])
    expect(onToggle).toHaveBeenCalledWith('clabsi_classification', true)
  })
  it('keeps progress per evaluator in a table that "Reset data" leaves alone', () => {
    expect(migration).toContain('demo_organization_id uuid not null references public.organizations(id) on delete cascade')
    expect(migration).not.toMatch(/create table if not exists public\.demo_evaluation_progress \([^;]*\borganization_id uuid/)
    expect(migration).toContain("raise exception 'Not a member of this Demo'")
  })
})

describe('"I want the application"', () => {
  it('sends the contact details, with the e-mail fixed to the signed-in account', () => {
    const onSubmit = vi.fn()
    render(wrap(<DemoApplicationDialog language="el" organizationName="Demo" defaultName="Αξιολογητής" email="eval@example.com" onSubmit={onSubmit} onClose={vi.fn()}/>))
    expect(screen.getByDisplayValue('eval@example.com')).toHaveAttribute('readonly')
    fireEvent.click(screen.getByText('Αποστολή αιτήματος'))
    expect(onSubmit).toHaveBeenCalledWith({ contactName: 'Αξιολογητής', contactPhone: '', message: '' })
  })
  it('stores the request, writes the audit log and e-mails every Platform Owner, at most three a day', () => {
    expect(migration).toContain("'platform.demo.application_requested'")
    expect(migration).toMatch(/insert into public\.notification_outbox[\s\S]*'demo_application_request'[\s\S]*where coalesce\(p\.is_platform_owner, false\)/)
    expect(migration).toContain("raise exception 'Too many requests today'")
    expect(outbox).toContain("'demo_application_request'")
  })
  it('never e-mails the synthetic people of a Demo', () => {
    expect(outbox).toContain("last_error:'DEMO_SYNTHETIC_RECIPIENT'")
    expect(outbox).toMatch(/organization\?\.is_demo\?rows\.filter\(row=>\/\\\.invalid\$\/i/)
  })
})

describe('DEMO mark on reports', () => {
  it('is on for a Demo organization only', () => {
    setReportBranding({ name: 'Νοσοκομείο', demo: false })
    expect(isDemoReport()).toBe(false)
    setReportBranding({ name: 'Demo', demo: true })
    expect(isDemoReport()).toBe(true)
    expect(DEMO_REPORT_MARK_EL).toMatch(/^DEMO/)
  })
  it('marks every PDF page and every CSV of a Demo', () => {
    expect(pdf).toContain('if(demo)drawDemoMark(pdf,pageWidth,pageHeight)')
    expect(read('src/core/export/csvExport.js')).toContain('[...(demo?[[DEMO_REPORT_MARK_EL]]:[]),headers,...rows]')
  })
})
