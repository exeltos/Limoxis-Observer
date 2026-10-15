import { SectionHeader } from '../../design-system/SectionHeader'
import { RecordDetailsGrid } from '../../design-system/RecordDetailsGrid'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { useState } from 'react'
import { Pencil, Trash2, UserRoundCheck, Users } from 'lucide-react'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { ManualDateField } from '../../design-system/ManualDateField'
import { Button } from '../../design-system/Button'
import '../occupational-health/OccupationalHealthPage.css'

export const EMPTY_VACCINATION = {
  vaccine: '',
  dose: '',
  date: '',
  lotNumber: '',
  validUntil: '',
  status: 'complete',
  clinicalNotes: '',
}

const VACCINES = [
  'Εποχική γρίπη',
  'Ηπατίτιδα Β',
  'COVID-19',
  'MMR',
  'Ανεμευλογιά',
  'Td/Tdap',
  'Ηπατίτιδα Α',
  'Μηνιγγιτιδόκοκκος',
  'Άλλο',
]

export function StaffVaccinationEditor({
  language,
  employees,
  value,
  canManage = true,
  onChange,
  onClose,
  onSave,
  onDelete,
}) {
  const en = language === 'en'
  const { mode, draft, selectedEmployeeIds } = value
  const readOnly = Boolean(value.readOnly)
  const selectedEmployee =
    value.selectedEmployee || employees.find(x => selectedEmployeeIds.includes(x.id))
  const employeeName = !selectedEmployee
    ? '—'
    : en
      ? `${selectedEmployee.firstNameEn || selectedEmployee.firstName} ${selectedEmployee.lastNameEn || selectedEmployee.lastName}`
      : `${selectedEmployee.lastName} ${selectedEmployee.firstName}`
  const fmtDate = v => {
    if (!v) return '—'
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/)
    return m ? `${m[3]}/${m[2]}/${m[1]}` : v
  }
  const [search, setSearch] = useState('')
  const [dept, setDept] = useState('all')
  const departments = [
    ...new Set(employees.map(x => (en ? x.departmentEn : x.department)).filter(Boolean)),
  ]
  const filtered = employees.filter(x => {
    const label =
      `${x.id} ${x.firstName} ${x.lastName} ${x.firstNameEn} ${x.lastNameEn}`.toLowerCase()
    const d = en ? x.departmentEn : x.department
    return label.includes(search.toLowerCase()) && (dept === 'all' || d === dept)
  })
  const valid =
    (mode === 'edit' || selectedEmployeeIds.length > 0) && draft.vaccine.trim() && draft.date
  const patchDraft = patch => onChange({ ...value, draft: { ...draft, ...patch } })
  const setMode = next => onChange({ ...value, mode: next, selectedEmployeeIds: [] })
  const toggle = id =>
    onChange({
      ...value,
      selectedEmployeeIds: selectedEmployeeIds.includes(id)
        ? selectedEmployeeIds.filter(x => x !== id)
        : [...selectedEmployeeIds, id],
    })
  const selectVisible = () =>
    onChange({
      ...value,
      selectedEmployeeIds: [...new Set([...selectedEmployeeIds, ...filtered.map(x => x.id)])],
    })
  const clearVisible = () =>
    onChange({
      ...value,
      selectedEmployeeIds: selectedEmployeeIds.filter(id => !filtered.some(x => x.id === id)),
    })
  const toggleFromKeyboard = (event, id) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggle(id)
    }
  }
  if (readOnly)
    return (
      <ObserverDialog
        width="workspace"
        className="vaccination-record-dialog"
        eyebrow={en ? 'Staff vaccination' : 'Εμβολιασμός προσωπικού'}
        title={en ? 'Vaccination record' : 'Εγγραφή εμβολιασμού'}
        subtitle={
          en
            ? 'Recorded staff vaccination details.'
            : 'Καταγεγραμμένα στοιχεία εμβολιασμού προσωπικού.'
        }
        onClose={onClose}
      >
        <div className="record-view-stack">
          <section>
            <SectionHeader
              title={employeeName}
              subtitle={[
                selectedEmployee?.id,
                en
                  ? selectedEmployee?.departmentEn || selectedEmployee?.department
                  : selectedEmployee?.department,
                en
                  ? selectedEmployee?.professionEn || selectedEmployee?.profession
                  : selectedEmployee?.profession,
              ]
                .filter(Boolean)
                .join(' · ')}
              actions={
                <>
                  <span className={`status-badge ${draft.status === 'complete' ? 'active' : ''}`}>
                    {draft.status === 'complete'
                      ? en
                        ? 'Complete'
                        : 'Ολοκληρωμένο'
                      : draft.status || '—'}
                  </span>
                  {canManage && (
                    <OverflowMenu
                      items={[
                        {
                          id: 'edit',
                          label: en ? 'Edit' : 'Επεξεργασία',
                          icon: Pencil,
                          onClick: () => onChange({ ...value, readOnly: false, mode: 'edit' }),
                        },
                        {
                          id: 'delete',
                          label: en ? 'Delete' : 'Διαγραφή',
                          icon: Trash2,
                          tone: 'danger',
                          separatorBefore: true,
                          onClick: () => onDelete?.(value),
                        },
                      ]}
                    />
                  )}
                </>
              }
            />
            <RecordDetailsGrid
              className="record-details-cols-5"
              fields={[
                { id: 'vaccine', label: en ? 'Vaccine' : 'Εμβόλιο', value: draft.vaccine },
                { id: 'dose', label: en ? 'Dose' : 'Δόση', value: draft.dose },
                {
                  id: 'date',
                  label: en ? 'Vaccination date' : 'Ημερομηνία εμβολιασμού',
                  value: fmtDate(draft.date),
                },
                { id: 'valid', label: en ? 'Valid until' : 'Ισχύει έως', value: fmtDate(draft.validUntil) },
                { id: 'lot', label: en ? 'Lot number' : 'Παρτίδα', value: draft.lotNumber },
                {
                  id: 'notes',
                  className: 'is-wide',
                  label: en ? 'Notes' : 'Σημειώσεις',
                  value: draft.clinicalNotes,
                  hidden: !draft.clinicalNotes,
                },
              ]}
            />
          </section>
        </div>
      </ObserverDialog>
    )
  return (
    <ObserverDialog
      width="workspace"
      fixedHeight={mode !== 'edit'}
      eyebrow={en ? 'Staff vaccination' : 'Εμβολιασμός προσωπικού'}
      title={
        mode === 'edit'
          ? en
            ? 'Edit vaccination'
            : 'Επεξεργασία εμβολιασμού'
          : en
            ? 'Vaccination entry'
            : 'Καταχώρηση εμβολιασμού'
      }
      subtitle={
        en
          ? 'Choose one employee or register the same vaccine for several selected employees.'
          : 'Επιλέξτε έναν εργαζόμενο ή καταχωρήστε το ίδιο εμβόλιο σε πολλούς επιλεγμένους εργαζομένους.'
      }
      onClose={onClose}
      footer={
        <DialogActions
          onSave={() => onSave(value)}
          disabled={!valid}
          saveLabel={
            en
              ? mode === 'bulk'
                ? `Save ${selectedEmployeeIds.length} vaccinations`
                : 'Save vaccination'
              : mode === 'bulk'
                ? `Αποθήκευση ${selectedEmployeeIds.length} εμβολιασμών`
                : 'Αποθήκευση εμβολιασμού'
          }
        />
      }
    >
      <div className="vaccination-editor">
        {mode !== 'edit' && (
          <ModeSwitch
            className="vaccination-entry-mode"
            ariaLabel={en ? 'Entry mode' : 'Τρόπος καταχώρησης'}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'individual', label: en ? 'Individual' : 'Μεμονωμένα', icon: UserRoundCheck },
              { value: 'bulk', label: en ? 'Bulk vaccination' : 'Μαζικός εμβολιασμός', icon: Users },
            ]}
          />
        )}
        <section className="vaccination-editor-card">
          <h4>{en ? 'Vaccine details' : 'Στοιχεία εμβολίου'}</h4>
          <div className="vaccination-fields">
            <label>
              <span>{en ? 'Vaccine' : 'Εμβόλιο'} *</span>
              <select value={draft.vaccine} onChange={e => patchDraft({ vaccine: e.target.value })}>
                <option value="">{en ? 'Select vaccine' : 'Επιλέξτε εμβόλιο'}</option>
                {VACCINES.map(v => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{en ? 'Dose' : 'Δόση'}</span>
              <input
                value={draft.dose}
                onChange={e => patchDraft({ dose: e.target.value })}
                placeholder={en ? 'e.g. 1, 2, booster' : 'π.χ. 1, 2, αναμνηστική'}
              />
            </label>
            <ManualDateField
              label={en ? 'Vaccination date *' : 'Ημερομηνία εμβολιασμού *'}
              value={draft.date}
              onChange={date => patchDraft({ date })}
            />
            <label>
              <span>{en ? 'Lot number' : 'Παρτίδα'}</span>
              <input
                value={draft.lotNumber}
                onChange={e => patchDraft({ lotNumber: e.target.value })}
              />
            </label>
            <ManualDateField
              label={en ? 'Valid until' : 'Ισχύει έως'}
              value={draft.validUntil}
              onChange={validUntil => patchDraft({ validUntil })}
              optional
            />
            <label className="vaccination-notes">
              <span>{en ? 'Notes' : 'Σημειώσεις'}</span>
              <input
                value={draft.clinicalNotes}
                onChange={e => patchDraft({ clinicalNotes: e.target.value })}
              />
            </label>
          </div>
        </section>
        {mode !== 'edit' && (
          <section className="vaccination-editor-card vaccination-employee-picker">
            <div className="vaccination-picker-heading">
              <div>
                <h4>
                  {mode === 'bulk'
                    ? en
                      ? 'Employees to vaccinate'
                      : 'Εργαζόμενοι προς εμβολιασμό'
                    : en
                      ? 'Employee'
                      : 'Εργαζόμενος'}
                </h4>
                <small>
                  {en
                    ? `${selectedEmployeeIds.length} selected`
                    : `${selectedEmployeeIds.length} επιλεγμένοι`}
                </small>
              </div>
              {mode === 'bulk' && (
                <div className="vaccination-picker-actions">
                  <Button variant="secondary" onClick={selectVisible}>
                    {en ? 'Select visible' : 'Επιλογή εμφανιζόμενων'}
                  </Button>
                  <Button variant="secondary" onClick={clearVisible}>
                    {en ? 'Clear visible' : 'Καθαρισμός εμφανιζόμενων'}
                  </Button>
                </div>
              )}
            </div>
            {mode === 'individual' ? (
              <label>
                <span>{en ? 'Select employee' : 'Επιλέξτε εργαζόμενο'}</span>
                <select
                  value={selectedEmployeeIds[0] || ''}
                  onChange={e =>
                    onChange({
                      ...value,
                      selectedEmployeeIds: e.target.value ? [e.target.value] : [],
                    })
                  }
                >
                  <option value="">{en ? 'Select employee' : 'Επιλέξτε εργαζόμενο'}</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {en
                        ? `${e.firstNameEn || e.firstName} ${e.lastNameEn || e.lastName}`
                        : `${e.lastName} ${e.firstName}`}{' '}
                      · {en ? e.departmentEn : e.department}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <div className="vaccination-picker-filters">
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={en ? 'Search employees…' : 'Αναζήτηση εργαζομένων…'}
                  />
                  <select value={dept} onChange={e => setDept(e.target.value)}>
                    <option value="all">{en ? 'All departments' : 'Όλα τα τμήματα'}</option>
                    {departments.map(d => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="vaccination-employee-list">
                  {filtered.map(e => {
                    const selected = selectedEmployeeIds.includes(e.id)
                    return (
                      <div
                        key={e.id}
                        className={`vaccination-employee-row${selected ? ' selected' : ''}`}
                        tabIndex={0}
                        onClick={() => toggle(e.id)}
                        onKeyDown={event => toggleFromKeyboard(event, e.id)}
                      >
                        <input
                          type="checkbox"
                          aria-label={
                            en
                              ? `Select ${e.firstNameEn || e.firstName} ${e.lastNameEn || e.lastName}`
                              : `Επιλογή ${e.lastName} ${e.firstName}`
                          }
                          checked={selected}
                          onClick={event => event.stopPropagation()}
                          onChange={() => toggle(e.id)}
                        />
                        <div className="vaccination-employee-copy">
                          <strong>
                            {en
                              ? `${e.firstNameEn || e.firstName} ${e.lastNameEn || e.lastName}`
                              : `${e.lastName} ${e.firstName}`}
                          </strong>
                          <small>
                            {e.id} · {en ? e.departmentEn : e.department} ·{' '}
                            {en ? e.professionEn : e.profession}
                          </small>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </ObserverDialog>
  )
}
