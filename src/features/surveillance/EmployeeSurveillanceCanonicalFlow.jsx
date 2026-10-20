import { useMemo, useState } from 'react'
import { FormSubmit, useFormValidation } from '../../design-system/FormValidation'
import { ChoiceChips } from '../../design-system/ChoiceChips'
import { ManualDateField } from '../../design-system/ManualDateField'
import { MultiSelect } from '../../design-system/MultiSelect'
import { SearchableSelect } from '../../design-system/SearchableSelect'
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
import { employeeScreeningOptions, listTexts } from './surveillanceOptions'
import './surveillanceEntryCard.css'

// One multi-select: pick one employee or as many as needed. A single pick creates an
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
    employeeLabel = row =>
      [
        language === 'el' ? `${row.lastName} ${row.firstName}` : `${row.firstNameEn} ${row.lastNameEn}`,
        language === 'el' ? row.department : row.departmentEn,
      ]
        .filter(Boolean)
        .join(' · '),
    // The department filter narrows the list; employees already picked in
    // another department stay listed so the field still shows them.
    employeeOptions = (
      employee
        ? [employee]
        : activeEmployees.filter(row => visible.includes(row) || selectedIds.includes(row.id))
    ).map(row => ({ value: row.id, label: employeeLabel(row) }))
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
    valid = chosen.length > 0,
    texts = listTexts(language)
  const form = useFormValidation([
    { key: 'date', label: en ? 'Screening date' : 'Ημερομηνία ελέγχου', valid: Boolean(date) },
    { key: 'types', label: en ? 'Screening type' : 'Τύπος ελέγχου', valid: types.length > 0 },
    { key: 'employees', label: en ? 'Employees' : 'Εργαζόμενοι', valid },
  ])
  // The window is as tall as its few fields (no fixed height with an empty area under them).
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
      onClose={onClose}
      footer={
        <FormSubmit form={form} icon={false} disabled={saving} onSubmit={save}>
          {saving
            ? en
              ? 'Saving…'
              : 'Αποθήκευση…'
            : en
              ? 'Create surveillance'
              : 'Δημιουργία επιτήρησης'}
        </FormSubmit>
      }
    >
      <div className="employee-surveillance-body">
        <div className="bulk-surveillance-controls">
          <SearchableSelect
            label={en ? 'Department' : 'Τμήμα'}
            value={department === 'all' ? '' : department}
            options={departments.map(value => ({ value, label: value }))}
            placeholder={en ? 'All departments' : 'Όλα τα τμήματα'}
            emptyLabel={texts.emptyLabel}
            clearLabel={texts.clearLabel}
            onChange={value => setDepartment(value || 'all')}
            hint={en ? 'Narrows the list of employees below.' : 'Περιορίζει τη λίστα εργαζομένων παρακάτω.'}
          />
          <ManualDateField
            label={en ? 'Screening date' : 'Ημερομηνία ελέγχου'}
            {...form.field('date')}
            value={date}
            onChange={setDate}
          />
        </div>
        <ScreeningTypes types={types} toggle={toggleType} en={en} fieldProps={form.field('types')} />
        <MultiSelect
          label={en ? 'Employees' : 'Εργαζόμενοι'}
          {...(employee ? {} : form.field('employees'))}
          options={employeeOptions}
          selected={employee ? [employee.id] : selectedIds}
          onChange={setSelectedIds}
          disabled={Boolean(employee)}
          placeholder={en ? 'Select employees' : 'Επιλέξτε εργαζόμενους'}
          searchPlaceholder={en ? 'Search name or department…' : 'Αναζήτηση ονόματος ή τμήματος…'}
          emptyLabel={en ? 'No employee matches' : 'Κανένας εργαζόμενος δεν ταιριάζει'}
          selectAllLabel={texts.selectAllLabel}
          clearAllLabel={texts.clearAllLabel}
          countLabel={n => (en ? `${n} employees selected` : `${n} επιλεγμένοι εργαζόμενοι`)}
        />
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
function ScreeningTypes({ types, toggle, en, fieldProps }) {
  return (
    <ChoiceChips
      {...fieldProps}
      className="bulk-screening-types"
      label={en ? 'Screening type' : 'Τύπος ελέγχου'}
      options={employeeScreeningOptions(en ? 'en' : 'el')}
      selected={types}
      onToggle={toggle}
    />
  )
}
