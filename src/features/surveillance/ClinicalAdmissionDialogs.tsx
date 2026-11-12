// Admission dialogs of the clinical record: the patient form in place, transfer / discharge, delete, new admission and the admission picker.
import { Fragment, useState } from 'react'
import { stayDays } from './patientRecordScope'
import {
  ArrowRightLeft,
  CalendarDays,
  Check,
  LogOut,
  Plus,
} from 'lucide-react'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { Button } from '../../design-system/Button'
import { GovernedReasonDialog } from '../../design-system/GovernedReasonDialog'
import { SectionHeader } from '../../design-system/SectionHeader'
import { ManualDateField } from '../../design-system/ManualDateField'
import { translate, useLanguage } from '../../core/i18n/LanguageContext'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import {
  createAdmission,
  deleteAdmission,
  dischargeAdmission,
  transferAdmission,
} from '../patients/patientsService'
import { PatientFormFields, usePatientForm } from '../patients/PatientsPage'
import { FormSubmit } from '../../design-system/FormValidation'
import { SimpleDialog } from './ClinicalRecordDialogs'
import { Field } from '../../design-system/Field'
import { AdmissionDischargeDialog } from './AdmissionDischargeDialog'
import { formatDay } from '../../core/i18n/formatDay'
import { departmentOptions, listTexts } from './surveillanceOptions'
import { hospitalToday } from '../../core/dates/hospitalDate'
import type { AnyRecord } from '../../types/featureTypes'
import type { Handler } from './surveillanceTypes'
import type { ReactNode } from 'react'

