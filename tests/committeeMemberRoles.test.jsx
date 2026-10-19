// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import fs from 'node:fs'

vi.mock('../src/core/supabase/client', () => ({ supabase: null }))

import {
  effectiveMemberRoles,
  memberBadgeRoles,
  normalizeMemberRoles,
  officerName,
  rolesFromTitle,
  sortMembersByRole,
} from '../src/features/committees/committeeMemberRoles'
import { fromMemberRow } from '../src/features/committees/committeeService'
import { memberRolesFor } from '../src/features/committees/committeeWorkflowService'
import { Members } from '../src/features/committees/CommitteeRecordSections'

afterEach(cleanup)

describe('committee member roles', () => {
  it('derives structured roles from the roster titles', () => {
    expect(rolesFromTitle('Πρόεδρος & Συντονιστής')).toEqual(['chair', 'coordinator'])
    expect(rolesFromTitle('ΠΡΟΕΔΡΟΣ')).toEqual(['chair'])
    expect(rolesFromTitle('Αντιπρόεδρος')).toEqual(['vice_chair'])
    expect(rolesFromTitle('Μέλος – Αναπληρωτής Προέδρου')).toEqual(['deputy_chair'])
    expect(rolesFromTitle('ΜΕΛΟΣ-ΑΝΑΠΛΗΡΩΤΗΣ ΠΡΟΕΔΡΕΥΟΝΤΟΣ')).toEqual(['deputy_chair'])
    expect(rolesFromTitle('Συντονίστρια')).toEqual(['coordinator'])
    expect(rolesFromTitle('ΜΕΛΟΣ-\nΣΥΝΟΝΙΣΤΗΣ ΚΛΙΝΙΚΟΥ ΕΛΕΓΧΟΥ')).toEqual(['coordinator'])
    expect(rolesFromTitle('Γραμματέας')).toEqual(['secretary'])
    expect(rolesFromTitle('Μέλος')).toEqual(['member'])
    expect(rolesFromTitle('')).toEqual(['member'])
  })

  it('keeps only known roles in a stable order', () => {
    expect(normalizeMemberRoles(['coordinator', 'bogus', 'chair'])).toEqual([
      'chair',
      'coordinator',
    ])
    expect(normalizeMemberRoles(null)).toEqual(['member'])
  })

  it('orders chair, vice/deputy chair and coordinators before members, former members last', () => {
    const rows = [
      { id: 'a', name: 'A', roles: ['member'] },
      { id: 'b', name: 'B', roles: ['coordinator'] },
      { id: 'c', name: 'C', roles: ['chair'], active: false },
      { id: 'd', name: 'D', roles: ['chair', 'coordinator'] },
      { id: 'e', name: 'E', roles: ['deputy_chair'] },
    ]
    expect(sortMembersByRole(rows).map(x => x.id)).toEqual(['d', 'e', 'b', 'a', 'c'])
  })

  it('names the active chair from roles and falls back to the title', () => {
    const rows = [
      { name: 'Former', roles: ['chair'], active: false },
      { name: 'Deputy', roles: ['deputy_chair'], committeeTitle: 'Μέλος – Αναπληρωτής Προέδρου' },
      { name: 'Chair', roles: ['chair', 'coordinator'] },
    ]
    expect(officerName(rows, 'chair', /^πρόεδρ/i)).toBe('Chair')
    expect(officerName([{ name: 'Old', committeeTitle: 'Πρόεδρος' }], 'chair', /^πρόεδρ/i)).toBe(
      'Old',
    )
  })

  it('maps role, specialty and responsibilities from the database row', () => {
    const member = fromMemberRow({
      id: 'm1',
      member_name: 'Member',
      title: 'Πρόεδρος & Συντονιστής',
      member_roles: ['chair', 'coordinator'],
      specialty: 'Παθολόγος',
      responsibilities: 'Συντονίζει',
      has_vote: true,
      approval_status: 'not_required',
      ended_at: null,
    })
    expect(member).toMatchObject({
      committeeTitle: 'Πρόεδρος & Συντονιστής',
      roles: ['chair', 'coordinator'],
      specialty: 'Παθολόγος',
      responsibilities: 'Συντονίζει',
      voting: true,
      active: true,
    })
    expect(
      fromMemberRow({ id: 'm2', member_name: 'X', title: 'Μέλος', ended_at: '2025-01-01' }),
    ).toMatchObject({
      roles: [],
      specialty: '',
      active: false,
    })
  })

  it('keeps an empty stored role list empty, so the title still decides', () => {
    const member = fromMemberRow({ id: 'm3', member_name: 'Y', title: 'Πρόεδρος', member_roles: [], ended_at: null })
    expect(member.roles).toEqual([])
    expect(effectiveMemberRoles(member)).toEqual(['chair'])
    expect(memberBadgeRoles(member)).toEqual(['chair'])
    expect(fromMemberRow({ id: 'm4', member_name: 'Z', title: 'Πρόεδρος', member_roles: ['secretary'] }).roles).toEqual(['secretary'])
  })

  it('saves the roles chosen in the dialog, or the ones the title implies', () => {
    expect(memberRolesFor({ roles: ['vice_chair'], committeeTitle: 'Μέλος' })).toEqual([
      'vice_chair',
    ])
    expect(memberRolesFor({ committeeTitle: 'Πρόεδρος' })).toEqual(['chair'])
  })

  it('shows role badges for officers only, including legacy members without roles', () => {
    expect(memberBadgeRoles({ roles: ['chair', 'coordinator'] })).toEqual(['chair', 'coordinator'])
    expect(memberBadgeRoles({ roles: ['member'] })).toEqual([])
    expect(memberBadgeRoles({ committeeTitle: 'Γραμματέας' })).toEqual(['secretary'])
  })
})

