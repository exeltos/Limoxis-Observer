// @vitest-environment jsdom
// The Demo guide's guided tour (as in SurgiTrack): a note beside the element to
// press, moving on when it is pressed or when the screen checks the step off;
// the welcome that starts it; and the "who is who" roles table in Help.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'

vi.mock('../src/features/demo/demoTourStops', () => ({
  DEMO_TOUR_STOPS: {
    microbiology_mdro: [
      { step: 'open', target: { sel: 'tbody tr', text: ['LAB-1', 'LAB-1'] }, titleEl: 'Θετική καλλιέργεια', titleEn: 'Positive culture', textEl: 'Πατήστε τη γραμμή.', textEn: 'Press the row.', advance: 'click' },
      { step: 'ast', target: { sel: 'button', text: ['Προσθήκη αντιβιογράμματος', 'Add susceptibility test'] }, titleEl: 'Αντιβιόγραμμα', titleEn: 'Susceptibility', textEl: 'Πατήστε «Προσθήκη αντιβιογράμματος».', textEn: 'Press it.', advance: 'click' },
      { step: 'ast', target: { sel: '.lab-ast-form' }, titleEl: 'Τα αποτελέσματα', titleEn: 'Results', textEl: 'Συμπληρώστε τα αντιβιοτικά.', textEn: 'Fill in.' },
      { step: 'amr', target: { sel: '[data-demo-step="microbiology_mdro:amr"]' }, titleEl: 'AMR', titleEn: 'AMR', textEl: 'Ταξινομήστε.', textEn: 'Classify.', advance: 'click' },
    ],
  },
}))
vi.mock('../src/features/demo/demoEvaluationService', () => ({
  loadMyDemoProgress: vi.fn(async () => ({})), loadMyDemoApplicationRequests: vi.fn(async () => []), loadMyDemoRatings: vi.fn(async () => ({})),
  setDemoEvaluationStep: vi.fn(async () => ({ guide_opened: 'now' })), rateDemoEvaluationStep: vi.fn(), requestDemoApplication: vi.fn(), submitDemoScenarioFeedback: vi.fn(),
  hasExtendedDemoSchema: () => true,
}))

const { findTourTarget, demoTourStops } = await import('../src/features/demo/demoTours')
const { DemoGuidedTour } = await import('../src/features/demo/DemoGuidedTour')
const { useDemoEvaluation } = await import('../src/features/demo/useDemoEvaluation')
const { signalDemoStep } = await import('../src/features/demo/demoScenarioSignals')
const { DEMO_ALL_SCENARIOS } = await import('../src/features/demo/demoScenarios')

// jsdom lays nothing out: every element is given a box so the tour can find it.
beforeEach(() => {
  sessionStorage.clear()
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 100, left: 100, width: 120, height: 30, right: 220, bottom: 130, x: 100, y: 100, toJSON() {} })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); sessionStorage.clear() })

const microbiology = DEMO_ALL_SCENARIOS.find(scenario => scenario.key === 'microbiology_mdro')
const note = () => screen.getByRole('dialog', { name: /./ })

describe('tour targets and stops', () => {
  it('finds an element by selector and the text of the current language', () => {
    document.body.innerHTML = '<button>Ακύρωση</button><button aria-label="Add susceptibility test">+</button><button>Προσθήκη αντιβιογράμματος</button>'
    const target = { sel: 'button', text: ['Προσθήκη αντιβιογράμματος', 'Add susceptibility test'] }
    expect(findTourTarget(target, 'el').textContent).toBe('Προσθήκη αντιβιογράμματος')
    expect(findTourTarget(target, 'en').textContent).toBe('+')
    expect(findTourTarget({ sel: 'button', text: ['Καμία', 'None'] }, 'el')).toBeNull()
    expect(findTourTarget({ sel: '[[bad' }, 'el')).toBeNull()
    document.body.innerHTML = ''
  })

  it('skips the stops of steps already done', () => {
    expect(demoTourStops('microbiology_mdro', {}).length).toBe(4)
    expect(demoTourStops('microbiology_mdro', { open: true, ast: true }).map(stop => stop.titleEl)).toEqual(['AMR'])
    expect(demoTourStops('hand_hygiene', {})).toEqual([])
  })
})

