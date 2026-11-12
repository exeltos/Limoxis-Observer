import { DueDate } from '../../design-system/DueDate'
import { AttentionList } from '../../design-system/AttentionList'
import { Fragment, useState } from 'react'
import { stayDays } from './patientRecordScope'
import {
  Pencil,
  Trash2,
} from 'lucide-react'
import { Button } from '../../design-system/Button'
import { SectionHeader } from '../../design-system/SectionHeader'
import { translate } from '../../core/i18n/LanguageContext'
import { StatusBadge } from '../../design-system/StatusBadge'
import { DetailList } from '../../design-system/DetailList'
import { useTenant } from '../../core/tenant/TenantContext'
import { can, CAPABILITIES } from '../../core/permissions/roles'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { updatePatient } from '../patients/patientsService'
import { PatientSummaryActions } from '../patients/PatientSummaryActions'
import { ISOLATION_STATUS, clinicalTerm, clinicalValueLabel, timelineLabel } from './clinicalRecordLabels'
import { isAwaitingResult, summaryAttention } from './recordAttention'
import { clinicalRiskFlags, scaleShortName } from '../clinical-scales/ClinicalRiskFlags'
import { AdmissionDeleteDialog, PatientDetailsEditor, useAdmissionLifecycle } from './ClinicalAdmissionDialogs'
import type { AnyRecord } from '../../types/featureTypes'
import type { Handler } from './surveillanceTypes'
export { Detail, NewAdmissionDialog, AdmissionPicker } from './ClinicalAdmissionDialogs'

