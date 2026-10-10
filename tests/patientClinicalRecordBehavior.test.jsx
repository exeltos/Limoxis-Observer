// @vitest-environment jsdom
// Behavior of the patient clinical record (patient → admission → surveillance
// episode), exercised through the rendered UI on the sample demo hospital.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../src/core/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner-1' }, profile: { id: 'owner-1', isPlatformOwner: true, fullName: 'Platform Owner', isDemo: false }, isAuthenticated: true, isDemoSession: false, loading: false }),
}))
let criteriaSets = null
const loadHaiCriteriaSets = vi.fn(async () => criteriaSets)
vi.mock('../src/features/surveillance/haiCriteriaLibraryService', () => ({ loadHaiCriteriaSets: (...args) => loadHaiCriteriaSets(...args) }))

const { LanguageProvider, loadLanguage } = await import('../src/core/i18n/LanguageContext')
const { FeedbackProvider } = await import('../src/core/feedback/FeedbackContext')
const { TenantProvider, useTenant } = await import('../src/core/tenant/TenantContext')
const { PatientClinicalRecordRoute } = await import('../src/features/surveillance/PatientClinicalRecordRoute')
const { clinicalCases } = await import('../src/features/surveillance/clinicalDemoData')
const { patientDemoData } = await import('../src/features/patients/patientDemoData')
const { laboratorySamples } = await import('../src/features/laboratory/laboratoryDemoData')
const { DEMO_STEP_EVENT } = await import('../src/features/demo/demoScenarioSignals')

const pristineCases = structuredClone(clinicalCases)
const pristinePatients = structuredClone(patientDemoData)
const pristineSamples = structuredClone(laboratorySamples)
const body = () => document.querySelector('.entity-record-body')

async function openRecord(path) {
  let api
  function Capture() { api = useTenant(); return null }
  render(<MemoryRouter initialEntries={[path]}><LanguageProvider><FeedbackProvider><TenantProvider><Capture/>
    <Routes>
      <Route path="/patients/:patientId" element={<PatientClinicalRecordRoute patientMode/>}/>
      <Route path="/surveillance/:caseId" element={<PatientClinicalRecordRoute/>}/>
    </Routes>
  </TenantProvider></FeedbackProvider></LanguageProvider></MemoryRouter>)
  await waitFor(() => expect(api?.enterSampleDemo).toBeTypeOf('function'))
  act(() => { api.enterSampleDemo() })
  await waitFor(() => expect(document.querySelector('.entity-record-shell, .record-shell, main, section')).not.toBeNull())
  return api
}
const openSurveillance = async () => {
  await openRecord('/surveillance/SUR-260041')
  await screen.findByRole('tab', { name: /Επιτήρηση & Δείγματα/ })
}
const openPatient = async (id = 'PT-260190') => {
  await openRecord(`/patients/${id}`)
  await screen.findByRole('button', { name: /Νέα νοσηλεία/ })
}
const openAdmission = async () => {
  await openPatient()
  fireEvent.click(document.querySelector('main tbody tr, tbody tr'))
  await screen.findByRole('tab', { name: /Σύνοψη/ })
}
const openTab = async name => fireEvent.click(await screen.findByRole('tab', { name: new RegExp(name) }))
const openEpisode = async (title = 'Λοίμωξη αιματικής ροής') => {
  await openTab('Επιτήρηση & Δείγματα')
  fireEvent.click((await screen.findAllByText(title))[0])
  await screen.findByRole('button', { name: /Ενέργειες επιτήρησης/ })
}
const openStage = async name => {
  fireEvent.click(screen.getAllByRole('button').find(button => button.textContent.startsWith(name)))
  return document.querySelector('.clinical-panel.full-panel')
}
const optionsOf = select => within(select).getAllByRole('option').map(option => option.textContent)

beforeEach(() => { localStorage.clear(); criteriaSets = null })
afterEach(async () => {
  cleanup()
  vi.clearAllMocks()
  for (const key of Object.keys(clinicalCases)) delete clinicalCases[key]
  Object.assign(clinicalCases, structuredClone(pristineCases))
  patientDemoData.splice(0, patientDemoData.length, ...structuredClone(pristinePatients))
  laboratorySamples.splice(0, laboratorySamples.length, ...structuredClone(pristineSamples))
  localStorage.clear()
})

