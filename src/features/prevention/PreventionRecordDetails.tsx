// The details sheet, key figures and own list of each Prevention record (hand hygiene, antiseptics, bundles).
import { SectionHeader } from '../../design-system/SectionHeader'
import { ABHR_TARGET, HAND_HYGIENE_TARGET } from './preventionKpis'
import { DetailFields } from '../../design-system/DetailList'
import { RecordMetricStrip } from '../../design-system/RecordMetricStrip'
import { RegistryTable } from '../../design-system/RegistryTable'
import { Button } from '../../design-system/Button'
import { WHO_MOMENTS, WHO_PROFESSIONS } from './WhoHandHygieneEditor'
import { antisepticMethodLabel, antisepticPeriodLabel } from './antisepticMethods'
import { StatusBadge } from '../../design-system/StatusBadge'
import { formatDay } from '../../core/i18n/formatDay'
import { normalizeWhoMoments, sessionHandHygieneStats } from './whoHandHygieneStats'
import { RegistryTotals } from '../../design-system/RegistryTotals'
import type { AnyRecord } from '../../types/featureTypes'

export const formatMonth = (value: string | null | undefined) => (value ? antisepticPeriodLabel(value) : '')

// Prevention records share one layout: the context as a details sheet, the key
// figures as a metric strip, then the record's own list under a section header.
export function HandHygieneDetails({ record, language }: { record: AnyRecord; language: string }) {
  const en = language === 'en'
  const items = record.whoObservations || []
  const stats = sessionHandHygieneStats(record)
  const session = record.session || {}
  const actionLabel = (item: AnyRecord) =>
    item.action === 'HR'
      ? en
        ? 'Alcohol-based hand rub'
        : 'Αλκοολούχο αντισηπτικό'
      : item.action === 'HW'
        ? en
          ? 'Hand wash with soap & water'
          : 'Πλύσιμο με σαπούνι & νερό'
        : en
          ? 'Not performed'
          : 'Δεν πραγματοποιήθηκε'
  const profession = (item: AnyRecord) => {
    const p = WHO_PROFESSIONS.find(([el]) => el === item.professionalCategory)
    return p ? (en ? p[1] : p[0]) : item.professionalCategory || '—'
  }
  return (
    <div className="record-view-stack">
      <section>
        <SectionHeader title={en ? 'Observation session' : 'Στοιχεία παρατήρησης'} />
        <DetailFields
          fields={[
            {
              id: 'date',
              label: en ? 'Date' : 'Ημερομηνία',
              value: formatDay(record.date || session.date, language),
            },
            {
              id: 'department',
              label: en ? 'Department' : 'Τμήμα',
              value: record.departmentEl || session.department,
            },
            {
              id: 'observer',
              label: en ? 'Observer' : 'Παρατηρητής',
              value: record.observer || session.observer,
            },
            {
              id: 'time',
              label: en ? 'Time' : 'Ώρα',
              value: `${session.startTime || '—'} – ${session.endTime || '—'}`,
            },
          ]}
        />
      </section>
      {/* The figures of the observation in one line (owner, 8/11/2026: not six boxes). */}
      <div className="who-record-totals"><RegistryTotals label={en ? 'Observation figures' : 'Αριθμοί παρατήρησης'} items={[
        { key: 'compliance', always: true, value: 0, display: `${stats.compliance}%`, label: en ? 'WHO compliance' : 'συμμόρφωση WHO', tone: stats.opportunities ? (Number(stats.compliance) >= HAND_HYGIENE_TARGET ? 'good' : 'danger') : undefined, title: `${stats.compliant || 0} / ${stats.opportunities || 0} ${en ? 'compliant opportunities' : 'συμμορφούμενες ευκαιρίες'} · ${en ? 'target' : 'στόχος'} ≥ ${HAND_HYGIENE_TARGET}%` },
        { key: 'opportunities', always: true, value: stats.opportunities || 0, label: en ? 'opportunities' : 'ευκαιρίες' },
        { key: 'professionals', always: true, value: stats.professionals || 0, label: en ? 'professionals' : 'επαγγελματίες' },
        { key: 'hw', always: true, value: stats.handWash || 0, label: en ? 'hand wash' : 'πλύσιμο' },
        { key: 'hr', always: true, value: stats.handRub || 0, label: en ? 'hand rub' : 'αντισηπτικό' },
        { key: 'missed', always: true, value: stats.missed || 0, label: en ? 'not performed' : 'μη συμμορφούμενες', tone: stats.missed ? 'danger' : undefined },
      ]} /></div>
      <section>
        <SectionHeader
          title={en ? 'Recorded opportunities' : 'Καταγεγραμμένες ευκαιρίες'}
          subtitle={en ? 'WHO 5 Moments' : '5 Στιγμές του ΠΟΥ'}
          actions={<StatusBadge>{items.length}</StatusBadge>}
        />
        <RegistryTable
          className="who-record-table"
          columns={[
            { key: 'index', label: '#' },
            { key: 'professional', label: en ? 'Professional' : 'Επαγγελματίας' },
            { key: 'moments', label: en ? 'WHO indication' : 'Ένδειξη WHO' },
            { key: 'action', label: en ? 'Action' : 'Ενέργεια' },
            { key: 'gloves', label: en ? 'Gloves' : 'Γάντια' },
            { key: 'note', label: en ? 'Note' : 'Σημείωση' },
          ]}
          rows={items}
          rowKey={(item, index) => item.id || index}
          emptyTitle={en ? 'No opportunities recorded' : 'Δεν καταγράφηκαν ευκαιρίες'}
          renderRow={(item, index) => (
            <>
              <td>{index + 1}</td>
              <td>
                <strong>
                  {item.professionalsCount || 1} × {profession(item)}
                </strong>
              </td>
              <td>
                <div className="who-record-moments-cell">
                  {normalizeWhoMoments(item).map(id => {
                    const m = WHO_MOMENTS.find(x => x.id === id)
                    return (
                      <StatusBadge key={id}>
                        {id.replace('moment', '')} ·{' '}
                        {m
                          ? en
                            ? m.labelEn.replace(/^\d+\.\s*/, '')
                            : m.label.replace(/^\d+\.\s*/, '')
                          : id}
                      </StatusBadge>
                    )
                  })}
                </div>
              </td>
              <td>
                <StatusBadge tone={item.action === 'MISSED' ? 'danger' : 'success'}>
                  {actionLabel(item)}
                </StatusBadge>
              </td>
              <td>{item.gloves ? (en ? 'Yes' : 'Ναι') : en ? 'No' : 'Όχι'}</td>
              <td>{item.notes || '—'}</td>
            </>
          )}
        />
      </section>
    </div>
  )
}

