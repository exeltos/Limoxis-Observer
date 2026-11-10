import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { announcementPayload, mapAnnouncement, pendingFor } from '../src/features/platform/platformAnnouncementsService'

// The platform owner's announcements to the hospital administrators (owner, 8/11/2026).
const base = { id: 'a1', status: 'active', startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-11-30T00:00:00Z', audience: [], frequency: 'once' }
const now = new Date('2026-11-08T10:00:00Z')

describe('platform announcements', () => {
  it('shows an active one of the period to every hospital, or only to the chosen ones', () => {
    expect(pendingFor([base], 'org-1', new Set(), now)).toHaveLength(1)
    expect(pendingFor([{ ...base, audience: ['org-2'] }], 'org-1', new Set(), now)).toHaveLength(0)
    expect(pendingFor([{ ...base, audience: ['org-1'] }], 'org-1', new Set(), now)).toHaveLength(1)
  })
  it('hides a stopped one, one outside its period, and a «once» one already seen; «every visit» comes back', () => {
    expect(pendingFor([{ ...base, status: 'stopped' }], 'org-1', new Set(), now)).toHaveLength(0)
    expect(pendingFor([{ ...base, startsAt: '2026-11-20T00:00:00Z' }], 'org-1', new Set(), now)).toHaveLength(0)
    expect(pendingFor([{ ...base, endsAt: '2026-11-05T00:00:00Z' }], 'org-1', new Set(), now)).toHaveLength(0)
    expect(pendingFor([base], 'org-1', new Set(['a1']), now)).toHaveLength(0)
    expect(pendingFor([{ ...base, frequency: 'every_visit' }], 'org-1', new Set(['a1']), now)).toHaveLength(1)
  })
  it('saves a trimmed row with empty optional fields as null', () => {
    const row = announcementPayload({ titleEl: ' Νέο ', bodyEl: 'Κείμενο', ctaUrl: ' ', kind: 'promotion', audience: ['org-1'] })
    expect(row).toMatchObject({ title_el: 'Νέο', body_el: 'Κείμενο', cta_url: null, kind: 'promotion', audience_org_ids: ['org-1'], frequency: 'once', status: 'active' })
  })
  it('is written only by the owner and read only by the hospital administrators it is meant for (RLS)', () => {
    const sql = readFileSync('supabase/migrations/20261231260000_platform_announcements.sql', 'utf8')
    expect(sql).toContain('using (public.current_user_is_platform_owner()) with check (public.current_user_is_platform_owner())')
    expect(sql).toContain("om.role = 'hospital_admin'")
    expect(sql).toContain('cardinality(audience_org_ids) = 0 or om.organization_id = any(audience_org_ids)')
    expect(sql).toContain('revoke all on public.platform_announcements from anon')
  })
})

describe('platform announcements: file and demo (owner, 8/11/2026)', () => {
  it('keeps the uploaded file and the demo flag', () => {
    const row = announcementPayload({ titleEl: 'Νέο', bodyEl: 'Κείμενο', attachmentPath: '1-a.pdf', attachmentName: 'a.pdf', attachmentType: 'application/pdf', showInDemo: true })
    expect(row).toMatchObject({ attachment_path: '1-a.pdf', attachment_name: 'a.pdf', attachment_type: 'application/pdf', show_in_demo: true })
    expect(announcementPayload({ titleEl: 'Νέο', bodyEl: 'Κείμενο' })).toMatchObject({ attachment_path: null, show_in_demo: false })
  })

  it('opens the form as a record screen with Back (not a window), rows only open it, and shows the demo ones in a demo hospital', () => {
    const page = readFileSync('src/features/platform/PlatformAnnouncementsPage.jsx', 'utf8')
    expect(page).toContain('<EntityRecordShell')
    expect(page).toContain('onBack={() => setDraft(null)}')
    expect(page).not.toContain('<ObserverDialog')
    // A row opens the record; Stop and Delete live in the record's «⋯», not on the row.
    expect(page).not.toContain('<OverflowMenu')
    expect(page).toContain("placement: 'menu', danger: true")
    // The maintenance message is the pinned first item and has its own editor.
    expect(page).toContain('platform-maintenance-item')
    expect(page).toContain('function MaintenanceEditor(')
    const gate = readFileSync('src/features/platform/PlatformAnnouncementGate.jsx', 'utf8')
    expect(gate).toContain('loadDemoAnnouncements()')
  })
})

describe('platform announcements: image position and attached file (owner, 10/11/2026)', () => {
  it('saves the position of the image and the attached file next to it', () => {
    const row = announcementPayload({ titleEl: 'Νέο', bodyEl: 'Κείμενο', attachmentPath: '1-a.png', attachmentName: 'a.png', attachmentType: 'image/png', imagePosition: 'right', documentPath: '2-b.pdf', documentName: 'b.pdf', documentType: 'application/pdf' })
    expect(row).toMatchObject({ attachment_path: '1-a.png', image_position: 'right', document_path: '2-b.pdf', document_name: 'b.pdf', document_type: 'application/pdf' })
  })

  it('puts the image above the text unless a known position is chosen', () => {
    expect(announcementPayload({ titleEl: 'Νέο', bodyEl: 'Κείμενο' })).toMatchObject({ image_position: 'top', document_path: null })
    expect(announcementPayload({ titleEl: 'Νέο', bodyEl: 'Κείμενο', imagePosition: 'diagonal' }).image_position).toBe('top')
    expect(mapAnnouncement({ id: 'a', image_position: 'left' }).imagePosition).toBe('left')
    expect(mapAnnouncement({ id: 'a' }).imagePosition).toBe('top')
  })

  it('reads a file that the first version kept as the attachment as the attached file, and keeps an image as the image', () => {
    const legacy = mapAnnouncement({ id: 'a', attachment_path: '1-a.pdf', attachment_name: 'a.pdf', attachment_type: 'application/pdf' })
    expect(legacy).toMatchObject({ attachmentPath: '', documentPath: '1-a.pdf', documentName: 'a.pdf', documentType: 'application/pdf' })
    const image = mapAnnouncement({ id: 'a', attachment_path: '1-a.png', attachment_type: 'image/png', document_path: '2-b.pdf', document_name: 'b.pdf' })
    expect(image).toMatchObject({ attachmentPath: '1-a.png', documentPath: '2-b.pdf' })
  })
})

describe('platform announcements: the card has no × (owner, 10/11/2026)', () => {
  const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
  it('leaves out the × and the Close beside the announcement\'s own button; Close stays only when there is no button', () => {
    const gate = read('src/features/platform/PlatformAnnouncementGate.jsx')
    expect(gate).toContain('showClose={false}')
    expect(gate).toContain('cta ? (')
    const dialog = read('src/design-system/ObserverDialog.jsx')
    expect(dialog).toContain('showClose=true')
    expect(dialog).toContain('!workspace&&showClose&&<IconButton')
  })
})
