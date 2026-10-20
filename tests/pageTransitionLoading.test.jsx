// @vitest-environment jsdom
// Moving between screens never shows "something else" first: the shell stays,
// a page file already fetched renders at once, a screen whose first load has not
// ended shows placeholders (never its empty state or 0 figures), and a record
// page never shows the previous record. See tools/capture-page-transitions.mjs.
import fs from 'node:fs'
import { Suspense } from 'react'
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'
import { RouteLoading } from '../src/design-system/RouteLoading'
import { RegistryTable } from '../src/design-system/RegistryTable'
import { MetricCard } from '../src/design-system/MetricCard'
import { lazyPage } from '../src/core/errors/chunkRecovery'
import { preloadRoute, registerRoutePreload } from '../src/app/routePreload'
import { useEmployeeSubRecords } from '../src/features/employees/useEmployeeSubRecords'

const read = file => fs.readFileSync(file, 'utf8')
const inLanguage = ui => render(<LanguageProvider>{ui}</LanguageProvider>)

afterEach(() => cleanup())

describe('loading placeholders', () => {
  it('RouteLoading shows the page placeholder at once, never a blank frame', () => {
    inLanguage(<RouteLoading/>)
    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-busy')).toBe('true')
    expect(status.classList.contains('page-loading-skeleton')).toBe(true)
    expect(status.classList.contains('route-loading')).toBe(true)
  })

  it('a registry still loading shows placeholder lines, not its empty state', () => {
    inLanguage(<RegistryTable columns={[{ key: 'a', label: 'A' }]} rows={[]} loading emptyTitle="Δεν υπάρχουν εγγραφές" emptyIcon={() => null}/>)
    expect(screen.queryByText('Δεν υπάρχουν εγγραφές')).toBeNull()
    expect(document.querySelector('.table-loading-skeleton')).not.toBeNull()
  })

  it('a loaded empty registry still shows its empty state', () => {
    inLanguage(<RegistryTable columns={[{ key: 'a', label: 'A' }]} rows={[]} emptyTitle="Δεν υπάρχουν εγγραφές"/>)
    expect(screen.getByText('Δεν υπάρχουν εγγραφές')).toBeTruthy()
  })

  it('a figure still loading shows a placeholder, never 0', () => {
    render(<MetricCard value={0} label="Ενεργοί" loading/>)
    expect(document.querySelector('.metric-loading-skeleton')).not.toBeNull()
    expect(document.querySelector('.canonical-metric-copy strong').textContent).toBe('')
    cleanup()
    render(<MetricCard value={0} label="Ενεργοί"/>)
    expect(document.querySelector('.canonical-metric-copy strong').textContent).toBe('0')
  })
})

describe('page files', () => {
  it('a preloaded page renders in the same pass, without the Suspense fallback', async () => {
    const Page = lazyPage(() => Promise.resolve({ Named: () => <p>page content</p> }), 'Named')
    expect(await Page.preload()).toBe(true)
    render(<Suspense fallback={<p>fallback</p>}><Page/></Suspense>)
    expect(screen.getByText('page content')).toBeTruthy()
    expect(screen.queryByText('fallback')).toBeNull()
  })

  it('preloadRoute fetches the pages registered for the first path segment', async () => {
    const preload = vi.fn(() => Promise.resolve(true))
    registerRoutePreload('/transition-test', { preload })
    await preloadRoute('/transition-test/REC-1?tab=x')
    expect(preload).toHaveBeenCalledTimes(1)
  })

  it('the shell keeps one Suspense around the routed screen; routes add none of their own', () => {
    const app = read('src/app/App.jsx')
    const shellRoutes = app.slice(app.indexOf('<Route element={<ProtectedRoute/>}>'), app.indexOf('</Route></Route>'))
    expect(shellRoutes).not.toContain('<Suspense')
    expect(app).toContain("registerRoutePreload('/patients', PatientsPage, PatientClinicalRecordRoute)")
    const shell = read('src/app/AppShell.jsx')
    expect(shell).toContain('<ScreenErrorBoundary resetKey={location.pathname}><Suspense fallback={<RouteLoading/>}><Outlet/></Suspense></ScreenErrorBoundary>')
    expect(shell).toContain('onPointerEnter={()=>void preloadRoute(item.to)}')
    expect(shell).toContain('preloadRoutesWhenIdle(')
  })
})

describe('first load and record changes', () => {
  it('screens start in their loading state, not their empty state', () => {
    expect(read('src/features/patients/PatientsPage.jsx')).toContain('const [loadedPatients,setPatients]=useState(null)')
    expect(read('src/features/pharmacy/PharmacyPage.jsx')).toContain('const [loading, setLoading] = useState(true)')
    expect(read('src/features/indicators/IndicatorsPage.jsx')).toContain('const [loading,setLoading]=useState(true)')
    expect(read('src/features/prevention/PreventionPage.jsx')).toContain('[handLoading, setHandLoading] = useState(true)')
    expect(read('src/features/occupational-health/OccupationalHealthPage.jsx')).toContain('[exposureLoading,setExposureLoading]=useState(true)')
    expect(read('src/features/quality/QualityPage.jsx')).toContain('{records.loading?<PageSkeleton metrics={0}/>:<QualityOverview')
  })

  it('record pages never render the previous record while the next one loads', () => {
    expect(read('src/features/surveillance/PatientClinicalCanonicalPage.jsx')).toContain('if (loading || stale) return <RouteLoading />')
    expect(read('src/features/quality/QualityRecordPage.jsx')).toContain('if(loading||loadedFor!==recordKey)return <RouteLoading/>')
    expect(read('src/features/employees/useEmployeeRecordData.js')).toContain('loading: loading || (!selfMode && loadedCode !== code)')
  })

  it("an employee's sub-records are never shown under another employee", async () => {
    let resolveSecond
    const loader = vi.fn((org, dbId, id) => id === 'EMP-001'
      ? Promise.resolve([{ id: 'row-of-001' }])
      : new Promise(resolve => { resolveSecond = resolve }))
    const { result, rerender } = renderHook(({ id }) => useEmployeeSubRecords(loader, 'org', `db-${id}`, id), { initialProps: { id: 'EMP-001' } })
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'row-of-001' }]))
    rerender({ id: 'EMP-002' })
    expect(result.current.data).toEqual([])
    expect(result.current.loading).toBe(true)
    await act(async () => { resolveSecond([{ id: 'row-of-002' }]) })
    expect(result.current.data).toEqual([{ id: 'row-of-002' }])
    expect(result.current.loading).toBe(false)
  })
})