describe('patient profile', () => {
  it('shows surname and first name as separate fields, with a neonate age in days and birth data', async () => {
    await openPatient()
    const sheet = screen.getByText('Στοιχεία ασθενούς').closest('section, article, div.record-section') || document.body
    expect(within(sheet).getByText('Επώνυμο')).toBeInTheDocument()
    expect(within(sheet).getByText('Ιωαννίδη')).toBeInTheDocument()
    expect(within(sheet).getByText('Όνομα')).toBeInTheDocument()
    expect(within(sheet).getByText('Νεογέννητο')).toBeInTheDocument()
    expect(screen.queryByText('Ονοματεπώνυμο')).not.toBeInTheDocument()
    expect(within(sheet).getByText(/ημέρες/)).toBeInTheDocument()
    expect(within(sheet).getByText('980 g')).toBeInTheDocument()
    expect(within(sheet).getByText(/27 εβδ/)).toBeInTheDocument()
  })

  it('tells the user where to add a missing birth weight for an infant', async () => {
    delete patientDemoData.find(patient => patient.id === 'PT-260190').birthWeightGrams
    await openPatient()
    expect(screen.getByText(/Χωρίς βάρος γέννησης/)).toBeInTheDocument()
  })

  it('shows the clinical-scale risk flags in the record header', async () => {
    await openSurveillance()
    const flags = await screen.findByLabelText('Κλινικές επισημάνσεις')
    expect(within(flags).getByRole('button', { name: 'Κλινική επιδείνωση · NEWS2 8' })).toHaveClass('risk-tone-danger')
  })
})

describe('admissions', () => {
  it('lists admissions with their surveillance count and transfer/discharge actions, without record tabs', async () => {
    await openPatient()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    const row = document.querySelector('tbody tr')
    expect(row).toHaveTextContent('1 επιτήρηση')
    expect(row).toHaveTextContent('1 ενεργή')
    fireEvent.click(within(row).getByRole('button', { name: /Ενέργειες νοσηλείας/ }))
    expect(screen.getByRole('menuitem', { name: /Μεταφορά σε άλλο τμήμα/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Εξιτήριο/ })).toBeInTheDocument()
  })

  it('offers the demo departments in the active language when admitting', async () => {
    await openPatient()
    fireEvent.click(screen.getByRole('button', { name: /Νέα νοσηλεία/ }))
    const department = within(screen.getByRole('dialog')).getAllByRole('combobox').find(select => optionsOf(select).includes('ΜΕΘ'))
    expect(department).toBeDefined()
    cleanup()
    await loadLanguage('en')
    localStorage.setItem('limoxis.language', JSON.stringify('en'))
    localStorage.setItem('limoxis.language', 'en')
    await openRecord('/patients/PT-260190')
    fireEvent.click(await screen.findByRole('button', { name: /New admission/ }))
    expect(within(screen.getByRole('dialog')).getAllByRole('combobox').some(select => optionsOf(select).includes('ICU'))).toBe(true)
  })

  it('opens one canonical tab structure for an admission, including clinical scales', async () => {
    await openAdmission()
    expect(screen.getAllByRole('tab').map(tab => tab.textContent.trim())).toEqual(['Σύνοψη', 'Επιτήρηση & Δείγματα', 'Κλινικά δεδομένα', 'Κλινικές αξιολογήσεις', 'Έγγραφα', 'Ιστορικό'])
    await openTab('Κλινικές αξιολογήσεις')
    expect(within(body()).getByRole('heading', { name: 'Κλινικές αξιολογήσεις' })).toBeInTheDocument()
  })

  it('summarises the stay and the current surveillance as info sheets', async () => {
    await openAdmission()
    expect(screen.getByText('Διάρκεια νοσηλείας')).toBeInTheDocument()
    expect(screen.getByText('Τρέχουσα επιτήρηση')).toBeInTheDocument()
  })

  it('shows each patient only their own surveillance episodes', async () => {
    await openAdmission()
    await openTab('Επιτήρηση & Δείγματα')
    expect(within(body()).getByText(/LAB-260829-013/)).toBeInTheDocument()
    expect(within(body()).queryByText(/LAB-260771|LAB-260827-001/)).not.toBeInTheDocument()
  })

  it('starts a new surveillance with the progressive flow, tied to the admission', async () => {
    await openAdmission()
    await openTab('Επιτήρηση & Δείγματα')
    fireEvent.click(screen.getByRole('button', { name: /Έναρξη νέας επιτήρησης/ }))
    const flow = await screen.findByRole('dialog', { name: '' }).catch(() => document.querySelector('.new-surveillance-flow-overlay'))
    expect(flow).toHaveClass('new-surveillance-flow-overlay')
    expect(within(flow).getByText('Νεογέννητο Ιωαννίδη · PT-260190')).toBeInTheDocument()
    expect(within(flow).getByText('Από την ενεργή νοσηλεία')).toBeInTheDocument()
  })
})

