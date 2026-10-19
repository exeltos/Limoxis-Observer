// @vitest-environment jsdom
// Employee photo: the rules of the photo service, the database policy that keeps
// the folder for staff editors, and the header photo control on the demo hospital.
import fs from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

let profile
vi.mock('../src/core/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: profile.id, email: profile.email }, profile, isAuthenticated: true, isDemoSession: false, loading: false }),
}))

const photo = await import('../src/features/employees/employeePhotoService')
const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')
const { FeedbackProvider } = await import('../src/core/feedback/FeedbackContext')
const { TenantProvider, useTenant } = await import('../src/core/tenant/TenantContext')
const { NotificationProvider } = await import('../src/core/notifications/NotificationContext')
const { EmployeeRecordPage } = await import('../src/features/employees/EmployeeRecordPage')
const { EmployeesPage } = await import('../src/features/employees/EmployeesPage')

const imageFile = (type = 'image/png', size = 64, name = 'face.png') => new File([new Uint8Array(size)], name, { type })

describe('employee photo service', () => {
  it('accepts JPG, PNG and WebP up to the size limit only', () => {
    expect(photo.validatePhotoFile(imageFile('image/jpeg'))).toBeNull()
    expect(photo.validatePhotoFile(imageFile('image/png'))).toBeNull()
    expect(photo.validatePhotoFile(imageFile('image/webp'))).toBeNull()
    expect(photo.validatePhotoFile(imageFile('image/gif'))).toBe('PHOTO_TYPE')
    expect(photo.validatePhotoFile(imageFile('application/pdf'))).toBe('PHOTO_TYPE')
    expect(photo.validatePhotoFile({ type: 'image/png', size: photo.PHOTO_MAX_BYTES + 1 })).toBe('PHOTO_TOO_LARGE')
    expect(photo.validatePhotoFile(null)).toBe('PHOTO_MISSING')
  })

  it('keeps photos in the employee folder of the organisation', () => {
    expect(photo.employeePhotoPath('org-1', 'emp-1', 'png', 123)).toBe('org-1/employee_photo/emp-1/123-photo.png')
    expect(() => photo.employeePhotoPath('', 'emp-1')).toThrow('MISSING_PHOTO_CONTEXT')
  })

  it('scales the longer edge down to the limit and never enlarges', () => {
    expect(photo.fitWithin(2000, 1000, 512)).toEqual({ width: 512, height: 256 })
    expect(photo.fitWithin(600, 1200, 512)).toEqual({ width: 256, height: 512 })
    expect(photo.fitWithin(200, 100, 512)).toEqual({ width: 200, height: 100 })
  })

  it('falls back to the initials of the language shown', () => {
    const employee = { firstName: 'Μαρία', lastName: 'Παπά', firstNameEn: 'Maria', lastNameEn: 'Papa' }
    expect(photo.employeeInitials(employee, 'el')).toBe('ΜΠ')
    expect(photo.employeeInitials(employee, 'en')).toBe('MP')
    expect(photo.employeeInitials({}, 'en')).toBe('')
  })

  it('serves a demo photo kept inline without asking storage', async () => {
    const inline = 'data:image/png;base64,AAAA'
    expect(await photo.employeePhotoUrls([inline, null, ''])).toEqual({ [inline]: inline })
  })
})

describe('employee photo policy', () => {
  const sql = fs.readFileSync('supabase/migrations/20261121100000_employee_photo.sql', 'utf8')
  it('adds the photo column with a path bound to the employee and organisation', () => {
    expect(sql).toMatch(/add column if not exists photo_path text/)
    expect(sql).toMatch(/organization_id::text \|\| '\/employee_photo\/' \|\| id::text/)
  })
  it('lets only employee editors upload or remove photos', () => {
    for (const name of ['attachments_storage_employee_photo_insert_guard', 'attachments_storage_employee_photo_delete_guard']) {
      expect(sql).toMatch(new RegExp(`create policy ${name} on storage\\.objects\\s+as restrictive`))
    }
    expect(sql.match(/'manage_staff_admin'\)/g)?.length).toBeGreaterThanOrEqual(3)
    expect(sql).not.toMatch(/\bdrop\b/i)
  })
})