export function AntisepticDetails({ record, language, locale }: { record: AnyRecord; language: string; locale: string }) {
  const en = language === 'en'
  return (
    <div className="record-view-stack">
      <section>
        <SectionHeader
          title={en ? 'Consumption' : 'Κατανάλωση'}
        />
        <DetailFields
          fields={[
            { id: 'period', label: en ? 'Period' : 'Περίοδος', value: formatMonth(record.period) },
            { id: 'department', label: en ? 'Department' : 'Τμήμα', value: record.departmentEl },
            {
              id: 'product',
              label: en ? 'Product' : 'Προϊόν',
              value: en ? record.productEn || record.product : record.product,
            },
            {
              id: 'method',
              label: en ? 'Source / method' : 'Πηγή / μέθοδος',
              value: antisepticMethodLabel(record.method, language),
            },
            {
              id: 'reference',
              label: en ? 'Reference / document' : 'Αναφορά / παραστατικό',
              value: record.referenceNumber,
            },
            {
              id: 'responsible',
              label: en ? 'Responsible' : 'Υπεύθυνος',
              value: record.responsible,
            },
            {
              id: 'notes',
              className: 'is-wide',
              label: en ? 'Notes' : 'Σημειώσεις',
              value: record.notes,
              hidden: !record.notes,
            },
          ]}
        />
      </section>
      <RecordMetricStrip
        items={[
          {
            id: 'litres',
            label: en ? 'Consumption' : 'Κατανάλωση',
            value: Number(record.litres).toLocaleString(locale),
            unit: 'L',
          },
          {
            id: 'days',
            label: en ? 'Patient-days' : 'Νοσηλευτικές ημέρες',
            value: record.patientDays || '—',
          },
          {
            id: 'indicator',
            primary: true,
            label: en ? 'ABHR indicator' : 'Δείκτης ABHR',
            value: record.indicator != null ? Number(record.indicator).toLocaleString(locale) : '—',
            tone: record.indicator == null ? undefined : Number(record.indicator) >= ABHR_TARGET ? 'success' : 'danger',
            note: `${en ? 'L / 1,000 patient-days' : 'L / 1.000 νοσηλευτικές ημέρες'} · ${en ? 'target' : 'στόχος'} ≥ ${ABHR_TARGET}`,
          },
        ]}
      />
    </div>
  )
}

