import { SectionHeader } from '../../design-system/SectionHeader'
import { DetailFields } from '../../design-system/DetailList'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { Pencil, Trash2, UserRoundCheck, Users } from 'lucide-react'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { ManualDateField } from '../../design-system/ManualDateField'
import { MultiSelect } from '../../design-system/MultiSelect'
import { Field } from '../../design-system/Field'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { StatusBadge } from '../../design-system/StatusBadge'
import { formatDay } from '../../core/i18n/formatDay'
import { libraryOptions } from '../management/useLibraries'
import { selectTexts, usePreventionLibrary } from './PreventionFields'
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

// Used while the central vaccines library is empty.
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
].map(name => ({ id: name, el: name, en: name }))

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
  const vaccines = usePreventionLibrary('vaccines', VACCINES)
  const fmtDate = v => formatDay(v, language)
  const personName = e =>
    en ? `${e.firstNameEn || e.firstName} ${e.lastNameEn || e.lastName}` : `${e.lastName} ${e.firstName}`
  const employeeOptions = employees.map(e => ({
    value: e.id,
    label: [personName(e), en ? e.departmentEn : e.department, en ? e.professionEn : e.profession]
      .filter(Boolean)
      .join(' · '),
  }))
  const valid =
    (mode === 'edit' || selectedEmployeeIds.length > 0) && draft.vaccine.trim() && draft.date
  const patchDraft = patch => onChange({ ...value, draft: { ...draft, ...patch } })
  const setMode = next => onChange({ ...value, mode: next, selectedEmployeeIds: [] })
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
                  <StatusBadge tone={draft.status === 'complete' ? 'success' : 'neutral'}>
                    {draft.status === 'complete'
                      ? en
                        ? 'Complete'
                        : 'Ολοκληρωμένο'
                      : draft.status || '—'}
                  </StatusBadge>
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
            <DetailFields
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
            <SearchableSelect
              className="vaccination-vaccine-field"
              label={`${en ? 'Vaccine' : 'Εμβόλιο'} *`}
              value={draft.vaccine}
              options={libraryOptions(vaccines.map(item => ({ ...item, value: item.el })), language)}
              onChange={vaccine => patchDraft({ vaccine })}
              allowCustom
              placeholder={en ? 'Select or type vaccine' : 'Επιλέξτε ή γράψτε εμβόλιο'}
              {...selectTexts(en, { clear: true })}
            />
            <Field label={en ? 'Dose' : 'Δόση'}>
              <input
                value={draft.dose}
                onChange={e => patchDraft({ dose: e.target.value })}
                placeholder={en ? 'e.g. 1, 2, booster' : 'π.χ. 1, 2, αναμνηστική'}
              />
            </Field>
            <ManualDateField
              label={en ? 'Vaccination date *' : 'Ημερομηνία εμβολιασμού *'}
              value={draft.date}
              onChange={date => patchDraft({ date })}
            />
            <Field label={en ? 'Lot number' : 'Παρτίδα'}>
              <input
                value={draft.lotNumber}
                onChange={e => patchDraft({ lotNumber: e.target.value })}
              />
            </Field>
            <ManualDateField
              label={en ? 'Valid until' : 'Ισχύει έως'}
              value={draft.validUntil}
              onChange={validUntil => patchDraft({ validUntil })}
              optional
            />
            <label className="field vaccination-notes">
              <span className="lo-field-label">{en ? 'Notes' : 'Σημειώσεις'}</span>
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
            </div>
            {mode === 'individual' ? (
              <SearchableSelect
                label={en ? 'Select employee' : 'Επιλέξτε εργαζόμενο'}
                value={selectedEmployeeIds[0] || ''}
                options={employeeOptions}
                onChange={id => onChange({ ...value, selectedEmployeeIds: id ? [id] : [] })}
                placeholder={en ? 'Search name or department…' : 'Αναζήτηση ονόματος ή τμήματος…'}
                {...selectTexts(en, { clear: true })}
              />
            ) : (
              <MultiSelect
                label={en ? 'Employees' : 'Εργαζόμενοι'}
                options={employeeOptions}
                selected={selectedEmployeeIds}
                onChange={next => onChange({ ...value, selectedEmployeeIds: next })}
                placeholder={en ? 'Select employees' : 'Επιλέξτε εργαζόμενους'}
                searchPlaceholder={en ? 'Search name or department…' : 'Αναζήτηση ονόματος ή τμήματος…'}
                emptyLabel={en ? 'No employee matches' : 'Κανένας εργαζόμενος δεν ταιριάζει'}
                selectAllLabel={en ? 'Select all' : 'Επιλογή όλων'}
                clearAllLabel={en ? 'Clear all' : 'Αποεπιλογή όλων'}
                countLabel={n => (en ? `${n} employees` : `${n} εργαζόμενοι`)}
              />
            )}
          </section>
        )}
      </div>
    </ObserverDialog>
  )
}
