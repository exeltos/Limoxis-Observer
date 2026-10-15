import { useMemo, useState } from 'react'
import { Button } from '../../design-system/Button'
import { ChoiceChips } from '../../design-system/ChoiceChips'
import { ManualDateField } from '../../design-system/ManualDateField'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { useEmployeesData } from '../employees/useEmployeesData'
import {
  createEmployeeSurveillance,
  createEmployeeSurveillanceBatch,
} from './employeeSurveillanceData'
import {
  createEmployeeSurveillanceBatch as createCloudBatch,
  createEmployeeSurveillanceRecord,
} from './employeeSurveillanceCloudService'
import './surveillanceEntryCard.css'

const screeningCatalog = [
  { id: 'handSwab', el: 'Επίχρισμα χεριών', en: 'Hand swab' },
  { id: 'nasalSwab', el: 'Ρινικό επίχρισμα', en: 'Nasal swab' },
  { id: 'throatSwab', el: 'Φαρυγγικό επίχρισμα', en: 'Throat swab' },
]

// One list: tick one employee or as many as needed. A single tick creates an
// individual record, more than one a batch.
export function EmployeeSurveillanceCanonicalFlow({ employee = null, onClose, onCreated }) {
  const actor = useAuditActor(),
    { tenant, isDemo } = useTenant(),
    { language, t } = useLanguage(),
    { notify, notifyError } = useFeedback(),
    { data: employeeRows = [] } = useEmployeesData()
  const [department, setDepartment] = useState('all'),
    [selectedIds, setSelectedIds] = useState([]),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [types, setTypes] = useState(['nasalSwab']),
    [notes, setNotes] = useState(''),
    [saving, setSaving] = useState(false)
  const activeEmployees = useMemo(
    () => employeeRows.filter(row => row.employmentStatus === 'active'),
    [employeeRows],
  )
  const departments = useMemo(
    () => [
      ...new Set(
        activeEmployees
          .map(row => (language === 'el' ? row.department : row.departmentEn))
          .filter(Boolean),
      ),
    ],
    [activeEmployees, language],
  )
  const visible = activeEmployees.filter(
      row =>
        department === 'all' ||
        (language === 'el' ? row.department : row.departmentEn) === department,
    ),
    chosen = employee ? [employee] : activeEmployees.filter(row => selectedIds.includes(row.id))
  const toggleType = id =>
      setTypes(current =>
        current.includes(id) ? current.filter(item => item !== id) : [...current, id],
      ),
    toggleEmployee = id =>
      setSelectedIds(current =>
        current.includes(id) ? current.filter(item => item !== id) : [...current, id],
      )
  const allVisible = visible.length > 0 && visible.every(row => selectedIds.includes(row.id)),
    toggleAll = () =>
      setSelectedIds(current =>
        allVisible
          ? current.filter(id => !visible.some(row => row.id === id))
          : [...new Set([...current, ...visible.map(row => row.id)])],
      )
  async function save() {
    if (saving || !date || !types.length) return
    setSaving(true)
    try {
      if (!chosen.length) return
      if (chosen.length > 1) {
        const employees = chosen
        if (isDemo) {
          const first = employees[0]
          createEmployeeSurveillanceBatch({
            employees,
            screeningTypes: types,
            startedAt: date,
            department:
              department === 'all'
                ? language === 'en'
                  ? 'Multiple departments'
                  : 'Πολλαπλά τμήματα'
                : language === 'el'
                  ? first.department
                  : first.departmentEn,
            departmentEn: department === 'all' ? 'Multiple departments' : first.departmentEn,
            notes,
            createdBy: actor.name,
            createdById: actor.id,
          })
        } else {
          if (!tenant?.id) throw new Error('Organization is required.')
          await createCloudBatch(tenant.id, employees, {
            startedAt: date,
            screeningTypes: types,
            departmentId: department === 'all' ? null : employees[0]?.departmentId || null,
            notes,
          })
        }
        notify(
          language === 'en'
            ? 'Bulk employee surveillance created.'
            : 'Η μαζική επιτήρηση εργαζομένων δημιουργήθηκε.',
          'success',
        )
      } else {
        const selected = chosen[0]
        if (isDemo)
          createEmployeeSurveillance({
            employee: selected,
            screeningTypes: types,
            startedAt: date,
            notes,
            createdBy: actor.name,
            createdById: actor.id,
          })
        else {
          if (!tenant?.id || !selected.dbId) throw new Error('Employee cloud record is required.')
          await createEmployeeSurveillanceRecord(tenant.id, selected.dbId, {
            startedAt: date,
            screeningTypes: types,
            notes,
          })
        }
        notify(
          language === 'en'
            ? 'Employee surveillance created.'
            : 'Η επιτήρηση εργαζομένου δημιουργήθηκε.',
          'success',
        )
      }
      await onCreated?.()
      onClose()
    } catch (error) {
      notifyError(error, 'save', {
        operation:
          chosen.length > 1 ? 'employee_surveillance_batch_create' : 'employee_surveillance_create',
      })
    } finally {
      setSaving(false)
    }
  }
  const en = language === 'en',
    valid = chosen.length > 0
  return (
    <ObserverDialog
      width="standard"
      className="surveillance-entry employee-surveillance-entry"
      eyebrow={en ? 'New surveillance' : 'Νέα επιτήρηση'}
      title={t('svEmployeeSurveillance')}
      subtitle={
        en
          ? 'Tick one or more employees; each one gets their own surveillance record.'
          : 'Επιλέξτε έναν ή περισσότερους εργαζόμενους· ο καθένας αποκτά τη δική του επιτήρηση.'
      }
      fixedHeight
      onClose={onClose}
      footer={
        <Button disabled={saving || !date || !types.length || !valid} onClick={save}>
          {saving
            ? en
              ? 'Saving…'
              : 'Αποθήκευση…'
            : en
              ? 'Create surveillance'
              : 'Δημιουργία επιτήρησης'}
        </Button>
      }
    >
      <div className="employee-surveillance-body">
        <div className="bulk-surveillance-controls">
          <label className="field">
            <span className="lo-field-label">{en ? 'Department' : 'Τμήμα'}</span>
            <select value={department} onChange={event => setDepartment(event.target.value)}>
              <option value="all">{en ? 'All departments' : 'Όλα τα τμήματα'}</option>
              {departments.map(value => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <ManualDateField
            label={en ? 'Screening date' : 'Ημερομηνία ελέγχου'}
            value={date}
            onChange={setDate}
          />
        </div>
        <ScreeningTypes types={types} toggle={toggleType} en={en} />
        <div className="bulk-employee-list">
          <div className="bulk-list-head" aria-live="polite">
            {!employee && (
              <Button variant="secondary" onClick={toggleAll}>
                {allVisible
                  ? en
                    ? 'Clear visible'
                    : 'Καθαρισμός ορατών'
                  : en
                    ? 'Select all visible'
                    : 'Επιλογή όλων'}
              </Button>
            )}
            <strong>
              {en ? 'Selected' : 'Επιλεγμένοι'}: {chosen.length}
            </strong>
          </div>
          {(employee ? [employee] : visible).map(row => {
            const checked = Boolean(employee) || selectedIds.includes(row.id)
            return (
              <div key={row.id} className={`bulk-employee-row ${checked ? 'selected' : ''}`}>
                <label>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={Boolean(employee)}
                    onChange={() => toggleEmployee(row.id)}
                  />
                  <span>
                    <strong>
                      {language === 'el'
                        ? `${row.lastName} ${row.firstName}`
                        : `${row.firstNameEn} ${row.lastNameEn}`}
                    </strong>
                    <small>
                      {row.id} · {language === 'el' ? row.department : row.departmentEn}
                    </small>
                  </span>
                </label>
              </div>
            )
          })}
        </div>
        <label className="field bulk-notes">
          <span className="lo-field-label">{en ? 'Notes' : 'Σημειώσεις'}</span>
          <textarea
            data-limoxis-no-expand="true"
            rows={3}
            value={notes}
            onChange={event => setNotes(event.target.value)}
          />
        </label>
      </div>
    </ObserverDialog>
  )
}
function ScreeningTypes({ types, toggle, en }) {
  return (
    <ChoiceChips
      className="bulk-screening-types"
      label={en ? 'Screening type' : 'Τύπος ελέγχου'}
      options={screeningCatalog.map(item => ({ value: item.id, label: en ? item.en : item.el }))}
      selected={types}
      onToggle={toggle}
    />
  )
}
