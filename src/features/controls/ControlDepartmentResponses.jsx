import { ChoiceField } from '../../design-system/ChoiceField'
import { Field } from '../../design-system/Field'
import { limitsText } from './controlResponse'

// «Limits and actions per department» of a control that several departments share: by default every
// department follows the control's limits and deviation text; a department can have its own.
export function ControlDepartmentResponses({ departments = [], base = {}, numeric = false, value = {}, onChange, en, selectText }) {
  if (departments.length < 2) return null
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
  const sameLabel = en ? 'Same as above' : 'Όπως παραπάνω'
  const baseSummary = [numeric && limitsText(base), base.deviationActions && (en ? 'with the actions above' : 'με τις ενέργειες παραπάνω')].filter(Boolean).join(' · ')
  return (
    <div className="control-department-responses">
      <span className="lo-field-label">{numeric ? (en ? 'Limits and actions per department (optional)' : 'Όρια και ενέργειες ανά τμήμα (προαιρετικό)') : (en ? 'Actions per department (optional)' : 'Ενέργειες ανά τμήμα (προαιρετικό)')}</span>
      {departments.map(department => {
        const response = own(department)
        return (
          <div key={department} className="control-department-response">
            <strong>{department}</strong>
            <ChoiceField
              hideLabel
              label={en ? 'Limits and actions' : 'Όρια και ενέργειες'}
              value={response ? 'own' : 'same'}
              onChange={choice => (choice === 'own' ? startOwn(department) : stopOwn(department))}
              options={[
                { value: 'same', label: baseSummary ? `${sameLabel} (${baseSummary})` : sameLabel },
                { value: 'own', label: en ? 'Its own' : 'Δικά του' },
              ]}
              {...selectText}
              clearLabel=""
            />
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
