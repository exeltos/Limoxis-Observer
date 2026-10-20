import { useMemo, useState } from 'react'
import { ArrowLeft, LogOut } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { Field } from '../../design-system/Field'
import { FormSubmit, useFormValidation } from '../../design-system/FormValidation'
import { ManualDateField } from '../../design-system/ManualDateField'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { DetailList } from '../../design-system/DetailList'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { TimeField } from '../../design-system/TimeField'
import { translate } from '../../core/i18n/LanguageContext'
import { hospitalDay } from './patientRecordScope'

// «Εξιτήριο ασθενούς»: never saved by one click. Step 1 asks when and why,
// step 2 shows the summary and waits for the explicit «Επιβεβαίωση εξιτηρίου».
// The database stores the discharge date (date column), and the reason, time
// and note as the «Discharge: …» line of the admission notes and in the audit log.
export const DISCHARGE_REASONS = Object.freeze([
  { value: 'discharge', key: 'dischargeReasonDischarge', el: 'Εξιτήριο' },
  { value: 'transfer_out', key: 'dischargeReasonTransferOut', el: 'Μεταφορά σε άλλο νοσοκομείο' },
  { value: 'death', key: 'dischargeReasonDeath', el: 'Θάνατος' },
  { value: 'own_risk', key: 'dischargeReasonOwnRisk', el: 'Αποχώρηση με δική του ευθύνη' },
  { value: 'other', key: 'dischargeReasonOther', el: 'Άλλο' },
])

const HOSPITAL_TIME_ZONE = 'Europe/Athens'

// «Now» on the hospital's clock (Europe/Athens), as { date: 'YYYY-MM-DD', time: 'HH:MM' }.
export function hospitalNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: HOSPITAL_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const part = type => parts.find(item => item.type === type)?.value
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` }
}

// What keeps a discharge from being recorded: no date in the future (nor a time later
// than now today), none before the admission. Returns { date?, time? } messages ('' when fine).
export function dischargeDateIssues({ date, time, admissionDate, now = hospitalNow() }, text) {
  const issues = {}
  const admitted = hospitalDay(admissionDate)
  if (date && date > now.date) issues.date = text.future
  else if (date && admitted && date < admitted) issues.date = text.beforeAdmission
  else if (date && time && date === now.date && time > now.time) issues.time = text.timeFuture
  return issues
}

// The line kept in the admission notes (the stored reason): «Μεταφορά σε άλλο νοσοκομείο · 14:30 — σημείωση».
export function dischargeReasonText({ reason, time, note }) {
  const label = DISCHARGE_REASONS.find(item => item.value === reason)?.el || reason
  return `${[label, time].filter(Boolean).join(' · ')}${note?.trim() ? ` — ${note.trim()}` : ''}`
}

export function AdmissionDischargeDialog({ patient, admission, t, language, fmtDate, busy = false, onClose, onConfirm }) {
  const now = useMemo(() => hospitalNow(), [])
  const [step, setStep] = useState('form')
  const [draft, setDraft] = useState({ date: now.date, time: now.time, reason: '', note: '' })
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  const text = {
    future: t('clinicalRecords.dischargeInFuture'),
    beforeAdmission: `${t('clinicalRecords.dischargeBeforeAdmission')} (${fmtDate(admission?.admissionDate)})`,
    timeFuture: t('clinicalRecords.dischargeTimeInFuture'),
  }
  const issues = dischargeDateIssues({ ...draft, admissionDate: admission?.admissionDate }, text)
  const form = useFormValidation([
    { key: 'date', label: t('clinicalRecords.dischargeAt'), valid: Boolean(draft.date) && !issues.date, message: issues.date },
    { key: 'time', label: t('clinicalRecords.dischargeTime'), valid: Boolean(draft.time) && !issues.time, message: issues.time },
    { key: 'reason', label: t('clinicalRecords.dischargeReason'), valid: Boolean(draft.reason) },
  ])
  const reasonLabel = value => {
    const item = DISCHARGE_REASONS.find(row => row.value === value)
    return item ? t(`clinicalRecords.${item.key}`) : ''
  }
  const confirming = step === 'confirm'
  const summary = [
    {
      items: [
        { label: t('patient'), value: language === 'en' ? patient?.nameEn || patient?.name : patient?.name },
        { label: t('department'), value: admission?.department },
        { label: t('admissionDate'), value: fmtDate(admission?.admissionDate) },
        { label: t('clinicalRecords.dischargeAt'), value: `${fmtDate(draft.date)} · ${draft.time}` },
        { label: t('clinicalRecords.dischargeReason'), value: reasonLabel(draft.reason) },
        { label: t('clinicalRecords.dischargeNote'), value: draft.note.trim(), wide: true },
      ],
    },
  ]
  return (
    <ObserverDialog
      width="medium"
      className="admission-discharge-dialog"
      title={confirming ? t('clinicalRecords.dischargeConfirm') : translate('copy.clinicalRecordCopy.dischargePatient', language === 'el' ? 'el' : 'en')}
      subtitle={confirming ? t('clinicalRecords.dischargeConfirmIntro') : null}
      onClose={onClose}
      footer={
        confirming ? (
          <>
            <Button variant="secondary" disabled={busy} onClick={() => setStep('form')}>
              <ArrowLeft size={15} />
              {t('clinicalRecords.dischargeBack')}
            </Button>
            <Button className="danger" loading={busy} onClick={() => onConfirm({ date: draft.date, reason: dischargeReasonText(draft), reasonCode: draft.reason, time: draft.time, note: draft.note.trim() })}>
              {!busy && <LogOut size={15} />}
              {t('clinicalRecords.dischargeConfirm')}
            </Button>
          </>
        ) : (
          <FormSubmit form={form} icon={false} disabled={busy} onSubmit={() => setStep('confirm')}>
            {t('clinicalRecords.dischargeContinue')}
          </FormSubmit>
        )
      }
    >
      {confirming ? (
        <DetailList sections={summary} />
      ) : (
        <div className="entry-grid" ref={form.scopeRef}>
          <ManualDateField label={t('clinicalRecords.dischargeAt')} value={draft.date} onChange={value => set('date', value)} {...form.field('date')} />
          <TimeField label={t('clinicalRecords.dischargeTime')} value={draft.time} onChange={value => set('time', value)} {...form.field('time')} />
          <div className="entry-span-2">
            <SearchableSelect
              label={t('clinicalRecords.dischargeReason')}
              value={draft.reason}
              options={DISCHARGE_REASONS.map(item => ({ value: item.value, label: t(`clinicalRecords.${item.key}`) }))}
              placeholder={t('select')}
              clearLabel=""
              onChange={value => set('reason', value)}
              {...form.field('reason')}
            />
          </div>
          <Field label={`${t('clinicalRecords.dischargeNote')} · ${t('optional')}`} className="entry-span-2">
            <textarea rows={3} value={draft.note} onChange={event => set('note', event.target.value)} />
          </Field>
        </div>
      )}
    </ObserverDialog>
  )
}
