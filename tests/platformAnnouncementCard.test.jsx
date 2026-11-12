// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlatformAnnouncementDialog } from '../src/features/platform/PlatformAnnouncementGate'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'

// The announcement card appears once, whole (owner, 11/11/2026): with an image it waits for the picture, it does not show
// the green band first, then the image, then change size.
vi.mock('../src/features/platform/platformAnnouncementsService', async importOriginal => ({
  ...(await importOriginal()),
  announcementAttachmentUrl: vi.fn(async path => `https://files.example/${path}`),
}))

const announcement = { id: 'a1', kind: 'promotion', titleEl: 'EXELTOS', titleEn: '', bodyEl: 'Κείμενο', bodyEn: '', ctaLabelEl: '', ctaLabelEn: '', ctaUrl: '', imageUrl: '', attachmentPath: '1-logo.png', attachmentName: 'logo.png', attachmentType: 'image/png', imagePosition: 'right', documentPath: '', documentName: '', documentType: '' }
let pending
beforeEach(() => {
  pending = []
  globalThis.Image = class {
    set src(value) { this.value = value; pending.push(this) }
  }
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const show = item => render(<LanguageProvider><PlatformAnnouncementDialog announcement={item} onClose={() => {}} language="el" navigate={() => {}} /></LanguageProvider>)

describe('announcement card loading', () => {
  it('shows only a spinner while the image is on its way, then the whole card with the image', async () => {
    show(announcement)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(pending).toHaveLength(1))
    expect(pending[0].value).toBe('https://files.example/1-logo.png')
    pending[0].onload()
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
    expect(document.querySelector('img.platform-announcement-image')?.getAttribute('src')).toBe('https://files.example/1-logo.png')
    expect(document.querySelector('.platform-announcement-layout.is-right')).toBeTruthy()
  })

  it('shows the card without the image when the picture cannot be loaded', async () => {
    show(announcement)
    await waitFor(() => expect(pending).toHaveLength(1))
    pending[0].onerror()
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
    expect(document.querySelector('img.platform-announcement-image')).toBeNull()
  })

  it('shows an announcement without an image at once', () => {
    show({ ...announcement, attachmentPath: '', attachmentType: '' })
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
