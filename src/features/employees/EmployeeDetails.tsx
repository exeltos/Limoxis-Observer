import { STAFF_CATEGORIES, staffCategoryLabel, staffCategoryOf } from './staffCategory'
import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { ManualDateField } from '../../design-system/ManualDateField'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import {
  loadEmployeeHrOptionsAsync,
  updateEmployeeAsync,
} from './employeeService'
import type { AnyRecord } from '../../types/featureTypes'

// The «Details» tab of the employee record (EmployeeRecordPage): the facts, edited in place.
export function Details({
  employee,
  t,
  language,
  fmt,
  editing,
  setEditing,
  notify,
  organizationId,
  departmentOptions,
  professionOptions,
  positionOptions = [],
  reloadEmployees,
  onCodeChanged,
}: {
  employee: AnyRecord
  t: (key: string) => string
  language: string
  fmt: (value: unknown) => string
  editing: boolean
  setEditing: (editing: boolean) => void
  notify: (message: string, tone?: 'success' | 'info' | 'warning' | 'danger' | 'error') => void
  organizationId: string | null | undefined
  departmentOptions: Option[]
  professionOptions: Option[]
  positionOptions?: Option[]
  reloadEmployees?: () => unknown
  onCodeChanged?: (code: string) => void
}) {
  const [hrOptions, setHrOptions] = useState<{ hrDepartments: string[], directorates: string[] }>({ hrDepartments: [], directorates: [] })
  useEffect(() => {
    let active = true
    loadEmployeeHrOptionsAsync(organizationId)
      .then(options => active && setHrOptions(options))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [organizationId])
  const [saving, setSaving] = useState(false),
    [record, setRecord] = useState<AnyRecord>({ ...employee })
  useEffect(() => setRecord({ ...employee }), [employee])
  const set = (key: string, value: unknown) => setRecord(current => ({ ...current, [key]: value }))
  const cancel = () => {
    setRecord({ ...employee })
    setEditing(false)
  }
  async function save() {
    if (saving) return
    const nextCode = String(record.id || '').trim()
    if (!nextCode) {
      notify(
        language === 'en'
          ? 'Employee / folder code is required.'
          : 'Ο κωδικός εργαζομένου / φακέλου είναι υποχρεωτικός.',
        'danger',
      )
      return
    }
    setSaving(true)
    try {
      const updated = await updateEmployeeAsync(
        organizationId,
        employee.dbId,
        { ...record, id: nextCode },
        employee.id,
      )
      await reloadEmployees?.()
      setEditing(false)
      notify(t('employeesRecords.employeeUpdated'), 'success')
      if (updated.id !== employee.id) onCodeChanged?.(updated.id)
    } catch (error) {
      if ((error as Error | null)?.message === 'DUPLICATE_EMPLOYEE_CODE')
        notify(
          language === 'en'
            ? 'This employee / folder code is already in use.'
            : 'Ο κωδικός εργαζομένου / φακέλου χρησιμοποιείται ήδη.',
          'danger',
        )
      else
        notify(
          (error as Error | null)?.message ||
            (language === 'en'
              ? 'Could not update the employee.'
              : 'Δεν ήταν δυνατή η ενημέρωση του εργαζομένου.'),
          'error',
        )
    } finally {
      setSaving(false)
    }
  }
  return (
    <section className="record-section committee-overview employee-details-overview">
      <div className="record-section-header">
        <div>
          <h3>{t('employeesRecords.basicDetails')}</h3>
        </div>
      </div>
      <div
        className={`committee-detail-grid employee-full-grid ${editing ? 'employee-inline-edit' : ''}`}
      >
        <InlineDetail
          editing={editing}
          label={t('lastName')}
          value={record.lastName}
          onChange={value => set('lastName', value)}
        />
        <InlineDetail
          editing={editing}
          label={t('firstName')}
          value={record.firstName}
          onChange={value => set('firstName', value)}
        />
        <InlineDetail
          editing={editing}
          label={t('fatherName')}
          value={language === 'el' ? record.fatherName : record.fatherNameEn}
          onChange={value => set(language === 'el' ? 'fatherName' : 'fatherNameEn', value)}
        />
        <InlineDetail
          editing={editing}
          label={language === 'en' ? 'Employee / folder code' : 'Κωδικός εργαζομένου / φακέλου'}
          value={record.id}
          onChange={value => set('id', value)}
        />
        <div className={`detail-item detail-field ${editing ? 'editable' : ''}`}>
          <span>{t('employeesRecords.staffCategory')}</span>
          {editing ? (
            <SearchableSelect
              hideLabel
              label={t('employeesRecords.staffCategory')}
              value={staffCategoryOf(record)}
              onChange={next => set('staffCategory', next || 'employee')}
              options={STAFF_CATEGORIES.map(item => ({ value: item.value, label: staffCategoryLabel(item.value, language) }))}
            />
          ) : (
            <strong>{staffCategoryLabel(staffCategoryOf(record), language)}</strong>
          )}
        </div>
        <div className={`detail-item detail-field ${editing ? 'editable' : ''}`}>
          <span>{language === 'en' ? 'Status' : 'Κατάσταση'}</span>
          {editing ? (
            <SearchableSelect
              hideLabel
              label={language === 'en' ? 'Status' : 'Κατάσταση'}
              value={record.employmentStatus || 'active'}
              onChange={next => set('employmentStatus', next || 'active')}
              options={['active', 'leave', 'inactive'].map(value => ({ value, label: t(value) }))}
            />
          ) : (
            <strong>{t(employee.employmentStatus)}</strong>
          )}
        </div>
        <InlineDateDetail
          editing={editing}
          label={t('employeesRecords.hireDate')}
          value={record.hireDate}
          display={fmt(record.hireDate)}
          onChange={value => set('hireDate', value)}
        />
        <InlineSelect
          editing={editing}
          label={t('department')}
          value={record.department}
          display={language === 'el' ? record.department : record.departmentEn}
          options={departmentOptions}
          language={language}
          onChange={value => set('department', value)}
        />
        {(hrOptions.hrDepartments.length > 0 || record.hrDepartment) && (
          <InlineSelect
            editing={editing}
            label={language === 'en' ? 'HR department' : 'Τμήμα HR'}
            value={record.hrDepartment}
            display={record.hrDepartment}
            options={hrOptions.hrDepartments.map(name => [name, name])}
            language={language}
            onChange={value => set('hrDepartment', value)}
          />
        )}
        <InlineSelect
          editing={editing}
          label={t('professionalCategory')}
          value={record.profession}
          display={language === 'el' ? record.profession : record.professionEn}
          options={professionOptions}
          language={language}
          allowCustom
          onChange={value =>
            setRecord(current => ({
              ...current,
              profession: value,
              professionEn: professionOptions.find((row: AnyRecord) => (row?.[0] ?? row?.name) === value)?.[1] || value,
            }))
          }
        />
        {(editing || record.position) && (
          <InlineSelect
            editing={editing}
            label={language === 'en' ? 'Job position' : 'Θέση εργασίας'}
            value={record.position}
            display={(language === 'el' ? record.position : record.positionEn) || '—'}
            options={positionOptions}
            language={language}
            allowCustom
            onChange={value =>
              setRecord(current => ({
                ...current,
                position: value,
                positionEn: positionOptions.find(row => row?.[0] === value)?.[1] || value,
              }))
            }
          />
        )}
        <InlineDetail
          editing={editing}
          label={t('employeesRecords.email')}
          value={record.email}
          onChange={value => set('email', value)}
        />
        <InlineDetail
          editing={editing}
          label={t('phone')}
          value={record.phone}
          onChange={value => set('phone', value)}
        />
        {(hrOptions.directorates.length > 0 || record.directorate) && (
          <InlineSelect
            editing={editing}
            label={language === 'en' ? 'Directorate' : 'Διεύθυνση'}
            value={record.directorate}
            display={record.directorate}
            options={hrOptions.directorates.map(name => [name, name])}
            language={language}
            onChange={value => set('directorate', value)}
          />
        )}
      </div>
      {editing && (
        <div className="inline-edit-footer">
          <Button variant="secondary" disabled={saving} onClick={cancel}>
            {t('cancel')}
          </Button>
          <SaveButton loading={saving} disabled={saving} onClick={save}>
            {t('save')}
          </SaveButton>
        </div>
      )}
    </section>
  )
}

// A library row ([el, en, …]) or a department ({ name, nameEn }).
type Option = AnyRecord
interface InlineProps { editing: boolean, label: string, value: string | null | undefined, display?: ReactNode, onChange: (value: string) => void }
function InlineDetail({ editing, label, value, display, onChange, type = 'text' }: InlineProps & { type?: string }) {
  if (editing && type === 'date')
    return (
      <ManualDateField
        className="detail-item detail-field editable"
        label={label}
        value={value || ''}
        onChange={onChange}
      />
    )
  return (
    <div className={`detail-item detail-field ${editing ? 'editable' : ''}`}>
      <span>{label}</span>
      {editing ? (
        <input type={type} value={value || ''} onChange={event => onChange?.(event.target.value)} />
      ) : (
        <strong>{display ?? value ?? '—'}</strong>
      )}
    </div>
  )
}
// The hospital's list plus the values its employees already have (owner, 8/11/2026): a hospital whose list of job
// positions is empty still offers the positions in use, and a new one can be typed.
export function withEmployeeValues(options: Option[] = [], rows: AnyRecord[] = [], key: string, keyEn: string): Option[] {
  const list: AnyRecord[] = Array.isArray(options) ? [...options] as AnyRecord[] : []
  const known = new Set(list.map(row => row?.[0] ?? row?.name))
  for (const row of rows || []) {
    const value = String(row?.[key] || '').trim()
    if (value && !known.has(value)) {
      known.add(value)
      list.push([value, row?.[keyEn] || value])
    }
  }
  return list.sort((a, b) => String(a[0] ?? a.name).localeCompare(String(b[0] ?? b.name), 'el'))
}

// allowCustom: a value that is not in the list (yet) is typed in, e.g. a job position the hospital's list does not have.
function InlineSelect({ editing, label, value, display, options = [], language, onChange, allowCustom = false }: InlineProps & { options?: Option[], language: string, allowCustom?: boolean }) {
  const rows: AnyRecord[] = Array.isArray(options) ? options as AnyRecord[] : [],
    hasCurrent = rows.some(row => (row?.[0] ?? row?.name ?? '') === value)
  return (
    <div className={`detail-item detail-field ${editing ? 'editable' : ''}`}>
      <span>{label}</span>
      {editing ? (
        <SearchableSelect
          hideLabel
          label={label}
          value={value || ''}
          onChange={next => onChange(next || '')}
          allowCustom={allowCustom}
          placeholder={allowCustom ? (language === 'en' ? 'Type or choose…' : 'Γράψτε ή επιλέξτε…') : ''}
          options={[
            ...(value && !hasCurrent ? [{ value, label: (typeof display === 'string' && display) || value }] : []),
            ...rows.map(row => {
              const el = row?.[0] ?? row?.name ?? String(row || ''),
                en = row?.[1] ?? row?.nameEn ?? el
              return { value: el, label: language === 'el' ? el : en }
            }),
          ]}
        />
      ) : (
        <strong>{display || '—'}</strong>
      )}
    </div>
  )
}
function InlineDateDetail(props: InlineProps) {
  return <InlineDetail {...props} type="date" />
}
