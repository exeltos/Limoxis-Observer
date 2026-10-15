import { DueDate } from '../../design-system/DueDate'
import { useState } from 'react'
import { stayDays } from './patientRecordScope'
import { AlertTriangle, ArrowRightLeft, LogOut, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { GovernedReasonDialog } from '../../design-system/GovernedReasonDialog'
import { SectionHeader } from '../../design-system/SectionHeader'
import { ManualDateField } from '../../design-system/ManualDateField'
import { translate } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import {
  createAdmission,
  deleteAdmission,
  dischargeAdmission,
  transferAdmission,
  updatePatient,
} from '../patients/patientsService'
import { PatientSummaryActions } from '../patients/PatientSummaryActions'
import { PatientFormFields, usePatientForm } from '../patients/PatientsPage'
import { SaveButton } from '../../design-system/SaveButton'
import { SimpleDialog } from './ClinicalRecordDialogs'
import { clinicalTerm } from './clinicalRecordLabels'
import { isAwaitingResult, summaryAttention } from './recordAttention'
import { clinicalRiskFlags, scaleShortName } from '../clinical-scales/ClinicalRiskFlags'

// Admissions of the clinical record: patient admissions home, admission summary
// and lifecycle actions (admit, transfer, discharge).

// The patient's own details at the top of the record summary: read-only sheet,
// or the form in place while «Edit patient» is open.
export function PatientDetailsSection({
  patient,
  tenantId,
  isDemo,
  departments,
  t,
  language,
  fmtDate,
  onChanged,
  onDeleted,
  stayFields = null,
  leadingActions = null,
  extraMenuItems = [],
}) {
  const { notify } = useFeedback()
  // «Edit patient» turns the patient details into the form, in place.
  const [editing, setEditing] = useState(false)
  const [savingPatient, setSavingPatient] = useState(false)
  const actions = editing ? null : (
    <>
      {leadingActions}
      <PatientSummaryActions
        patient={patient}
        onEdit={() => setEditing(true)}
        onDeleted={onDeleted}
        extraItems={extraMenuItems}
      />
    </>
  )
  // Ages under a year read as "N days" (matching NHSN's ≤1-year pediatric
  // population) rather than the years figure that would round every
  // neonate down to "0" and hide clinically relevant age.
  const ageInDays = patient?.dateOfBirth
    ? Math.max(
        0,
        Math.floor((Date.now() - new Date(`${patient.dateOfBirth}T12:00:00`).getTime()) / 86400000),
      )
    : null
  const ageLabel =
    ageInDays == null
      ? '—'
      : ageInDays < 366
        ? `${ageInDays} ${translate('copy.clinicalRecordCopy.days', language === 'el' ? 'el' : 'en')}`
        : `${Math.floor(ageInDays / 365.25)} ${translate('copy.clinicalRecordCopy.years', language === 'el' ? 'el' : 'en')}`
  // Infants without a birth weight drop out of the NHSN birth-weight-band
  // CLABSI indicators, so say so where the value can be corrected.
  const infantWithoutBirthWeight =
    ageInDays != null && ageInDays <= 365 && !patient?.birthWeightGrams
  const profile = [
    [
      translate('copy.clinicalRecordCopy.patientCode', language === 'el' ? 'el' : 'en'),
      patient?.id,
    ],
    [
      translate('copy.clinicalRecordCopy.hospitalRecordNumber', language === 'el' ? 'el' : 'en'),
      patient?.hospitalRecordNumber,
    ],
    // Separate surname / first name (as in the patient form) instead of one
    // "full name" field whose order differed from the header.
    [
      translate('copy.clinicalRecordCopy.lastName', language === 'el' ? 'el' : 'en'),
      (language === 'en' && patient?.lastNameEn) ||
        patient?.lastName ||
        (!patient?.firstName && patient?.name) ||
        '—',
    ],
    [
      translate('copy.clinicalRecordCopy.firstName', language === 'el' ? 'el' : 'en'),
      (language === 'en' && patient?.firstNameEn) || patient?.firstName || '—',
    ],
    [
      translate('copy.clinicalRecordCopy.fatherName', language === 'el' ? 'el' : 'en'),
      (language === 'en' && patient?.patronymicEn) || patient?.fatherName || patient?.patronymic,
    ],
    [
      translate('copy.clinicalRecordCopy.dateOfBirthAge', language === 'el' ? 'el' : 'en'),
      patient?.dateOfBirth ? `${fmtDate(patient.dateOfBirth)} · ${ageLabel}` : '—',
    ],
    patient?.birthWeightGrams
      ? [
          translate('copy.clinicalRecordCopy.birthWeight', language === 'el' ? 'el' : 'en'),
          `${patient.birthWeightGrams} g`,
        ]
      : infantWithoutBirthWeight
        ? [translate('copy.clinicalRecordCopy.birthWeight', language === 'el' ? 'el' : 'en'), '—']
        : null,
    patient?.gestationalAgeWeeks
      ? [
          translate('copy.clinicalRecordCopy.gestationalAge', language === 'el' ? 'el' : 'en'),
          `${patient.gestationalAgeWeeks} ${translate('copy.clinicalRecordCopy.wk', language === 'el' ? 'el' : 'en')}`,
        ]
      : null,
    [
      translate('copy.clinicalRecordCopy.sex', language === 'el' ? 'el' : 'en'),
      patient?.sex ? t(patient.sex) : '—',
    ],
    // With the admission shown here too, its department replaces «current department».
    stayFields
      ? null
      : [
          translate('copy.clinicalRecordCopy.currentDepartment', language === 'el' ? 'el' : 'en'),
          patient?.department || '—',
        ],
    ...(stayFields || []),
  ].filter(Boolean)
  return (
    <section className="clinical-panel patient-summary-card">
      {!editing && (
        <SectionHeader
          title={
            stayFields
              ? t('clinicalRecords.patientAndAdmission')
              : translate('copy.clinicalRecordCopy.patientDetails', language === 'el' ? 'el' : 'en')
          }
          subtitle={
            stayFields
              ? null
              : translate(
                  'copy.clinicalRecordCopy.coreIdentityAndCurrentAdmissionInformation',
                  language === 'el' ? 'el' : 'en',
                )
          }
          actions={actions}
        />
      )}
      {editing ? (
        <PatientDetailsEditor
          title={
            stayFields
              ? t('clinicalRecords.patientAndAdmission')
              : translate('copy.clinicalRecordCopy.patientDetails', language === 'el' ? 'el' : 'en')
          }
          patient={patient}
          departments={departments}
          t={t}
          language={language}
          saving={savingPatient}
          onCancel={() => setEditing(false)}
          onSave={async draft => {
            setSavingPatient(true)
            try {
              await updatePatient(tenantId, patient, draft, { isDemo })
              setEditing(false)
              await onChanged?.()
              notify(t('saved'), 'success')
            } catch (error) {
              notify(error?.message || t('actionFailed'), 'danger')
            } finally {
              setSavingPatient(false)
            }
          }}
        />
      ) : (
        <div className="detail-grid patient-detail-grid patient-detail-grid-wide">
          {profile.map(([label, value]) => (
            <Detail key={label} label={label} value={value} />
          ))}
        </div>
      )}
      {infantWithoutBirthWeight && (
        <p className="field-hint neonatal-missing-weight" role="status">
          {translate('copy.neonatalCopy.missingBirthWeight', language === 'el' ? 'el' : 'en')}
        </p>
      )}
      {patient?.notes && (
        <div className="patient-profile-note">
          <span>{translate('copy.clinicalRecordCopy.notes', language === 'el' ? 'el' : 'en')}</span>
          <p>{patient.notes}</p>
        </div>
      )}
    </section>
  )
}
// Admission summary: one info sheet for the stay (no duplicate status — the
// header already shows it) and one for the current surveillance episode,
// in the same info-sheet style as the rest of the record instead of six
// differently tinted tiles. Emphasis uses status badges only.
// Both ids must be present to match: two missing record ids (every demo
// patient) used to compare equal, so the first patient in the roster was shown
// on every surveillance record.
// The record's summary: what needs attention first, then the admission and the
// current surveillance with its clinical assessment, findings, therapy and review.
export function CanonicalSummary({
  onOpenStage,
  samples,
  scaleRows = [],
  patient,
  admission,
  record,
  tenantId,
  isDemo,
  departments,
  canEdit,
  canDelete,
  showPatientActions,
  onDeleted,
  onChanged,
  onAdmissionDeleted,
  onAdmitted,
  t,
  language,
  fmtDate,
}) {
  const [admissionDeleteOpen, setAdmissionDeleteOpen] = useState(false)
  const en = language === 'en'
  const samplePool = samples || record?.samples || []
  const latest = samplePool.find(x => x.organism) || samplePool[0]
  const admittedAt = admission
    ? admission.admissionDate
    : patient?.admissionDate || record?.admissionDate
  const dischargedAt = admission?.dischargeDate || null
  const days = stayDays(admittedAt, dischargedAt)
  const daysLabel =
    days == null
      ? '—'
      : `${days} ${t(days === 1 ? 'clinicalRecords.stayDayOne' : 'clinicalRecords.stayDayMany')}${dischargedAt ? ` · ${t('clinicalRecords.dischargedOn')} ${fmtDate(dischargedAt)}` : ''}`
  const details = admission
    ? [
        [t('admissionDate'), fmtDate(admission.admissionDate)],
        [t('department'), admission.department || '—'],
        [t('clinicalRecords.lengthOfStay'), daysLabel],
      ]
    : [
        [
          t('patient'),
          en
            ? patient?.nameEn || record?.patientEn || patient?.name || record?.patient
            : patient?.name || record?.patient,
        ],
        [
          t('department'),
          en
            ? record?.departmentEn ||
              patient?.departmentEn ||
              record?.department ||
              patient?.department
            : record?.department || patient?.department,
        ],
        [t('admissionDate'), fmtDate(admittedAt)],
      ]
  const badge = (text, tone) =>
    text ? <span className={`status-badge ${tone || ''}`}>{text}</span> : '—'
  const hai = record?.haiClassification
  const haiValue = hai ? (
    <>
      {hai.type ? t(hai.type) : null}
      {hai.type ? ' ' : null}
      {badge(t(hai.status), hai.status === 'confirmed' ? 'danger' : 'temporary')}
    </>
  ) : (
    '—'
  )
  const findingValue = latest ? (
    <>
      {latest.organism || t(latest.result || 'pending')}
      {latest.resistance || record?.resistance ? (
        <> {badge(latest.resistance || record?.resistance, 'danger')}</>
      ) : null}
    </>
  ) : (
    '—'
  )
  const isolationValue = record?.isolation
    ? record.isolation.status === 'active'
      ? badge(t('clinicalRecords.isolationInPlace'), 'temporary')
      : badge(t(record.isolation.status))
    : t('no')
  const lifecycle = useAdmissionLifecycle({
    patient,
    admission,
    tenantId,
    isDemo,
    departments,
    canEdit,
    onChanged,
    onAdmitted,
    t,
    language,
  })
  const actions = admission ? (
    <>
      {lifecycle.items.map(item => {
        const Icon = item.icon
        return (
          <Button key={item.id} variant="secondary" onClick={item.onClick}>
            <Icon size={15} />
            {item.label}
          </Button>
        )
      })}
    </>
  ) : showPatientActions ? (
    <PatientSummaryActions patient={patient} onDeleted={onDeleted} />
  ) : null
  // The samples shown under the surveillance, laboratory registry rows included.
  const recordSamples = samples || record?.samples || []
  const awaitingCount = recordSamples.filter(isAwaitingResult).length
  const attention = summaryAttention(record, { t, samples: recordSamples })
  const assessment = record?.assessment
  const reassessments = record?.reassessments || []
  const lastReview = reassessments[reassessments.length - 1]
  const assessmentValue = assessment ? (
    <>
      {clinicalTerm(assessment.classification, language, t)}
      {assessment.summary ? (
        <small className="summary-detail-note" title={assessment.summary}>
          {assessment.summary}
        </small>
      ) : null}
    </>
  ) : (
    t('clinicalRecords.notDocumentedYet')
  )
  const pendingTherapy = (record?.therapy || []).filter(x => x.approvalStatus === 'pending')
  const therapyValue = record?.therapy?.length ? (
    <>
      {record.therapy.map(x => x.antimicrobial).join(', ')}
      {pendingTherapy.length ? (
        <>
          {' '}
          {badge(
            record.therapy.length > 1
              ? `${pendingTherapy.map(x => x.antimicrobial).join(', ')}: ${t('clinicalRecords.awaitingApproval')}`
              : t('clinicalRecords.awaitingApproval'),
            'warning',
          )}
        </>
      ) : null}
    </>
  ) : (
    t('clinicalRecords.none')
  )
  return (
    <div className="patient-summary-layout clean-patient-summary">
      {attention.length > 0 && (
        // One compact «Needs attention» strip, the same as inside an episode.
        <div
          className="journey-guidance compact-guidance summary-attention"
          role={attention.some(item => item.tone === 'danger') ? 'alert' : 'status'}
        >
          <div className="journey-guidance-title">
            <AlertTriangle size={15} aria-hidden="true" />
            <strong>{t('clinicalRecords.attentionNeeded')}</strong>
            <span>{attention.length}</span>
          </div>
          <div className="journey-guidance-items">
            {attention.map(item =>
              onOpenStage ? (
                <button
                  type="button"
                  key={item.id}
                  className={`guidance-cue ${item.tone === 'warning' ? 'warning' : 'due'}`}
                  title={item.action}
                  onClick={() => onOpenStage(item.stage)}
                >
                  <strong>{item.text}</strong>
                </button>
              ) : (
                <span
                  key={item.id}
                  className={`guidance-cue ${item.tone === 'warning' ? 'warning' : 'due'}`}
                >
                  <strong>{item.text}</strong>
                </span>
              ),
            )}
          </div>
        </div>
      )}
      {admission && showPatientActions && (
        // The patient record opens on its admission: one sheet with the patient's
        // details (editable in place) and the stay, transfer/discharge beside it.
        <PatientDetailsSection
          patient={patient}
          tenantId={tenantId}
          isDemo={isDemo}
          departments={departments}
          t={t}
          language={language}
          fmtDate={fmtDate}
          onChanged={onChanged}
          onDeleted={onDeleted}
          stayFields={details}
          extraMenuItems={[
            ...lifecycle.items,
            ...(canDelete
              ? [
                  {
                    id: 'delete-admission',
                    label: t('clinicalRecords.deleteAdmission'),
                    icon: Trash2,
                    tone: 'danger',
                    separatorBefore: true,
                    onClick: () => setAdmissionDeleteOpen(true),
                  },
                ]
              : []),
          ]}
        />
      )}
      {lifecycle.dialog}
      {admission && showPatientActions && (
        <AdmissionDeleteDialog
          open={admissionDeleteOpen}
          patient={patient}
          admission={admission}
          tenantId={tenantId}
          isDemo={isDemo}
          t={t}
          onClose={() => setAdmissionDeleteOpen(false)}
          onDeleted={onAdmissionDeleted}
        />
      )}
      {!(admission && showPatientActions) && (
        <section className="clinical-panel patient-summary-card">
          <SectionHeader
            title={
              admission
                ? t('clinicalRecords.admissionSummary')
                : t('clinicalRecords.patientDetails')
            }
            actions={actions}
          />
          <div className="detail-grid patient-detail-grid">
            {details.map(([label, value]) => (
              <Detail key={label} label={label} value={value} />
            ))}
          </div>
        </section>
      )}
      {!record && (
        <section className="clinical-panel patient-summary-card">
          <SectionHeader title={t('clinicalRecords.clinicalPicture')} />
          <div className="detail-grid patient-detail-grid">
            {clinicalRiskFlags(scaleRows).map(({ kind, row, config, tone }) => (
              <Detail
                key={kind}
                label={en ? config.labelEn : config.labelEl}
                value={
                  <>
                    {badge(`${scaleShortName(row.scale_key)} ${row.score ?? '—'}`, tone)}
                    {row.assessed_at ? <small> {fmtDate(row.assessed_at)}</small> : null}
                  </>
                }
              />
            ))}
            {!scaleRows.length && (
              <Detail
                label={t('clinicalRecords.clinicalAssessmentLabel')}
                value={t('clinicalRecords.none')}
              />
            )}
            <Detail
              label={t('clinicalRecords.samplesLabel')}
              value={
                recordSamples.length
                  ? `${recordSamples.length}${awaitingCount ? ` · ${awaitingCount} ${t('clinicalRecords.awaitingResultShort')}` : ''}`
                  : t('clinicalRecords.none')
              }
            />
            <Detail label={t('clinicalRecords.latestFinding')} value={findingValue} />
            <Detail label={t('surveillance')} value={t('clinicalRecords.noSurveillance')} />
          </div>
        </section>
      )}
      {record && (
        <section className="clinical-panel patient-summary-card">
          <SectionHeader title={t('clinicalRecords.currentSurveillance')} />
          <div className="detail-grid patient-detail-grid">
            <Detail
              label={t('surveillance')}
              value={badge(t(record.status), record.status === 'active' ? 'active' : '')}
            />
            <Detail label={t('clinicalRecords.haiClassification')} value={haiValue} />
            <Detail label={t('clinicalRecords.clinicalAssessmentLabel')} value={assessmentValue} />
            <Detail label={t('clinicalRecords.latestFinding')} value={findingValue} />
            <Detail
              label={t('clinicalRecords.samplesLabel')}
              value={
                recordSamples.length
                  ? `${recordSamples.length}${awaitingCount ? ` · ${awaitingCount} ${t('clinicalRecords.awaitingResultShort')}` : ''}`
                  : t('clinicalRecords.none')
              }
            />
            <Detail label={t('therapy')} value={therapyValue} />
            <Detail label={t('isolation')} value={isolationValue} />
            <Detail
              label={t('clinicalRecords.lastReassessment')}
              value={
                lastReview
                  ? clinicalTerm(lastReview.status, language, t)
                  : t('clinicalRecords.none')
              }
            />
            <Detail
              label={t('nextReview')}
              value={
                record.status === 'active' ? (
                  <DueDate value={record.reviewDue} format={fmtDate} />
                ) : (
                  fmtDate(record.reviewDue)
                )
              }
            />
          </div>
        </section>
      )}
    </div>
  )
}
// The patient form in place of the details; its cancel / save sit in the
// section header, where the «…» menu was, so they stay in view.
function PatientDetailsEditor({
  title,
  patient,
  departments,
  t,
  language,
  saving,
  onCancel,
  onSave,
}) {
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
            <SaveButton
              loading={saving}
              disabled={form.invalid || saving}
              onClick={() => onSave(form.payload())}
            >
              {t('save')}
            </SaveButton>
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
// Transfer and discharge: the menu items (or buttons) that open them, and the
// dialog they share.
function useAdmissionLifecycle({
  patient,
  admission,
  tenantId,
  isDemo,
  departments,
  canEdit,
  onChanged,
  onAdmitted,
  t,
  language,
}) {
  const { notify } = useFeedback()
  const [kind, setKind] = useState(null),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState({
      date: new Date().toISOString().slice(0, 10),
      departmentId: '',
      reason: '',
    })
  const open = next => {
    setDraft({ date: new Date().toISOString().slice(0, 10), departmentId: '', reason: '' })
    setKind(next)
  }
  async function save() {
    if (!draft.date) return
    try {
      setBusy(true)
      if (kind === 'admit') {
        const dept = departments.find(x => x.id === draft.departmentId)
        const row = await createAdmission(
          tenantId,
          patient,
          {
            departmentId: draft.departmentId,
            department: dept?.name || '',
            admissionDate: draft.date,
            status: 'active',
          },
          { isDemo },
        )
        setKind(null)
        await onAdmitted?.(row)
        notify(t('saved'), 'success')
        return
      }
      if (kind === 'discharge')
        await dischargeAdmission(tenantId, patient, admission, draft, { isDemo })
      else {
        const dept = departments.find(x => x.id === draft.departmentId)
        await transferAdmission(
          tenantId,
          patient,
          admission,
          { ...draft, department: dept?.name || '' },
          { isDemo },
        )
      }
      setKind(null)
      await onChanged?.()
      notify(t('saved'), 'success')
    } catch (error) {
      notify(error?.message || t('actionFailed'), 'danger')
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
      : // A discharged patient is readmitted from here: a new admission.
        canEdit && onAdmitted && admission
        ? [
            {
              id: 'new-admission',
              label: t('clinicalRecords.newAdmission'),
              icon: Plus,
              onClick: () => open('admit'),
            },
          ]
        : []
  const dialog = kind ? (
    <SimpleDialog
      title={
        kind === 'admit'
          ? t('clinicalRecords.newAdmission')
          : kind === 'transfer'
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
          kind === 'admit'
            ? t('admissionDate')
            : kind === 'transfer'
              ? translate('copy.clinicalRecordCopy.transferDate', language === 'el' ? 'el' : 'en')
              : translate('copy.clinicalRecordCopy.dischargeDate', language === 'el' ? 'el' : 'en')
        }
        value={draft.date}
        onChange={v => setDraft(d => ({ ...d, date: v }))}
      />
      {kind !== 'discharge' && (
        <label>
          <span>
            {kind === 'admit'
              ? t('department')
              : translate('copy.clinicalRecordCopy.newDepartment', language === 'el' ? 'el' : 'en')}
          </span>
          <select
            value={draft.departmentId}
            onChange={e => setDraft(d => ({ ...d, departmentId: e.target.value }))}
          >
            <option value="">{t('select')}</option>
            {departments
              .filter(x => kind === 'admit' || x.id !== admission.departmentId)
              .map(x => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
        </label>
      )}
      {kind !== 'admit' && (
        <label className="entry-span-2">
          <span>{t('reason')}</span>
          <textarea
            rows={3}
            value={draft.reason}
            onChange={e => setDraft(d => ({ ...d, reason: e.target.value }))}
          />
        </label>
      )}
    </SimpleDialog>
  ) : null
  return { items: lifecycleItems, dialog }
}
// Deleting an admission asks for a reason; the database keeps it in the audit
// log and refuses a patient's last admission or one with surveillance episodes.
function AdmissionDeleteDialog({
  open,
  patient,
  admission,
  tenantId,
  isDemo,
  t,
  onClose,
  onDeleted,
}) {
  const { notify } = useFeedback()
  async function remove(reason) {
    try {
      await deleteAdmission(tenantId, patient, admission, reason, { isDemo })
      onClose()
      notify(t('clinicalRecords.admissionDeleted'), 'success')
      await onDeleted?.(admission)
    } catch (error) {
      notify(
        error?.code === 'last_admission'
          ? t('clinicalRecords.lastAdmissionCannotBeDeleted')
          : error?.code === 'has_surveillance'
            ? t('clinicalRecords.admissionHasSurveillance')
            : error?.message || t('actionFailed'),
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
export function Detail({ label, value }) {
  return (
    <div className="detail-item">
      <span className="lo-field-label">{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  )
}
