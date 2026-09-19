import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const migration = fs.readFileSync('supabase/migrations/20260919290000_add_antimicrobial_therapy_administrations.sql', 'utf8')
const service = fs.readFileSync('src/features/surveillance/clinicalCloudService.js', 'utf8')
const repository = fs.readFileSync('src/features/surveillance/clinicalRepository.js', 'utf8')
const page = fs.readFileSync('src/features/surveillance/PatientClinicalCanonicalPage.jsx', 'utf8')

describe('Antimicrobial therapy: "plan" (order) and "administration" are now separate entities', () => {
  it('adds a dedicated, append-only administrations table distinct from the therapy order', () => {
    expect(migration).toContain('create table public.antimicrobial_therapy_administrations')
    expect(migration).toContain('therapy_id uuid not null references public.antimicrobial_therapies(id)')
    expect(migration).not.toContain('for update')
    expect(migration).toContain('antimicrobial_therapy_administrations_delete')
    expect(migration).toContain('current_user_is_platform_owner()')
  })

  it('requires a reason whenever a dose is withheld or refused, not just when administered', () => {
    expect(migration).toContain("status = 'administered' or coalesce(trim(withheld_reason),'') <> ''")
  })

  it('blocks recording an administration while stewardship approval is pending or rejected', () => {
    expect(migration).toContain('create or replace function public.enforce_therapy_approved_before_administration()')
    expect(migration).toContain("if therapy_approval not in ('not_required','approved') then")
    expect(migration).toContain('before insert on public.antimicrobial_therapy_administrations')
  })

  it('finally wires up approval_status instead of always writing "not_required"', () => {
    expect(service).toContain("draft.isAdvancedAntibiotic?'pending':(draft.approvalStatus||'not_required')")
    expect(repository).toContain("draft.isAdvancedAntibiotic?'pending':(draft.approvalStatus||'not_required')")
  })

  it('exposes approve/reject and record-administration operations end to end', () => {
    expect(service).toContain('export async function setTherapyApproval(')
    expect(service).toContain('export async function recordTherapyAdministration(')
    expect(repository).toContain('async function updateTherapyApproval(')
    expect(repository).toContain('async function recordAdministration(')
    expect(page).toContain('onApproveTherapy')
    expect(page).toContain('onRejectTherapy')
    expect(page).toContain('onRecordAdministration')
  })

  it('hydrates each therapy with its own administration history, scoped by therapy id', () => {
    expect(service).toContain("from('antimicrobial_therapy_administrations')")
    expect(service).toContain('administrations.filter(a=>a.therapy_id===row.id)')
  })

  it('blocks the "Record administration" action in the UI while approval is pending, matching the database gate', () => {
    expect(page).toContain("canAdminister=row.status==='active'&&!pendingApproval&&row.approvalStatus!=='rejected'")
  })
})
