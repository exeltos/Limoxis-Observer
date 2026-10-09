// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { PlatformDashboardView } from '../src/features/platform/PlatformDashboardView'

const read = path => fs.readFileSync(path, 'utf8')
const tx = (el) => el
const iso = days => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString() }

afterEach(cleanup)

describe('lifecycle reminders', () => {
  it('lists Demo endings and deletions of the next 7 days on the Platform Center, most urgent first', () => {
    const nav = []
    const opened = []
    render(<PlatformDashboardView tx={tx} activeOrganizations={3} loadingStats={false} onNavigate={to => nav.push(to)} onOpenDemo={d => opened.push(d.id)}
      organizations={[{ id: 'o1', name: 'Νοσοκομείο Α', deletion_scheduled_at: iso(-0.2) }, { id: 'o2', name: 'Νοσοκομείο Β', deletion_scheduled_at: iso(1) }, { id: 'o3', name: 'Νοσοκομείο Γ', deletion_scheduled_at: iso(20) }]}
      activeDemos={[]} expiringDemos={[{ id: 'd1', label: 'Demo Χ', valid_until: iso(6).slice(0, 10) }, { id: 'd2', label: 'Demo Ψ', valid_until: iso(12).slice(0, 10) }]}/>)
    expect(screen.getByText('Χρειάζονται ενέργεια')).toBeInTheDocument()
    const titles = [...document.querySelectorAll('.platform-action-copy strong')].map(x => x.textContent)
    expect(titles).toEqual(['Νοσοκομείο Α', 'Νοσοκομείο Β', 'Demo Χ'])
    expect(screen.getByText('Έφτασε η ημερομηνία οριστικής διαγραφής')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Νοσοκομείο Α'))
    fireEvent.click(screen.getByText('Demo Χ'))
    expect(nav).toEqual(['/platform#organizations?organization=o1&tab=offboarding'])
    expect(opened).toEqual(['d1'])
  })

  it('writes each reminder once per date and sends them from the nightly job', () => {
    const sql = read('supabase/migrations/20261020120000_lifecycle_reminders.sql')
    expect(sql).toContain("d.days in (7, 1)")
    expect(sql).toContain("'demo_expiry_' || d.days || 'd:' || e.valid_until::text")
    expect(sql).toContain("when dd.days <= 0 then 'deletion_due'")
    expect(sql).toContain('on conflict (notification_type, entity_type, entity_id, recipient_user_id) do nothing')
    expect(sql).toContain("'evaluator'")
    expect(sql).toContain('grant execute on function public.platform_scheduler_secret_valid(text) to service_role')
    expect(sql).toContain('select private.platform_lifecycle_reminders(); select private.platform_dispatch_scheduled_tasks();')
    const fn = read('supabase/functions/platform-scheduled-tasks/index.ts')
    expect(fn).toContain("admin.rpc('platform_scheduler_secret_valid'")
    expect(fn).toContain("eq('notification_type','platform_lifecycle_reminder')")
  })
})