const SHIFT_LABELS: Record<string, [string, string]> = {
  morning: ['Πρωινή', 'Morning'],
  afternoon: ['Απογευματινή', 'Afternoon'],
  evening: ['Απογευματινή', 'Evening'],
  night: ['Νυχτερινή', 'Night'],
}
function shiftLabel(value: string, en: boolean) {
  const pair = SHIFT_LABELS[value]
  return pair ? (en ? pair[1] : pair[0]) : value || '—'
}
// Corrected, still open, no longer applicable, or not reviewed yet.
const FOLLOW_UP_TONES: Record<string, string> = { resolved: 'success', open: 'danger', not_applicable: 'neutral' }
export const bundleFollowUpTone = (status: string | undefined) => FOLLOW_UP_TONES[status as string] || 'warning'
export function BundleDetails({ record, language, canEdit, onFollowUp }: { record: AnyRecord; language: string; canEdit: boolean; onFollowUp: (item: AnyRecord) => void }) {
  const en = language === 'en'
  const template = record.templateSnapshot || {}
  const elements: [string, string][] = template.elements || []
  const findings =
    record.findings ||
    elements
      .filter(([id]) => record.answers?.[id] === 'no')
      .map(([id, label]) => ({ id, label, note: record.answerNotes?.[id] || '' }))
  const followUpLabel = (status: string | undefined) =>
    status === 'resolved'
      ? en
        ? 'Corrected'
        : 'Διορθώθηκε'
      : status === 'open'
        ? en
          ? 'Still pending'
          : 'Παραμένει'
        : status === 'not_applicable'
          ? en
            ? 'No longer applicable'
            : 'Δεν εφαρμόζεται πλέον'
          : en
            ? 'Pending review'
            : 'Προς επανέλεγχο'
  return (
    <div className="record-view-stack bundle-record-view">
      <section>
        <SectionHeader
          title={en ? record.templateName || template.name || record.bundle : record.templateTitle || template.title || record.templateName || template.name || record.bundle}
          subtitle={`${record.templateSource || template.source || ''} · v${record.templateVersion || template.version || '1.0'}`}
        />
        <DetailFields
          className="record-details-cols-6"
          fields={[
            {
              id: 'date',
              label: en ? 'Date' : 'Ημερομηνία',
              value: formatDay(record.date || record.period, language),
            },
            { id: 'department', label: en ? 'Department' : 'Τμήμα', value: record.departmentEl },
            { id: 'shift', label: en ? 'Shift' : 'Βάρδια', value: shiftLabel(record.shift, en) },
            { id: 'owner', label: en ? 'Responsible' : 'Υπεύθυνος', value: record.owner },
            { id: 'patient', label: en ? 'Patient' : 'Ασθενής', value: record.patientRef },
            { id: 'device', label: en ? 'Device' : 'Συσκευή', value: record.deviceRef },
            {
              id: 'notes',
              className: 'is-wide',
              label: en ? 'Notes' : 'Σημειώσεις',
              value: record.generalNotes,
              hidden: !record.generalNotes,
            },
          ]}
        />
      </section>
      <RecordMetricStrip
        items={[
          {
            id: 'score',
            primary: true,
            label: en ? 'Score' : 'Βαθμολογία',
            value: record.score == null ? '—' : `${record.score}%`,
            // All or none: anything short of every applicable element is not compliant.
            tone: record.score == null ? undefined : record.allOrNone ? 'success' : 'danger',
            note: en ? 'all or none' : 'όλα ή τίποτα',
          },
          {
            id: 'applicable',
            label: en ? 'Applicable' : 'Εφαρμόσιμα',
            value: record.applicableCount ?? '—',
          },
          {
            id: 'deviations',
            tone: (record.failedCount ?? findings.length) ? 'danger' : undefined,
            label: en ? 'Deviations' : 'Αποκλίσεις',
            value: record.failedCount ?? findings.length,
          },
        ]}
      />
      <section className="bundle-record-elements">
        <SectionHeader title={en ? 'Bundle results' : 'Αποτελέσματα δέσμης μέτρων'} />
        <div className="bundle-detail-list">
          {elements.map(([id, label], index) => {
            const value = record.answers?.[id]
            return (
              <div
                className={`bundle-detail-row ${value === 'no' ? 'failed' : value === 'yes' ? 'passed' : 'na'}`}
                key={id}
              >
                <span className="bundle-detail-index">{index + 1}</span>
                <strong>{label}</strong>
                <span className="bundle-detail-answer">
                  {value === 'yes'
                    ? en
                      ? 'Yes'
                      : 'Ναι'
                    : value === 'no'
                      ? en
                        ? 'No'
                        : 'Όχι'
                      : value === 'na'
                        ? en
                          ? 'N/A'
                          : 'Μ/Ε'
                        : '—'}
                </span>
                {value === 'no' && record.answerNotes?.[id] && (
                  <small>{record.answerNotes[id]}</small>
                )}
              </div>
            )
          })}
        </div>
      </section>
      {findings.length > 0 && (
        <section className="bundle-record-findings">
          <SectionHeader
            title={en ? 'Items for follow-up' : 'Σημεία για επανέλεγχο'}
            subtitle={
              en
                ? 'Review each deviation and record whether it was corrected, remains open or no longer applies.'
                : 'Επανελέγξτε κάθε απόκλιση και καταγράψτε αν διορθώθηκε, παραμένει ή δεν εφαρμόζεται πλέον.'
            }
          />
          {findings.map((item: AnyRecord) => {
            const followUp = record.followUps?.[item.id]
            return (
              <div
                className={`bundle-record-finding bundle-followup-${followUp?.status || 'pending'}`}
                key={item.id}
              >
                <div className="bundle-followup-copy">
                  <strong>{item.label}</strong>
                  <span>
                    {item.note ||
                      (en
                        ? 'Investigation / corrective action required.'
                        : 'Απαιτείται διερεύνηση / διορθωτική ενέργεια.')}
                  </span>
                  {followUp?.comment && <small>{followUp.comment}</small>}
                </div>
                <div className="bundle-followup-meta">
                  <StatusBadge tone={bundleFollowUpTone(followUp?.status)}>
                    {followUpLabel(followUp?.status)}
                  </StatusBadge>
                  {followUp?.date && (
                    <small>
                      {en ? 'Review date' : 'Ημ. επανελέγχου'}: {formatDay(followUp.date, language)}
                    </small>
                  )}
                  {followUp?.reviewedBy && (
                    <small>
                      {en ? 'Reviewed by' : 'Επανέλεγχος από'}: {followUp.reviewedBy}
                    </small>
                  )}
                  {canEdit && (
                    <Button variant="secondary" onClick={() => onFollowUp?.(item)}>
                      {followUp
                        ? en
                          ? 'Edit follow-up'
                          : 'Επεξεργασία επανελέγχου'
                        : en
                          ? 'Follow-up'
                          : 'Επανέλεγχος'}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}
