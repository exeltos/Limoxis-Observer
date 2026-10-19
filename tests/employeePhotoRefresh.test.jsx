// @vitest-environment jsdom
// Employee photo URLs: a page left open signs them again before they expire.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

let round = 0
const employeePhotoUrls = vi.fn(async paths => Object.fromEntries(paths.map(path => [path, `https://signed.example/${path}?v=${++round}`])))
vi.mock('../src/features/employees/employeePhotoService', () => ({
  PHOTO_ACCEPT: 'image/*', PHOTO_URL_REFRESH_MS: 46 * 60 * 1000,
  employeePhotoUrls: (...args) => employeePhotoUrls(...args),
  employeeInitials: () => '', removeEmployeePhoto: vi.fn(), uploadEmployeePhoto: vi.fn(), validatePhotoFile: vi.fn(),
}))
const { useEmployeePhotoUrls } = await import('../src/features/employees/EmployeePhoto')

function Probe({ rows }) {
  const urls = useEmployeePhotoUrls(rows)
  return <output data-testid="url">{urls['org/employee_photo/e1/p.png'] || ''}</output>
}

afterEach(() => { cleanup(); vi.useRealTimers() })

describe('employee photo URLs on a long-open page', () => {
  it('signs the photo again before the signed URL expires', async () => {
    vi.useFakeTimers()
    render(<Probe rows={[{ photoPath: 'org/employee_photo/e1/p.png' }]}/>)
    await act(async () => { await Promise.resolve() })
    expect(screen.getByTestId('url').textContent).toContain('v=1')
    await act(async () => { vi.advanceTimersByTime(46 * 60 * 1000); await Promise.resolve() })
    expect(employeePhotoUrls).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('url').textContent).toContain('v=2')
  })
})
