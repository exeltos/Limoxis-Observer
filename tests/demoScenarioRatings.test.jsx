// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DEMO_SCENARIOS } from '../src/features/demo/demoScenarios'
import { DEMO_SCENARIO_EVENT, demoScenarioForPath, nextDemoScenario, signalDemoScenario } from '../src/features/demo/demoScenarioSignals'
import { DemoScenarioRating } from '../src/features/demo/DemoScenarioCards'

afterEach(() => cleanup())

describe('Demo scenario completion', () => {
  it('signals only the guide scenarios', () => {
    const seen = []
    const listener = (event) => seen.push(event.detail.key)
    window.addEventListener(DEMO_SCENARIO_EVENT, listener)
    signalDemoScenario('patient_admission')
    signalDemoScenario('not_a_scenario')
    window.removeEventListener(DEMO_SCENARIO_EVENT, listener)
    expect(seen).toEqual(['patient_admission'])
  })

  it('completes the look-at-a-record scenarios on their record routes only', () => {
    expect(demoScenarioForPath('/surveillance/7f1c')).toBe('clabsi_classification')
    expect(demoScenarioForPath('/laboratory/abc')).toBe('microbiology_mdro')
    expect(demoScenarioForPath('/surveillance')).toBeNull()
    expect(demoScenarioForPath('/laboratory/abc/print')).toBeNull()
    expect(demoScenarioForPath('/patients/1')).toBeNull()
  })

  it('suggests the next scenario not done, wrapping round, and none when all are done', () => {
    expect(nextDemoScenario('patient_admission', {}).key).toBe('clabsi_classification')
    expect(nextDemoScenario('analysis_export', { patient_admission: 'x' }).key).toBe('clabsi_classification')
    const allDone = Object.fromEntries(DEMO_SCENARIOS.map((scenario) => [scenario.key, 'x']))
    expect(nextDemoScenario('hand_hygiene', allDone)).toBeNull()
  })
})

describe('Demo scenario rating card', () => {
  const scenario = DEMO_SCENARIOS[0]

  it('sends the stars and the comment, then offers the next scenario', async () => {
    const onSubmit = vi.fn().mockResolvedValue({})
    const onNext = vi.fn()
    render(<DemoScenarioRating scenario={scenario} next={DEMO_SCENARIOS[1]} language="el" onSubmit={onSubmit} onNext={onNext} onLater={() => {}} />)
    const send = screen.getByRole('button', { name: 'Αποστολή' })
    expect(send.disabled).toBe(true)
    fireEvent.click(screen.getAllByRole('radio')[3])
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Γρήγορο' } })
    fireEvent.click(send)
    expect(onSubmit).toHaveBeenCalledWith(4, 'Γρήγορο')
    fireEvent.click(await screen.findByRole('button', { name: /Επόμενο σενάριο/ }))
    expect(onNext).toHaveBeenCalledWith(DEMO_SCENARIOS[1])
  })

  it('keeps the card and says so when the rating is not sent', async () => {
    render(<DemoScenarioRating scenario={scenario} language="el" onSubmit={vi.fn().mockRejectedValue(new Error('x'))} onLater={() => {}} />)
    fireEvent.click(screen.getAllByRole('radio')[0])
    fireEvent.click(screen.getByRole('button', { name: 'Αποστολή' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
  })

  it('after the overall rating offers "I want the application"', async () => {
    const onRequestApplication = vi.fn()
    render(<DemoScenarioRating scenario={null} language="en" canRequest onSubmit={vi.fn().mockResolvedValue({})} onLater={() => {}} onRequestApplication={onRequestApplication} />)
    expect(screen.getByText('Overall, how did you find the application?')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('radio')[4])
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    fireEvent.click(await screen.findByRole('button', { name: /I want the application/ }))
    expect(onRequestApplication).toHaveBeenCalled()
  })
})