describe('surveillance tree and samples', () => {
  it('labels each episode with its HAI type and nests a new follow-up sample under its parent', async () => {
    await openSurveillance()
    await openTab('Επιτήρηση & Δείγματα')
    expect(within(body()).getByText('Λοίμωξη αιματικής ροής')).toBeInTheDocument()
    const parent = within(body()).getByText(/LAB-260771/).closest('.sv-sample-node')
    fireEvent.click(within(parent).getByRole('button', { name: /Επανέλεγχος/ }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Επανέλεγχος δείγματος' })).getByRole('button', { name: /Αποθήκευση/ }))
    const child = await waitFor(() => {
      const node = within(body()).getByText(/LAB-260771-R1/).closest('.sv-sample-node')
      expect(node).toHaveClass('is-followup')
      return node
    })
    expect(child).toHaveTextContent('Επανέλεγχος 1')
    expect(parent.contains(child)).toBe(true)
  })

  it('does not offer to start a surveillance from a negative sample', async () => {
    const unlinked = { ...structuredClone(laboratorySamples.find(sample => sample.id === 'LAB-260827-001')), surveillanceCase: null, ast: [], critical: false, resistance: null, organism: null }
    laboratorySamples.unshift({ ...unlinked, id: 'LAB-NEG-1', result: 'negative' }, { ...unlinked, id: 'LAB-POS-1', result: 'positive', organism: 'Escherichia coli' })
    await openPatient('PT-260184')
    fireEvent.click(document.querySelector('tbody tr'))
    await openTab('Επιτήρηση & Δείγματα')
    const negative = within(body()).getByText(/LAB-NEG-1/).closest('.sv-sample')
    expect(negative.querySelector('.sample-negative-note')).toHaveAttribute('title', 'Ένα αρνητικό αποτέλεσμα δεν μπορεί να ξεκινήσει επιτήρηση.')
    expect(within(negative).queryByRole('button', { name: /Έναρξη επιτήρησης/ })).not.toBeInTheDocument()
    expect(within(within(body()).getByText(/LAB-POS-1/).closest('.sv-sample')).getByRole('button', { name: /Έναρξη επιτήρησης/ })).toBeInTheDocument()
  })

  it('collects samples with the canonical date and time fields', async () => {
    await openSurveillance()
    await openEpisode()
    const panel = await openStage('Δείγμα / Εργαστήριο')
    fireEvent.click(within(panel).getByRole('button', { name: /Νέο δείγμα/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByPlaceholderText('ηη/μμ/εεεε')).toBeInTheDocument()
    expect(within(dialog).getByText('Ώρα λήψης')).toBeInTheDocument()
    expect(dialog.querySelector('input[type="datetime-local"]')).toBeNull()
  })
})

describe('surveillance episode journey', () => {
  it('shows assessment signs, risk factors and classification through the library labels', async () => {
    await openSurveillance()
    await openEpisode()
    const panel = await openStage('Κλινική αξιολόγηση')
    for (const label of ['Λοίμωξη', 'Πυρετός >38°C', 'Υπόταση', 'Κεντρικός φλεβικός καθετήρας']) expect(within(panel).getByText(label)).toBeInTheDocument()
  })

  it('derives MDR from validated microbiology instead of offering manual classification, and tells the Demo guide', async () => {
    const steps = []
    const listener = event => steps.push(`${event.detail.key}/${event.detail.step}`)
    window.addEventListener(DEMO_STEP_EVENT, listener)
    await openSurveillance()
    await openEpisode()
    const panel = await openStage('HAI / AMR')
    window.removeEventListener(DEMO_STEP_EVENT, listener)
    expect(steps).toContain('clabsi_classification/hai')
    expect(within(panel).getByText('Παράγεται από επικυρωμένα μικροβιολογικά/AST δεδομένα.')).toBeInTheDocument()
    expect(within(panel).getAllByRole('button').map(button => button.textContent.trim())).toEqual(['Νέα αξιολόγηση HAI'])
  })

  it('builds the HAI options from the centrally governed criteria sets of the organization', async () => {
    criteriaSets = { custom_bsi: { labelEl: 'Τοπικός ορισμός BSI', labelEn: 'Local BSI definition', source: 'Local' } }
    await openSurveillance()
    await openEpisode()
    const panel = await openStage('HAI / AMR')
    fireEvent.click(within(panel).getByRole('button', { name: /Νέα αξιολόγηση HAI/ }))
    await waitFor(() => expect(loadHaiCriteriaSets).toHaveBeenCalledWith('demo-hospital'))
    await waitFor(() => expect(within(screen.getByRole('dialog')).getAllByRole('option').some(option => /Τοπικός ορισμός BSI/.test(option.textContent))).toBe(true))
  })

  it('offers the neonatal/infant CLABSI definition for an infant', async () => {
    await openRecord('/surveillance/SUR-260045')
    await screen.findByRole('tab', { name: /Επιτήρηση & Δείγματα/ })
    await openTab('Επιτήρηση & Δείγματα')
    fireEvent.click(document.querySelector('.sv-episode-head'))
    await screen.findByRole('button', { name: /Ενέργειες επιτήρησης/ })
    const panel = await openStage('HAI / AMR')
    fireEvent.click(within(panel).getByRole('button', { name: /Νέα αξιολόγηση HAI/ }))
    const definitions = await waitFor(() => {
      const select = within(screen.getByRole('dialog')).getAllByRole('combobox').find(item => optionsOf(item).some(text => text.startsWith('CLABSI')))
      expect(select).toBeDefined()
      return optionsOf(select)
    })
    const neonatal = definitions.findIndex(text => text.startsWith('CLABSI (νεογνική/βρεφική ≤1 έτους)'))
    const adult = definitions.findIndex((text, index) => index !== neonatal && text.startsWith('CLABSI'))
    expect(neonatal).toBeGreaterThanOrEqual(0)
    expect(neonatal).toBeLessThan(adult)
  })

  it('records administration only for an approved active therapy', async () => {
    clinicalCases['SUR-260041'].therapy[0].status = 'active'
    clinicalCases['SUR-260041'].therapy.push({ id: 'TX-PENDING', antimicrobial: 'Colistin', dose: '9 MU', route: 'IV', startedAt: '2026-08-27', status: 'active', approvalStatus: 'pending' })
    await openSurveillance()
    await openEpisode()
    const panel = await openStage('Αντιμικροβιακή αγωγή')
    fireEvent.click(within(panel).getByText('Ceftazidime/avibactam'))
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Καταγραφή χορήγησης' })).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: /Κλείσιμο/ })[0])
    fireEvent.click(within(panel).getByText('Colistin'))
    const detail = screen.getByRole('dialog')
    expect(within(detail).getByRole('button', { name: 'Έγκριση' })).toBeInTheDocument()
    expect(within(detail).getByRole('button', { name: 'Απόρριψη' })).toBeInTheDocument()
    expect(within(detail).queryByRole('button', { name: 'Καταγραφή χορήγησης' })).not.toBeInTheDocument()
  })

  it('requires a reason before deleting a surveillance', async () => {
    await openSurveillance()
    await openEpisode()
    fireEvent.click(screen.getByRole('button', { name: /Ενέργειες επιτήρησης/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Διαγραφή επιτήρησης/ }))
    const dialog = screen.getByRole('dialog')
    const confirm = within(dialog).getAllByRole('button').at(-1)
    expect(confirm).toBeDisabled()
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Λάθος καταχώριση' } })
    expect(confirm).toBeEnabled()
  })

  it('requires a reason before reopening a completed surveillance', async () => {
    Object.assign(clinicalCases['SUR-260041'], { status: 'completed', outcome: { status: 'resolved', date: '2026-08-30' } })
    await openSurveillance()
    await openEpisode()
    fireEvent.click(screen.getByRole('button', { name: /Επαναφορά σε ενεργή επιτήρηση/ }))
    const dialog = screen.getByRole('dialog')
    const confirm = within(dialog).getAllByRole('button').at(-1)
    expect(confirm).toBeDisabled()
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Νέο θετικό δείγμα' } })
    expect(confirm).toBeEnabled()
  })
})

describe('clinical data and documents', () => {
  it('translates clinical terms instead of showing raw keys', async () => {
    await openSurveillance()
    await openTab('Κλινικά δεδομένα')
    expect(screen.getAllByText('Λοίμωξη').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Κλινική βελτίωση').length).toBeGreaterThan(0)
    expect(screen.queryByText('infection')).not.toBeInTheDocument()
    expect(screen.queryByText('clinicalImprovement')).not.toBeInTheDocument()
  })

  it('keeps documents added in demo with the surveillance', async () => {
    await openSurveillance()
    await openTab('Έγγραφα')
    fireEvent.click(screen.getByRole('button', { name: /Προσθήκη επισύναψης/ }))
    fireEvent.change(screen.getByRole('dialog').querySelector('input[type="file"]'), { target: { files: [new File(['%PDF'], 'culture.pdf', { type: 'application/pdf' })] } })
    const save = within(screen.getByRole('dialog')).getByRole('button', { name: 'Αποθήκευση' })
    await waitFor(() => expect(save).toBeEnabled())
    fireEvent.click(save)
    expect(await screen.findByText('culture.pdf')).toBeInTheDocument()
    await openTab('Ιστορικό')
    await openTab('Έγγραφα')
    expect(screen.getByText('culture.pdf')).toBeInTheDocument()
  })
})
