// @vitest-environment jsdom
// «JSON» (raw record data) in «Εξαγωγή» only for Platform Owner and Hospital Admin.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const tenant = { role: 'hospital_admin' }
const { ExportMenu } = await import('../src/design-system/ExportMenu')
const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')
const { TenantContext } = await import('../src/core/tenant/TenantContext')
const wrap = ui => render(<LanguageProvider><TenantContext.Provider value={{ ...tenant }}>{ui}</TenantContext.Provider></LanguageProvider>)

afterEach(cleanup)
const options = () => {
  fireEvent.click(screen.getByRole('button', { name: /Εξαγωγή/ }))
  return screen.queryAllByRole('menuitem').map(item => item.textContent.trim())
}
const menu = () => wrap(<ExportMenu language="el" onPrint={() => {}} onPdf={() => {}} items={[{ id: 'json', kind: 'data', label: 'JSON', onClick: () => {} }]} />)

describe('ExportMenu raw data', () => {
  it.each(['platform_owner', 'hospital_admin'])('shows JSON to %s', role => {
    tenant.role = role
    menu()
    expect(options()).toEqual(['Εκτύπωση', 'PDF', 'JSON'])
  })
  it.each(['infection_control_lead', 'link_nurse', 'department_user', 'laboratory', 'quality_manager'])('never shows JSON to %s', role => {
    tenant.role = role
    menu()
    expect(options()).toEqual(['Εκτύπωση', 'PDF'])
  })
  it('hides JSON outside a tenant', () => {
    render(<LanguageProvider><ExportMenu language="el" onPrint={() => {}} onPdf={() => {}} items={[{ id: 'json', kind: 'data', label: 'JSON', onClick: () => {} }]} /></LanguageProvider>)
    expect(options()).toEqual(['Εκτύπωση', 'PDF'])
  })
  it('opens «Εξαγωγή ▾» with the only option when JSON is hidden', () => {
    tenant.role = 'link_nurse'
    const print = vi.fn()
    wrap(<ExportMenu language="el" onPrint={print} items={[{ id: 'json', kind: 'data', label: 'JSON', onClick: () => {} }]} />)
    fireEvent.click(screen.getByRole('button', { name: /Εξαγωγή/ }))
    expect(screen.queryByRole('menuitem', { name: /JSON/ })).toBeNull()
    fireEvent.click(screen.getByRole('menuitem', { name: /Εκτύπωση/ }))
    expect(print).toHaveBeenCalled()
  })
})
