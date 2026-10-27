import { CalendarClock } from 'lucide-react'
import { ChoiceField } from '../../design-system/ChoiceField'
import { Field } from '../../design-system/Field'
import { TimeField } from '../../design-system/TimeField'
import { frequencyLabel } from './controlScheduling'

const KINDS = ['daily', 'weekly', 'monthly', 'yearly', 'custom']

// «Schedule per department» of a control that several departments share: by default every department
// follows the control's schedule; a department can have its own (frequency and exact times).
// compact: one department's cell in the editor's «Departments» table (no heading, no name).
export function ControlDepartmentSchedules({ departments = [], base, value = {}, onChange, en, kindLabels, selectText, compact = false }) {
  if (departments.length < 2 && !compact) return null
  const own = department => value[department] || null
  const startOwn = department => onChange({ ...value, [department]: { ...base, times: [...(base.times || [])] } })
  const stopOwn = department => {
    const next = { ...value }
    delete next[department]
    onChange(next)
  }
  const patch = (department, changes) => onChange({ ...value, [department]: { ...own(department), ...changes } })
  return (
    <div className={`control-department-schedules${compact ? ' is-compact' : ''}`}>
      {!compact && <span className="lo-field-label">{en ? 'Schedule per department (optional)' : 'Πρόγραμμα ανά τμήμα (προαιρετικό)'}</span>}
      {departments.map(department => {
        const frequency = own(department)
        const count = Math.max(1, Number(frequency?.timesPerDay) || 1)
        const times = Array.from({ length: count }, (_, index) => frequency?.times?.[index] || `${String(Math.min(23, 8 + index * 4)).padStart(2, '0')}:00`)
        return (
          <div key={department} className="control-department-schedule">
            {!compact && <strong>{department}</strong>}
            <ChoiceField
              hideLabel
              label={en ? `Schedule: ${department}` : `Πρόγραμμα: ${department}`}
              value={frequency ? 'own' : 'same'}
              onChange={choice => (choice === 'own' ? startOwn(department) : stopOwn(department))}
              options={[
                { value: 'same', label: en ? `${compact ? 'Same for all' : 'Same as above'} (${frequencyLabel(base, en ? 'en' : 'el')})` : `${compact ? 'Όπως όλα' : 'Όπως παραπάνω'} (${frequencyLabel(base, 'el')})` },
                { value: 'own', label: en ? 'Its own schedule' : 'Δικό του πρόγραμμα' },
              ]}
              {...selectText}
              clearLabel=""
            />
            {frequency && (
              <div className="control-department-schedule-fields">
                <ChoiceField
                  label={en ? 'Frequency' : 'Συχνότητα'}
                  value={frequency.kind}
                  onChange={kind => patch(department, { kind })}
                  options={KINDS.map(kind => ({ value: kind, label: kindLabels[kind] }))}
                  {...selectText}
                  clearLabel=""
                />
                {frequency.kind === 'daily' ? (
                  <Field label={en ? 'Times per day' : 'Φορές ανά ημέρα'}>
                    <input type="number" min="1" max="12" value={count} onChange={event => patch(department, { timesPerDay: Math.max(1, Math.min(12, Number(event.target.value) || 1)) })} />
                  </Field>
                ) : (
                  <Field label={en ? 'Every (units)' : 'Κάθε (μονάδες)'}>
                    <input type="number" min="1" value={frequency.interval || 1} onChange={event => patch(department, { interval: Math.max(1, Number(event.target.value) || 1) })} />
                  </Field>
                )}
                {frequency.kind === 'daily' && (
                  <div className="control-department-times">
                    <span className="lo-field-label"><CalendarClock size={13} /> {en ? 'Execution times' : 'Ώρες εκτέλεσης'}</span>
                    <div className="control-time-grid">
                      {times.map((time, index) => (
                        <TimeField
                          key={index}
                          className="control-time-field"
                          label={count > 1 ? (en ? `Execution ${index + 1}` : `${index + 1}η εκτέλεση`) : ''}
                          value={time}
                          onChange={next => {
                            const updated = [...times]
                            updated[index] = next
                            patch(department, { times: updated })
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
