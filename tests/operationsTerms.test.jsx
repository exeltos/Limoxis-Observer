// @vitest-environment jsdom
// Operations (Controls, Kitchen): codes and jargon are not the first thing in the Greek UI.
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'
import { receiptTitle, shortDay } from '../src/features/kitchen/kitchenModel'

vi.mock('../src/core/supabase/client', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }))
vi.mock('../src/core/tenant/TenantContext', () => ({ useTenant: () => ({ tenant: { id: 'org-1' }, membership: { employeeId: '' }, role: 'hospital_admin' }) }))
vi.mock('../src/core/feedback/FeedbackContext', () => ({ useFeedback: () => ({ notify: vi.fn(), notifyError: vi.fn(), confirm: vi.fn() }), useOptionalFeedback: () => null }))
vi.mock('../src/core/audit/useAuditActor', () => ({ useAuditActor: () => ({ id: 'u', name: 'Ελένη' }) }))

const { RecallPanel } = await import('../src/features/kitchen/KitchenRecall')
const { ReceiptsPanel } = await import('../src/features/kitchen/KitchenPanels')
const { kitchenDemoState } = await import('../src/features/kitchen/kitchenDemoData')

const state = kitchenDemoState()
const access = { canView: true, canRecord: true, canManage: true }
const wrap = node => render(<MemoryRouter><LanguageProvider>{node}</LanguageProvider></MemoryRouter>)
afterEach(cleanup)
const read = path => readFileSync(path, 'utf8')

describe('Operations terms (finding Ο9)', () => {
  it('names a receipt by its date and supplier', () => {
    expect(shortDay('2026-10-20')).toBe('20/10')
    expect(receiptTitle({ receivedOn: '2026-10-20', supplierName: 'Προμηθευτής Α' })).toBe('Παραλαβή 20/10 · Προμηθευτής Α')
    expect(receiptTitle({ receivedOn: '2026-10-20', supplierName: '' }, 'en')).toBe('Receipt 20/10')
  })

  it('the receipts list opens each row with the date, the code is the small text', () => {
    const filters = { query: '', result: 'all', supplier: 'all', limits: 'all', from: '', to: '' }
    const { container } = wrap(<ReceiptsPanel state={state} access={access} filters={filters} setFilters={vi.fn()} />)
    const rows = [...container.querySelectorAll('tbody tr')]
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const first = row.querySelector('td')
      expect(first.querySelector('strong').textContent).not.toMatch(/^PAR-/)
      expect(first.querySelector('small').textContent).toMatch(/^PAR-/)
    }
  })

  it('the recall drills list opens each row with the date, the code is the small text', () => {
    const { container } = wrap(<RecallPanel state={state} access={access} filters={{ query: '', result: 'all', scenario: 'all' }} setFilters={vi.fn()} onRecall={vi.fn()} />)
    const rows = [...container.querySelectorAll('tbody tr')]
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const first = row.querySelector('td')
      expect(first.querySelector('strong').textContent).not.toMatch(/^ANK-/)
      expect(first.querySelector('small').textContent).toMatch(/^ANK-/)
    }
  })

  it('the record pages do not use the code as the label above the title', () => {
    expect(read('src/features/controls/ControlRecordPage.jsx')).not.toMatch(/eyebrow=\{record\.id\}/)
    expect(read('src/features/kitchen/KitchenReceiptRecordPage.jsx')).not.toMatch(/eyebrow=\{receipt\.code\}/)
  })

  it('«JSON» is not named in the control export menu (admins see a plain-Greek data file)', () => {
    const page = read('src/features/controls/ControlRecordPage.jsx')
    expect(page).not.toMatch(/label:'JSON'/)
    expect(page).toMatch(/kind:'data',label:en\?'Data file \(JSON\)':'Αρχείο δεδομένων'/)
  })

  it('FIFO is not written in the kitchen texts', () => {
    for (const path of ['src/features/kitchen/KitchenDayRecordPage.jsx', 'src/features/kitchen/KitchenDialogs.jsx', 'src/features/kitchen/KitchenPanels.jsx', 'src/core/help/helpManual.js', 'src/core/help/helpManualEn.js', 'src/core/help/helpExtras.js']) {
      expect(read(path).split('\n').filter(line => /FIFO/.test(line) && !/^\s*\/\//.test(line)), path).toEqual([])
    }
    expect(read('src/features/kitchen/KitchenDialogs.jsx')).toContain('πρώτα η παλαιότερη παρτίδα')
  })
})
