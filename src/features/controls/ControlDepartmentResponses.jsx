import { ChoiceField } from '../../design-system/ChoiceField'
import { Field } from '../../design-system/Field'
import { limitsText } from './controlResponse'

// «Limits and actions per department» of a control that several departments share: by default every
// department follows the control's limits and deviation text; a department can have its own.
// compact: one department in the editor's «Departments» table, in two parts:
// part 'summary' is the cell, part 'fields' its own limits/actions, full width under the row.
export function ControlDepartmentResponses({ departments = [], base = {}, numeric = false, value = {}, onChange, en, selectText, compact = false, part = 'summary' }) {
  if (departments.length < 2 && !compact) return null
  const own = department => value[department] || null
  const startOwn = department => onChange({
    ...value,
    [department]: { ...(numeric ? { min: base.min ?? '', max: base.max ?? '' } : {}), deviationActions: base.deviationActions || '' },
  })
  const stopOwn = department => {
    const next = { ...value }
    delete next[department]
    onChange(next)
  }
  const patch = (department, changes) => onChange({ ...value, [department]: { ...own(department), ...changes } })
  const sameLabel = compact ? (en ? 'Same for all' : 'Όπως όλα') : (en ? 'Same as above' : 'Όπως παραπάνω')
  const baseSummary = [numeric && limitsText(base), base.deviationActions && (en ? 'with the actions above' : 'με τις ενέργειες παραπάνω')].filter(Boolean).join(' · ')
  if (compact && part === 'summary') {
    const department = departments[0]
    const response = own(department)
    return response
      ? <div className="control-department-cell is-own"><strong>{[numeric && limitsText(response), en ? 'own actions' : 'δικές του ενέργειες'].filter(Boolean).join(' · ')}</strong><button type="button" className="control-department-cell-action" onClick={() => stopOwn(department)}>{sameLabel}</button></div>
      : <div className="control-department-cell"><span>{sameLabel}{numeric && limitsText(base) ? ` (${limitsText(base)})` : ''}</span><button type="button" className="control-department-cell-action" onClick={() => startOwn(department)}>{en ? 'Change' : 'Αλλαγή'}</button></div>
  }
  if (compact && !own(departments[0])) return null
  return (
    <div className={`control-department-responses${compact ? ' is-compact' : ''}`}>
      {!compact && <span className="lo-field-label">{numeric ? (en ? 'Limits and actions per department (optional)' : 'Όρια και ενέργειες ανά τμήμα (προαιρετικό)') : (en ? 'Actions per department (optional)' : 'Ενέργειες ανά τμήμα (προαιρετικό)')}</span>}
      {departments.map(department => {
        const response = own(department)
        return (
          <div key={department} className="control-department-response">
            {!compact && <strong>{department}</strong>}
            {!compact && <ChoiceField
              hideLabel
              label={en ? `Limits and actions: ${department}` : `Όρια και ενέργειες: ${department}`}
              value={response ? 'own' : 'same'}
              onChange={choice => (choice === 'own' ? startOwn(department) : stopOwn(department))}
              options={[
                { value: 'same', label: baseSummary ? `${sameLabel} (${baseSummary})` : sameLabel },
                { value: 'own', label: en ? 'Its own' : 'Δικά του' },
              ]}
              {...selectText}
              clearLabel=""
            />}
            {response && (
              <div className="control-department-response-fields">
                {numeric && (
                  <>
                    <Field label={en ? 'Minimum acceptable' : 'Ελάχιστο αποδεκτό'}>
                      <input type="number" step="any" value={response.min ?? ''} onChange={event => patch(department, { min: event.target.value === '' ? '' : Number(event.target.value) })} />
                    </Field>
                    <Field label={en ? 'Maximum acceptable' : 'Μέγιστο αποδεκτό'}>
                      <input type="number" step="any" value={response.max ?? ''} onChange={event => patch(department, { max: event.target.value === '' ? '' : Number(event.target.value) })} />
                    </Field>
                  </>
                )}
                <Field label={en ? 'Actions on deviation' : 'Ενέργειες σε απόκλιση'} className="control-department-response-actions">
                  <textarea rows="2" value={response.deviationActions ?? ''} onChange={event => patch(department, { deviationActions: event.target.value })} />
                </Field>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