interface PatientDetailsEditorProps {
  title: string
  patient: AnyRecord
  departments: AnyRecord[]
  t: (key: string) => string
  language: string
  saving: boolean
  onCancel: Handler
  onSave: Handler
}
// The patient form in place of the details; its cancel / save sit in the
// section header, where the «…» menu was, so they stay in view.
export function PatientDetailsEditor({
  title,
  patient,
  departments,
  t,
  language,
  saving,
  onCancel,
  onSave,
}: PatientDetailsEditorProps) {
  const form = usePatientForm({ patient, departments })
  return (
    <>
      <SectionHeader
        title={title}
        actions={
          <>
            <Button variant="secondary" onClick={onCancel} disabled={saving}>
              {t('cancelChanges')}
            </Button>
            <FormSubmit
              form={form.validation}
              loading={saving}
              onSubmit={() => onSave(form.payload())}
            >
              {t('save')}
            </FormSubmit>
          </>
        }
      />
      <div className="patient-details-editor">
        <PatientFormFields
          form={form}
          t={t}
          language={language}
          departments={departments}
          className="patient-entry-grid-wide"
        />
      </div>
    </>
  )
}
interface UseAdmissionLifecycleOptions {
  patient: AnyRecord | null
  admission: AnyRecord | null
  tenantId: string | null | undefined
  isDemo: boolean
  departments: AnyRecord[]
  canEdit: boolean
  onChanged: Handler
  t: (key: string) => string
  language: string
}
// Transfer and discharge: the menu items (or buttons) that open them, and the
// dialog they share.
export function useAdmissionLifecycle({
  patient,
  admission,
  tenantId,
  isDemo,
  departments,
  canEdit,
  onChanged,
  t,
  language,
}: UseAdmissionLifecycleOptions) {
  const { notify } = useFeedback()
  const [kind, setKind] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState({
      date: hospitalToday(),
      departmentId: '',
      reason: '',
    })
  const open = (next: string) => {
    setDraft({ date: hospitalToday(), departmentId: '', reason: '' })
    setKind(next)
  }
  // The discharge is recorded only from the confirmation step of its dialog.
  async function confirmDischarge(result: AnyRecord) {
    if (!patient || !admission) return
    try {
      setBusy(true)
      await dischargeAdmission(tenantId, patient, admission, result, { isDemo })
      setKind(null)
      await onChanged?.()
      notify(t('saved'), 'success')
    } catch (error) {
      notify((error as Error)?.message || t('actionFailed'), 'danger')
    } finally {
      setBusy(false)
    }
  }
  async function save() {
    if (!draft.date) return
    try {
      setBusy(true)
      if (kind === 'discharge')
        await dischargeAdmission(tenantId, patient!, admission!, draft, { isDemo })
      else {
        const dept = departments.find(x => x.id === draft.departmentId)
        await transferAdmission(
          tenantId,
          patient!,
          admission!,
          { ...draft, department: dept?.name || '' },
          { isDemo },
        )
      }
      setKind(null)
      await onChanged?.()
      notify(t('saved'), 'success')
    } catch (error) {
      notify((error as Error)?.message || t('actionFailed'), 'danger')
    } finally {
      setBusy(false)
    }
  }
  const lifecycleItems =
    canEdit && admission?.status === 'active'
      ? [
          {
            id: 'transfer',
            label: translate(
              'copy.clinicalRecordCopy.transferToAnotherDepartment',
              language === 'el' ? 'el' : 'en',
            ),
            icon: ArrowRightLeft,
            onClick: () => open('transfer'),
          },
          {
            id: 'discharge',
            label: translate('copy.clinicalRecordCopy.discharge', language === 'el' ? 'el' : 'en'),
            icon: LogOut,
            onClick: () => open('discharge'),
          },
        ]
      : []
  const dialog = kind === 'discharge' ? (
    <AdmissionDischargeDialog
      patient={patient!}
      admission={admission!}
      t={t}
      language={language}
      fmtDate={value => formatDay(value, language)}
      busy={busy}
      onClose={() => setKind(null)}
      onConfirm={confirmDischarge}
    />
  ) : kind ? (
    <SimpleDialog
      title={
        kind === 'transfer'
          ? translate('copy.clinicalRecordCopy.transferPatient', language === 'el' ? 'el' : 'en')
          : translate('copy.clinicalRecordCopy.dischargePatient', language === 'el' ? 'el' : 'en')
      }
      t={t}
      onClose={() => setKind(null)}
      onSave={save}
      disabled={
        busy ||
        !draft.date ||
        (kind !== 'discharge' && departments.length > 0 && !draft.departmentId)
      }
    >
      <ManualDateField
        label={
          kind === 'transfer'
            ? translate('copy.clinicalRecordCopy.transferDate', language === 'el' ? 'el' : 'en')
            : translate('copy.clinicalRecordCopy.dischargeDate', language === 'el' ? 'el' : 'en')
        }
        value={draft.date}
        onChange={v => setDraft(d => ({ ...d, date: v }))}
      />
      {kind === 'transfer' && (
        <SearchableSelect
          label={translate('copy.clinicalRecordCopy.newDepartment', language === 'el' ? 'el' : 'en')}
          value={draft.departmentId}
          options={departmentOptions(
            departments.filter(x => x.id !== admission!.departmentId),
            language,
          )}
          placeholder={t('select')}
          emptyLabel={listTexts(language).emptyLabel}
          clearLabel={listTexts(language).clearLabel}
          onChange={v => setDraft(d => ({ ...d, departmentId: v }))}
        />
      )}
      <label className="field entry-span-2">
        <span className="lo-field-label">{t('reason')}</span>
        <textarea
          rows={3}
          value={draft.reason}
          onChange={e => setDraft(d => ({ ...d, reason: e.target.value }))}
        />
      </label>
    </SimpleDialog>
  ) : null
  return { items: lifecycleItems, dialog }
}
interface AdmissionDeleteDialogProps {
  open: boolean
  patient: AnyRecord | null
  admission: AnyRecord
  tenantId: string | null | undefined
  isDemo: boolean
  t: (key: string) => string
  onClose: Handler
  onDeleted: Handler
}
// Deleting an admission asks for a reason; the database keeps it in the audit
// log and refuses a patient's last admission or one with surveillance episodes.
export function AdmissionDeleteDialog({
  open,
  patient,
  admission,
  tenantId,
  isDemo,
  t,
  onClose,
  onDeleted,
}: AdmissionDeleteDialogProps) {
  const { notify } = useFeedback()
  async function remove(reason: string) {
    try {
      await deleteAdmission(tenantId, patient!, admission, reason, { isDemo })
      onClose()
      notify(t('clinicalRecords.admissionDeleted'), 'success')
      await onDeleted?.(admission)
    } catch (error) {
      notify(
        (error as AnyRecord)?.code === 'last_admission'
          ? t('clinicalRecords.lastAdmissionCannotBeDeleted')
          : (error as AnyRecord)?.code === 'has_surveillance'
            ? t('clinicalRecords.admissionHasSurveillance')
            : (error as Error)?.message || t('actionFailed'),
        'danger',
      )
    }
  }
  return (
    <GovernedReasonDialog
      open={open}
      title={t('clinicalRecords.deleteAdmission')}
      description={t('clinicalRecords.deleteAdmissionHelp')}
      confirmLabel={t('delete')}
      danger
      onCancel={onClose}
      onConfirm={remove}
    />
  )
}
interface DetailProps {
  label: ReactNode
  value: ReactNode
}
export function Detail({ label, value }: DetailProps) {
  return (
    <div className="detail-item">
      <span className="lo-field-label">{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  )
}

interface NewAdmissionDialogProps {
  patient: AnyRecord
  activeAdmission: AnyRecord | null
  tenantId: string | null | undefined
  isDemo: boolean
  departments: AnyRecord[]
  t: (key: string) => string
  onClose: Handler
  onAdmitted: Handler
}
// A new admission for the patient. While another admission is still active the
// patient is discharged from it first (one active admission at a time).
export function NewAdmissionDialog({
  patient,
  activeAdmission,
  tenantId,
  isDemo,
  departments,
  t,
  onClose,
  onAdmitted,
}: NewAdmissionDialogProps) {
  const { notify } = useFeedback()
  const { language } = useLanguage()
  const today = hospitalToday()
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState({
    admissionDate: today,
    departmentId: '',
    dischargeDate: today,
    caseNumber: '',
  })
  async function save() {
    try {
      setBusy(true)
      const discharged = activeAdmission
        ? await dischargeAdmission(
            tenantId,
            patient,
            activeAdmission,
            { date: draft.dischargeDate, reason: '' },
            { isDemo },
          )
        : null
      const dept = departments.find(x => x.id === draft.departmentId)
      const row = await createAdmission(
        tenantId,
        patient,
        {
          departmentId: draft.departmentId,
          department: dept?.name || '',
          admissionDate: draft.admissionDate,
          caseNumber: draft.caseNumber.trim(),
          status: 'active',
        },
        { isDemo },
      )
      await onAdmitted?.(row, discharged)
      notify(t('saved'), 'success')
    } catch (error) {
      notify((error as AnyRecord)?.duplicateRecordNumber ? t('recordNumberTaken') : (error as Error)?.message || t('actionFailed'), 'danger')
    } finally {
      setBusy(false)
    }
  }
  // Every admission has a record number of its own (a patient back after discharge gets a new one).
  const invalid =
    !draft.caseNumber.trim() ||
    !draft.admissionDate ||
    (departments.length > 0 && !draft.departmentId) ||
    (activeAdmission &&
      (!draft.dischargeDate ||
        draft.dischargeDate < String(activeAdmission.admissionDate || '').slice(0, 10) ||
        draft.dischargeDate > draft.admissionDate))
  return (
    <SimpleDialog
      title={t('clinicalRecords.newAdmission')}
      t={t}
      onClose={onClose}
      onSave={save}
      disabled={Boolean(busy || invalid)}
    >
      {activeAdmission && (
        <p className="field-hint entry-span-2">
          {t('clinicalRecords.newAdmissionDischargesCurrent').replace(
            '{department}',
            activeAdmission.department || '—',
          )}
        </p>
      )}
      {activeAdmission && (
        <ManualDateField
          label={t('clinicalRecords.currentAdmissionDischargeDate')}
          value={draft.dischargeDate}
          onChange={v => setDraft(d => ({ ...d, dischargeDate: v }))}
        />
      )}
      <Field label={t('hospitalRecordNumber')} required>
        <input value={draft.caseNumber} onChange={event => setDraft(d => ({ ...d, caseNumber: event.target.value }))} />
      </Field>
      <ManualDateField
        label={t('admissionDate')}
        value={draft.admissionDate}
        onChange={v => setDraft(d => ({ ...d, admissionDate: v }))}
      />
      <SearchableSelect
        label={t('department')}
        value={draft.departmentId}
        options={departmentOptions(departments, language)}
        placeholder={t('select')}
        emptyLabel={listTexts(language).emptyLabel}
        clearLabel={listTexts(language).clearLabel}
        onChange={v => setDraft(d => ({ ...d, departmentId: v }))}
      />
    </SimpleDialog>
  )
}

interface AdmissionPickerProps {
  admissions: AnyRecord[]
  selected: AnyRecord | null
  onSelect: Handler
  onNew?: Handler | null
  t: (key: string) => string
  fmtDate: (value: unknown) => string
}
// The patient's admissions, always in view under the name: pick the one the
// record shows, or start a new one.
export function AdmissionPicker({ admissions, selected, onSelect, onNew, t, fmtDate }: AdmissionPickerProps) {
  const items: AnyRecord[] = admissions.map(row => {
    const days = stayDays(row.admissionDate, row.dischargeDate)
    return {
      id: row.id,
      current: String(row.id) === String(selected?.id),
      icon: String(row.id) === String(selected?.id) ? Check : CalendarDays,
      label: `${fmtDate(row.admissionDate)} – ${row.dischargeDate ? fmtDate(row.dischargeDate) : t('clinicalRecords.admissionOngoing')}`,
      description: `${row.caseNumber ? `${t('recordNumberShort')} ${row.caseNumber} · ` : ''}${row.department || '—'} · ${days == null ? '—' : `${days} ${t(days === 1 ? 'clinicalRecords.stayDayOne' : 'clinicalRecords.stayDayMany')}`} · ${t(row.status)}`,
      onClick: () => onSelect(row.id),
    }
  })
  if (onNew)
    items.push({
      id: 'new-admission',
      label: t('clinicalRecords.newAdmission'),
      icon: Plus,
      separatorBefore: true,
      onClick: onNew,
    })
  return (
    <OverflowMenu
      className="admission-picker"
      align="start"
      width={320}
      label={t('clinicalRecords.admissionsOfPatient')}
      items={items}
      trigger={
        <>
          <CalendarDays size={13} aria-hidden="true" />
          <span>
            {selected
              ? `${t('clinicalRecords.admissionSelect')} ${fmtDate(selected.admissionDate)} · ${selected.department || '—'}`
              : t('clinicalRecords.admissionsOfPatient')}
          </span>
          {admissions.length > 1 && <em className="admission-picker-count">{admissions.length}</em>}
        </>
      }
    />
  )
}