describe('the tour over the screen', () => {
  function Screen({ stops, onFinish = () => {}, onClose = () => {} }) {
    return <>
      <table><tbody><tr><td>LAB-1</td></tr></tbody></table>
      <button type="button">Προσθήκη αντιβιογράμματος</button>
      <div className="lab-ast-form">form</div>
      <DemoGuidedTour scenario={microbiology} stops={stops} stepNumber={1} stepTotal={4} language="el" onClose={onClose} onFinish={onFinish}/>
    </>
  }

  it('puts the note beside the element and moves on when it is pressed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    render(<Screen stops={demoTourStops('microbiology_mdro', {})}/>)
    expect(within(note()).getByText('Θετική καλλιέργεια')).toBeInTheDocument()
    expect(within(note()).getByText(/βήμα 1\/4/)).toBeInTheDocument()
    expect(document.querySelector('.demo-tour-spot')).toHaveStyle({ top: '94px', left: '94px', width: '132px', height: '42px' })
    fireEvent.click(screen.getByText('LAB-1'))
    act(() => vi.advanceTimersByTime(400))
    expect(within(note()).getByText('Αντιβιόγραμμα')).toBeInTheDocument()
    // A click elsewhere does not move it.
    fireEvent.click(screen.getByText('form'))
    act(() => vi.advanceTimersByTime(400))
    expect(within(note()).getByText('Αντιβιόγραμμα')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('offers Skip, Next, Back and Done, and waits for an element not on screen yet', () => {
    const onFinish = vi.fn()
    render(<Screen stops={demoTourStops('microbiology_mdro', {})} onFinish={onFinish}/>)
    fireEvent.click(within(note()).getByRole('button', { name: /Παράλειψη/ }))
    fireEvent.click(within(note()).getByRole('button', { name: /Παράλειψη/ }))
    expect(within(note()).getByText('Τα αποτελέσματα')).toBeInTheDocument()
    fireEvent.click(within(note()).getByRole('button', { name: /Πίσω/ }))
    expect(within(note()).getByText('Αντιβιόγραμμα')).toBeInTheDocument()
    fireEvent.click(within(note()).getByRole('button', { name: /Παράλειψη/ }))
    fireEvent.click(within(note()).getByRole('button', { name: /Επόμενο/ }))
    // The AMR card is not on this screen: the note waits in the middle.
    expect(within(note()).getByText('Συνεχίζει μόλις εμφανιστεί στην οθόνη.')).toBeInTheDocument()
    expect(document.querySelector('.demo-tour-dim')).toBeInTheDocument()
    fireEvent.click(within(note()).getByRole('button', { name: 'Τέλος' }))
    expect(onFinish).toHaveBeenCalled()
  })

  it('ends with Escape or the close button', () => {
    const onClose = vi.fn()
    render(<Screen stops={demoTourStops('microbiology_mdro', {})} onClose={onClose}/>)
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(within(note()).getByRole('button', { name: 'Τέλος ξενάγησης' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('welcome and tour in the guide flow', () => {
  let api
  let goTo
  function Harness() {
    const navigate = useNavigate()
    goTo = navigate
    api = useDemoEvaluation({ enabled: true, organizationId: 'demo-1', organizationName: 'Demo Νοσοκομείο', userId: 'user-1', profile: {}, isPlatformOwner: false, role: 'laboratory', language: 'el', navigate })
    return <>
      <table><tbody><tr><td>LAB-1</td></tr></tbody></table>
      {api.dialogs}
    </>
  }

  it('welcomes the evaluator, tours the first scenario and moves on as steps are checked off', async () => {
    render(<MemoryRouter initialEntries={['/']}><LanguageProvider><Harness/></LanguageProvider></MemoryRouter>)
    const welcome = await screen.findByRole('dialog', { name: /Καλώς ήρθατε/ })
    expect(within(welcome).getByText(/Το Demo «Demo Νοσοκομείο» έχει δοκιμαστικούς ασθενείς/)).toBeInTheDocument()
    expect(within(welcome).getByText('Ένα σενάριο, με ξενάγηση')).toBeInTheDocument()
    fireEvent.click(within(welcome).getByRole('button', { name: /Ξενάγηση: Μικροβιολογικό/ }))
    expect(await screen.findByText('Θετική καλλιέργεια')).toBeInTheDocument()
    // While the tour runs, the scenario card steps aside.
    expect(screen.queryByRole('complementary', { name: 'Σενάριο αξιολόγησης' })).not.toBeInTheDocument()
    // Opening the culture checks the first step off: the tour skips to the next step's stops.
    act(() => goTo('/laboratory/LAB-260827-001'))
    expect(await screen.findByText('Αντιβιόγραμμα')).toBeInTheDocument()
    expect(screen.getByText(/βήμα 2\/4/)).toBeInTheDocument()
    // The count runs over the whole tour, not only this step's stops.
    expect(screen.getByText('2/4')).toBeInTheDocument()
    act(() => { signalDemoStep('microbiology_mdro', 'ast') })
    expect(await screen.findByText('AMR')).toBeInTheDocument()
    // Ended, the card is back with "Show me" to tour again.
    fireEvent.click(screen.getByRole('button', { name: 'Τέλος ξενάγησης' }))
    const card = await screen.findByRole('complementary', { name: 'Σενάριο αξιολόγησης' })
    fireEvent.click(within(card).getByRole('button', { name: /Δείξε μου/ }))
    expect(await screen.findByText('AMR')).toBeInTheDocument()
  })

  it('opens the scenarios list from the welcome', async () => {
    render(<MemoryRouter initialEntries={['/']}><LanguageProvider><Harness/></LanguageProvider></MemoryRouter>)
    fireEvent.click(within(await screen.findByRole('dialog', { name: /Καλώς ήρθατε/ })).getByRole('button', { name: 'Δείτε τα σενάρια' }))
    expect(await screen.findByRole('dialog', { name: /Οδηγός αξιολόγησης/ })).toBeInTheDocument()
  })
})

describe('who is who', () => {
  it('lists every hospital role with its menu, its work and its Demo scenarios', async () => {
    const { HelpRolesView } = await import('../src/core/help/HelpRolesView')
    render(<LanguageProvider><HelpRolesView/></LanguageProvider>)
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(13)
    const hr = rows.find(row => within(row).queryByText('Γραφείο Προσωπικού'))
    expect(hr).toHaveTextContent('Μητρώο εργαζομένων')
    expect(hr).toHaveTextContent('Σενάρια Demo: Καρτέλα εργαζομένου · Αξιολόγηση απόδοσης')
    // What it sees is its real menu.
    expect(within(hr).getAllByRole('cell')[2]).toHaveTextContent(/Προσωπικό|Εργαζόμενοι/)
  })
})
