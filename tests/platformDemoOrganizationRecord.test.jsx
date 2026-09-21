// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { PlatformDemoOrganizationRecord } from '../src/features/platform/PlatformDemoOrganizationRecord'
import { demoUsers } from '../src/features/management/managementData'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'

afterEach(() => cleanup())

const organization = { id: 'demo-hospital', name: 'Demo Hospital', code: 'DEMO' }

describe('PlatformDemoOrganizationRecord', () => {
  it('renders demo details read-only, with the demoUsers fixture on the users tab, and no backend-mutating actions', () => {
    const onEnter = vi.fn()
    render(<MemoryRouter><LanguageProvider><PlatformDemoOrganizationRecord organization={organization} language="el" initialTab="details" onTabChange={() => {}} onBack={() => {}} onEnter={onEnter}/></LanguageProvider></MemoryRouter>)
    expect(screen.getByText('Demo Hospital')).toBeInTheDocument()
    expect(screen.getAllByText('DEMO').length).toBeGreaterThan(0)
    // No pause/delete organization actions — this is a read-only synthetic record.
    expect(screen.queryByText('Παύση')).not.toBeInTheDocument()
    expect(screen.queryByText('Διαγραφή')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Είσοδος στο demo νοσοκομείο' }))
    expect(onEnter).toHaveBeenCalledTimes(1)
  })

  it('shows the demoUsers fixture on the Users & Roles tab', () => {
    render(<MemoryRouter><LanguageProvider><PlatformDemoOrganizationRecord organization={organization} language="el" initialTab="users" onTabChange={() => {}} onBack={() => {}} onEnter={() => {}}/></LanguageProvider></MemoryRouter>)
    for (const user of demoUsers) expect(screen.getByText(user.name)).toBeInTheDocument()
  })
})