describe('committee members list', () => {
  const rows = [
    {
      id: 'm1',
      name: 'Active member',
      committeeTitle: 'Μέλος',
      roles: ['member'],
      specialty: 'Φαρμακοποιός',
      responsibilities: 'Εισηγείται',
      voting: true,
      external: true,
      active: true,
      startedAt: '2024-10-22',
    },
    {
      id: 'm2',
      name: 'Chair person',
      committeeTitle: 'Πρόεδρος & Συντονιστής',
      roles: ['chair', 'coordinator'],
      specialty: 'Λοιμωξιολόγος',
      responsibilities: 'Πρόεδρος και Συντονιστής',
      voting: true,
      active: true,
      startedAt: '2023-01-05',
    },
    {
      id: 'm3',
      name: 'Past person',
      committeeTitle: 'Μέλος',
      roles: [],
      voting: true,
      active: false,
      startedAt: '2023-01-05',
      endedAt: '2025-03-07',
    },
  ]

  it('lists active members with role badges, specialty and responsibilities, and hides former members', () => {
    render(<Members rows={rows} canManage={false} en={false} />)
    const body = screen.getAllByRole('rowgroup')[1]
    const lines = within(body).getAllByRole('row')
    expect(lines).toHaveLength(2)
    expect(within(lines[0]).getByText('Chair person')).toBeInTheDocument()
    expect(within(lines[0]).getByText('Πρόεδρος')).toBeInTheDocument()
    expect(within(lines[0]).getByText('Συντονιστής')).toBeInTheDocument()
    expect(within(lines[0]).getByText('Λοιμωξιολόγος')).toBeInTheDocument()
    expect(within(lines[1]).getByText('Φαρμακοποιός')).toBeInTheDocument()
    expect(within(lines[1]).getByText('Εισηγείται')).toBeInTheDocument()
    expect(within(lines[1]).getByText('Εκτός προσωπικού')).toBeInTheDocument()
    expect(screen.queryByText('Past person')).not.toBeInTheDocument()
  })

  it('shows former members on request, kept for history', () => {
    render(<Members rows={rows} canManage={false} en />)
    fireEvent.click(screen.getByLabelText('Show former members (1)'))
    expect(screen.getByText('Past person')).toBeInTheDocument()
    expect(screen.getByText('Past person').closest('tr')).toHaveClass('committee-member-inactive')
  })
})

describe('committee member roles migration', () => {
  const sql = fs.readFileSync(
    'supabase/migrations/20261120110000_committee_member_roles_specialty.sql',
    'utf8',
  )
  it('adds roles and specialty additively with a constrained role vocabulary', () => {
    expect(sql).toContain('add column if not exists member_roles text[]')
    expect(sql).toContain('add column if not exists specialty text')
    expect(sql).toContain(
      "array['chair','vice_chair','deputy_chair','coordinator','secretary','member']",
    )
    expect(sql).not.toMatch(/\bdrop\b|\bdelete\b/i)
  })
})