async function renderDemo(element, path, { previewRole = null } = {}) {
  let api
  function Capture() { api = useTenant(); return null }
  render(<MemoryRouter initialEntries={[path]}><LanguageProvider><FeedbackProvider><TenantProvider><NotificationProvider><Capture/>
    <Routes>
      <Route path="/employees" element={<EmployeesPage/>}/>
      <Route path="/employees/:employeeId" element={element}/>
    </Routes>
  </NotificationProvider></TenantProvider></FeedbackProvider></LanguageProvider></MemoryRouter>)
  await waitFor(() => expect(api?.enterSampleDemo).toBeTypeOf('function'))
  act(() => { api.enterSampleDemo() })
  if (previewRole) {
    await waitFor(() => expect(api.isDemo).toBe(true))
    act(() => { api.startRolePreview(previewRole) })
  }
  return api
}
const header = () => document.querySelector('.entity-record-header')

beforeEach(() => {
  localStorage.clear()
  profile = { id: 'owner-1', isPlatformOwner: true, fullName: 'Platform Owner', isDemo: false }
})
afterEach(() => { cleanup(); localStorage.clear() })

describe('employee photo in the demo hospital', () => {
  it('shows initials, then the photo chosen in the header window, also in the registry', async () => {
    await renderDemo(<EmployeeRecordPage/>, '/employees/EMP-001')
    const trigger = await screen.findByRole('button', { name: 'Αλλαγή φωτογραφίας' }, { timeout: 5000 })
    expect(header().querySelector('.employee-avatar img')).toBeNull()
    expect(trigger.querySelector('.employee-avatar').textContent).toMatch(/^\S{2}$/)

    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: 'Φωτογραφία εργαζομένου' })
    expect(within(dialog).queryByRole('button', { name: /Αφαίρεση φωτογραφίας/ })).toBeNull()
    fireEvent.change(within(dialog).getByTestId('employee-photo-input'), { target: { files: [imageFile()] } })

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Φωτογραφία εργαζομένου' })).toBeNull())
    await waitFor(() => expect(header().querySelector('.employee-avatar img')).not.toBeNull())
    const img = header().querySelector('.employee-avatar img')
    expect(img.getAttribute('src')).toMatch(/^data:image\/png;base64,/)
    const { loadEmployees } = await import('../src/features/employees/employeeStore')
    expect(loadEmployees().find(row => row.id === 'EMP-001').photoPath).toMatch(/^data:image\/png/)
  })

  it('refuses a file that is not a photo', async () => {
    await renderDemo(<EmployeeRecordPage/>, '/employees/EMP-001')
    fireEvent.click(await screen.findByRole('button', { name: 'Αλλαγή φωτογραφίας' }, { timeout: 5000 }))
    const before = header().querySelector('.employee-avatar img')?.getAttribute('src') || null
    const dialog = await screen.findByRole('dialog', { name: 'Φωτογραφία εργαζομένου' })
    fireEvent.change(within(dialog).getByTestId('employee-photo-input'), { target: { files: [imageFile('application/pdf', 10, 'cv.pdf')] } })
    expect(await screen.findByText('Επιλέξτε εικόνα JPG, PNG ή WebP.')).toBeInTheDocument()
    expect(header().querySelector('.employee-avatar img')?.getAttribute('src') || null).toBe(before)
  })

  it('offers no photo change to a role that cannot edit employees', async () => {
    await renderDemo(<EmployeeRecordPage/>, '/employees/EMP-001', { previewRole: 'occupational_physician' })
    await waitFor(() => expect(header()).not.toBeNull(), { timeout: 5000 })
    expect(screen.queryByRole('button', { name: 'Αλλαγή φωτογραφίας' })).toBeNull()
    expect(header().querySelector('.entity-record-avatar .employee-avatar')).not.toBeNull()
  })

  it('shows an avatar with initials on every registry row', async () => {
    await renderDemo(<EmployeeRecordPage/>, '/employees')
    await waitFor(() => expect(document.querySelectorAll('tbody tr').length).toBeGreaterThan(0), { timeout: 5000 })
    const rows = [...document.querySelectorAll('tbody tr')]
    expect(rows.every(row => row.querySelector('.employee-registry-person .employee-avatar'))).toBe(true)
  })
})