interface PatientDetailsSectionProps {
  patient: AnyRecord
  tenantId: string
  isDemo: boolean
  departments: AnyRecord[]
  t: (key: string) => string
  language: string
  fmtDate: (value: unknown) => string
  onChanged: Handler
  onDeleted: Handler
  stayFields?: AnyRecord[] | null
  leadingActions?: AnyRecord[] | null
  extraMenuItems?: AnyRecord[]
  bare?: boolean
  compact?: boolean
  extraItems?: AnyRecord[]
  title?: string | null
}
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
  // Without a card of its own: the page already frames it (a patient with no admission).
  bare = false,
  // The record summary's column: one short list (the name is in the header), with the
  // stay and the questionnaire's origin and risk factors (`extraItems`) in it.
  compact = false,
  extraItems = [],
  // The card's own heading when it is not «Patient & admission» (a patient with no admission).
  title = null,
}: PatientDetailsSectionProps) {
  const { notify } = useFeedback()
  // «Edit patient» turns the patient details into the form, in place.
  const [editing, setEditing] = useState(false)
  const [savingPatient, setSavingPatient] = useState(false)
  const { role, membership } = useTenant()
  const canEditPatient = can(role, CAPABILITIES.EDIT_PATIENT, membership?.capabilities ?? [], membership?.customCapabilities ?? [])
  // One rule: «Edit» is the visible button; the «…» menu keeps only the other actions
  // (never a second «Edit patient»), and the missing-fields line has no second link.
  // The record summary has a single «…» menu, with «Edit patient» first.
  const actions = editing ? null : (
    <>
      {leadingActions}
      {canEditPatient && !compact && (
        <Button variant="secondary" onClick={() => setEditing(true)}>
          <Pencil size={15} />
          {t('edit')}
        </Button>
      )}
      <PatientSummaryActions
        patient={patient}
        onEdit={compact ? () => setEditing(true) : undefined}
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
  const lang = language === 'el' ? 'el' : 'en'
  const cr = (key: string) => translate(`copy.clinicalRecordCopy.${key}`, lang)
  // Grouped as a details list: the patient, the stay, the clinical details.
  const compactSections = [
    {
      collapseMissing: true,
      items: [
        { label: cr('hospitalRecordNumber'), value: patient?.hospitalRecordNumber },
        {
          label: t('clinicalRecords.sexAge'),
          value: [patient?.sex ? t(patient.sex) : '', patient?.dateOfBirth ? `${ageLabel} (${fmtDate(patient.dateOfBirth)})` : ''].filter(Boolean).join(' · '),
        },
        ...(stayFields || []).map(([label, value]) => ({ label, value })),
        ...extraItems,
        patient?.birthWeightGrams || infantWithoutBirthWeight
          ? { label: cr('birthWeight'), value: patient?.birthWeightGrams ? `${patient.birthWeightGrams} g` : '' }
          : null,
        patient?.gestationalAgeWeeks
          ? { label: cr('gestationalAge'), value: `${patient.gestationalAgeWeeks} ${cr('wk')}` }
          : null,
      ],
    },
  ]
  const detailSections = compact ? compactSections : [
    {
      // The card heading already says the same words: no second heading above the list.
      title: stayFields ? t('clinicalRecords.sectionPatient') : null,
      collapseMissing: true,
      items: [
        { label: cr('patientCode'), value: patient?.id },
        { label: cr('hospitalRecordNumber'), value: patient?.hospitalRecordNumber },
        // Separate surname / first name (as in the patient form) instead of one
        // "full name" field whose order differed from the header.
        {
          label: cr('lastName'),
          value:
            (language === 'en' && patient?.lastNameEn) ||
            patient?.lastName ||
            (!patient?.firstName && patient?.name) ||
            '',
        },
        { label: cr('firstName'), value: (language === 'en' && patient?.firstNameEn) || patient?.firstName || '' },
        { label: cr('fatherName'), value: (language === 'en' && patient?.patronymicEn) || patient?.fatherName || patient?.patronymic },
        { label: cr('dateOfBirthAge'), value: patient?.dateOfBirth ? `${fmtDate(patient.dateOfBirth)} · ${ageLabel}` : '' },
        { label: cr('sex'), value: patient?.sex ? t(patient.sex) : '' },
        patient?.notes ? { label: cr('notes'), value: patient.notes, wide: true } : null,
      ],
    },
    {
      title: t('clinicalRecords.sectionStay'),
      // With the admission shown here too, its department replaces «current department».
      items: stayFields
        ? stayFields.map(([label, value]) => ({ label, value }))
        : patient?.department
          ? [{ label: cr('currentDepartment'), value: patient.department }]
          : [],
    },
    {
      title: t('clinicalRecords.sectionClinical'),
      items: [
        patient?.birthWeightGrams || infantWithoutBirthWeight
          ? { label: cr('birthWeight'), value: patient?.birthWeightGrams ? `${patient.birthWeightGrams} g` : '' }
          : null,
        patient?.gestationalAgeWeeks
          ? { label: cr('gestationalAge'), value: `${patient.gestationalAgeWeeks} ${cr('wk')}` }
          : null,
      ],
    },
  ]
  return (
    <section className={bare ? 'patient-summary-card is-bare' : `clinical-panel patient-summary-card${compact ? ' record-summary-card' : ''}`}>
      {!editing && (
        <SectionHeader
          title={
            title ||
            (stayFields || compact
              ? t('clinicalRecords.patientAndAdmission')
              : translate('copy.clinicalRecordCopy.patientDetails', language === 'el' ? 'el' : 'en'))
          }
          subtitle={
            stayFields || compact
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
        <DetailList sections={detailSections} />
      )}
      {infantWithoutBirthWeight && (
        <p className="field-hint neonatal-missing-weight" role="status">
          {translate('copy.neonatalCopy.missingBirthWeight', language === 'el' ? 'el' : 'en')}
        </p>
      )}
    </section>
  )
}
interface CanonicalSummaryProps {
  onOpenStage: Handler
  onOpenHistory: Handler
  extraAttention?: AnyRecord[]
  epiItems?: AnyRecord[]
  samples: AnyRecord[]
  scaleRows?: AnyRecord[]
  patient: AnyRecord
  admission: AnyRecord
  record: AnyRecord
  tenantId: string
  isDemo: boolean
  departments: AnyRecord[]
  canEdit: boolean
  canDelete: boolean
  showPatientActions: boolean
  onDeleted: Handler
  onChanged: Handler
  onAdmissionDeleted: Handler
  t: (key: string) => string
  language: string
  fmtDate: (value: unknown) => string
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
  onOpenHistory,
  extraAttention = [],
  // The epidemiological questionnaire's origin and risk factors, as rows of the patient column.
  epiItems = [],
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
  t,
  language,
  fmtDate,
}: CanonicalSummaryProps) {
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
        [t('hospitalRecordNumber'), admission.caseNumber || '—'],
        [t('admissionDate'), fmtDate(admission.admissionDate)],
        [t('department'), admission.department || '—'],
        [t('clinicalRecords.lengthOfStay'), daysLabel],
        ...(admission.mdrOnAdmission ? [[t('labSampleFlow.mdrOnAdmission'), admission.mdrOnAdmissionDate ? fmtDate(admission.mdrOnAdmissionDate) : t('yes')]] : []),
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
  const badge = (text: string, tone) =>
    text ? <StatusBadge tone={tone}>{text}</StatusBadge> : '—'
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
      : badge(t(ISOLATION_STATUS[record.isolation.status] || record.isolation.status))
    : t('no')
  const lifecycle = useAdmissionLifecycle({
    patient,
    admission,
    tenantId,
    isDemo,
    departments,
    canEdit,
    onChanged,
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
  const attention = summaryAttention(record, { t, samples: recordSamples, extra: extraAttention })
  const assessment = record?.assessment
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
  const pendingTherapy = (record?.therapy || []).filter((x: AnyRecord) => x.approvalStatus === 'pending')
  const therapyValue = record?.therapy?.length ? (
    <>
      {record.therapy.map((x: AnyRecord) => x.antimicrobial).join(', ')}
      {pendingTherapy.length ? (
        <>
          {' '}
          {badge(
            record.therapy.length > 1
              ? `${pendingTherapy.map((x: AnyRecord) => x.antimicrobial).join(', ')}: ${t('clinicalRecords.awaitingApproval')}`
              : t('clinicalRecords.awaitingApproval'),
            'warning',
          )}
        </>
      ) : null}
    </>
  ) : (
    t('clinicalRecords.none')
  )
  const sampleCountValue = recordSamples.length
    ? `${recordSamples.length}${awaitingCount ? ` · ${awaitingCount} ${t('clinicalRecords.awaitingResultShort')}` : ''}`
    : t('clinicalRecords.none')
  const therapyItem = { label: t('therapy'), value: therapyValue }
  // The latest three events of the surveillance, newest first, under its details.
  const recentEvents = [...(record?.timeline || [])]
    .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
    .slice(0, 3)
  const stayRows = admission
    ? details
    : [
        [t('department'), en ? record?.departmentEn || patient?.departmentEn || record?.department || patient?.department : record?.department || patient?.department],
        [t('admissionDate'), fmtDate(admittedAt)],
        [t('clinicalRecords.lengthOfStay'), daysLabel],
      ]
  const patientMenu = admission && showPatientActions
    ? [
        ...lifecycle.items,
        ...(canDelete
          ? [{ id: 'delete-admission', label: t('clinicalRecords.deleteAdmission'), icon: Trash2, tone: 'danger', separatorBefore: true, onClick: () => setAdmissionDeleteOpen(true) }]
          : []),
      ]
    : []
  // One summary wherever the record opens from: what needs attention, then two columns,
  // the patient and the stay on the left, the current surveillance on the right; one screen.
  return (
    <div className="patient-summary-layout record-summary">
      <AttentionList
        title={t('clinicalRecords.attentionNeeded')}
        items={attention.map(item => ({ id: item.id, text: item.text, tone: item.tone === 'warning' ? 'warning' : 'danger', action: onOpenStage && item.action ? item.action : null, onClick: onOpenStage && item.action ? () => onOpenStage(item.stage) : null }))}
      />
      <div className="record-summary-grid">
        {patient ? (
          <PatientDetailsSection
            compact
            patient={patient}
            tenantId={tenantId}
            isDemo={isDemo}
            departments={departments}
            t={t}
            language={language}
            fmtDate={fmtDate}
            onChanged={onChanged}
            onDeleted={onDeleted}
            stayFields={stayRows}
            extraItems={epiItems}
            extraMenuItems={patientMenu}
          />
        ) : (
          <section className="clinical-panel patient-summary-card record-summary-card">
            <SectionHeader title={t('clinicalRecords.patientDetails')} actions={actions} />
            <DetailList sections={[{ items: stayRows.map(([label, value]) => ({ label, value })) }]} />
          </section>
        )}
        {record ? (
          <section className="clinical-panel patient-summary-card record-summary-card">
            <SectionHeader
              title={t('clinicalRecords.currentSurveillance')}
            />
            <DetailList
              sections={[
                {
                  items: [
                    { label: t('clinicalRecords.haiClassification'), value: haiValue },
                    { label: t('clinicalRecords.latestFinding'), value: findingValue },
                    { label: t('clinicalRecords.clinicalAssessmentLabel'), value: assessmentValue },
                    therapyItem,
                    { label: t('isolation'), value: isolationValue },
                    {
                      label: t('nextReview'),
                      value:
                        record.status === 'active' ? (
                          <DueDate value={record.reviewDue} format={fmtDate} />
                        ) : (
                          fmtDate(record.reviewDue)
                        ),
                    },
                  ],
                },
              ]}
            />
            {recentEvents.length > 0 && (
              <div className="record-summary-events">
                <h4>{t('clinicalRecords.recentEvents')}</h4>
                <ul>
                  {recentEvents.map((event, index) => (
                    <li key={`${event.at}-${index}`}>
                      <b>{fmtDate(event.at)}</b>
                      <span>
                        {[timelineLabel(event.type, language, t), event.detail ? clinicalValueLabel(event.detail, language, t) : '', event.actor || '']
                          .filter(Boolean)
                          .map((part, partIndex) => (
                            <Fragment key={partIndex}>{partIndex ? ' · ' : ''}<span>{part}</span></Fragment>
                          ))}
                      </span>
                    </li>
                  ))}
                </ul>
                {onOpenHistory && (
                  <button type="button" className="record-summary-link" onClick={onOpenHistory}>
                    {t('clinicalRecords.fullHistory')} →
                  </button>
                )}
              </div>
            )}
          </section>
        ) : (
          <section className="clinical-panel patient-summary-card record-summary-card">
            <SectionHeader title={t('clinicalRecords.clinicalPicture')} />
            <DetailList
              sections={[
                {
                  items: [
                    ...clinicalRiskFlags(scaleRows).map(({ kind, row, config, tone }) => ({
                      key: kind,
                      label: en ? config.labelEn : config.labelEl,
                      value: (
                        <>
                          {badge(`${scaleShortName(row.scale_key)} ${row.score ?? '—'}`, tone)}
                          {row.assessed_at ? <small> {fmtDate(row.assessed_at)}</small> : null}
                        </>
                      ),
                    })),
                    !scaleRows.length ? { label: t('clinicalRecords.clinicalAssessmentLabel'), value: t('clinicalRecords.none') } : null,
                    { label: t('clinicalRecords.samplesLabel'), value: sampleCountValue },
                    { label: t('clinicalRecords.latestFinding'), value: findingValue },
                    { label: t('surveillance'), value: t('clinicalRecords.noSurveillance') },
                  ],
                },
              ]}
            />
          </section>
        )}
      </div>
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
    </div>
  )
}