// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { chooseOption } from './selectHelpers'

vi.mock('../src/features/employees/useEmployeesData', () => ({ useEmployeesData: () => ({ data: [{ id: 'e1', firstName: 'Άννα', lastName: 'Μάρκου', employmentStatus: 'active' }] }) }))
vi.mock('../src/features/management/useLibraries', async original => ({ ...(await original()), useLibraries: () => ({ libraries: { incidentCategories: [] } }) }))
const { IncidentEventFields, IncidentEventSummary } = await import('../src/features/quality/IncidentEventDetails')
const { QualityRecordDocument } = await import('../src/features/quality/QualityRecordDocument')

afterEach(cleanup)

describe('incident event details on screen', () => {
  it('shows no block for an event type without details', () => {
    const { container } = render(<IncidentEventFields record={{ eventType: 'death' }} onChange={() => {}} language="el" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('edits the fall block and asks for the employee only for an injured employee', () => {
    let record = { eventType: 'injury_fall_exposure', fall: { injuredPersonType: 'patient' } }
    const { rerender } = render(<IncidentEventFields record={record} onChange={next => { record = next }} language="en" />)
    chooseOption(document.body, /Injured person|Who was injured|person/i, 'Employee')
    expect(record.fall.injuredPersonType).toBe('employee')
    rerender(<IncidentEventFields record={record} onChange={next => { record = next }} language="en" />)
    expect(screen.getAllByText('Employee').length).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Ward 3' } })
    expect(record.fall.location).toBe('Ward 3')
  })

  it('adds the sharps block after a sharp-object injury, and the blue code its interventions', () => {
    render(<IncidentEventFields record={{ eventType: 'injury_fall_exposure', fall: { injurySubcategory: 'sharp_object' } }} onChange={() => {}} language="en" />)
    expect(screen.getByText('Contact duration')).toBeInTheDocument()
    cleanup()
    render(<IncidentEventFields record={{ eventType: 'blue_code' }} onChange={() => {}} language="en" />)
    expect(screen.getByText('Interventions')).toBeInTheDocument()
  })

  it('shows the details filled in, on the record and in its PDF', () => {
    const record = { id: 'INC-1', title: 'Πτώση', status: 'reported', reportKind: 'clinical', eventType: 'blue_code', blueCode: { interventions: ['cpr', 'oxygen'], outcome: 'successful', transferTo: 'icu' } }
    const { container } = render(<IncidentEventSummary record={record} language="el" />)
    expect(container).toHaveTextContent('Μπλε κωδικός')
    expect(container).toHaveTextContent('ΚΑΡΠΑ, Οξυγόνο')
    cleanup()
    const doc = render(<QualityRecordDocument recordType="incidents" record={record} language="el" t={value => value} />).container
    expect(doc).toHaveTextContent('Επιτυχής')
    expect(doc).toHaveTextContent('ΜΕΘ')
  })
})
