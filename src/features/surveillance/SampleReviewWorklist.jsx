import { useState } from 'react'
import { ClipboardCheck, PlayCircle } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { ChoiceField } from '../../design-system/ChoiceField'
import { Field } from '../../design-system/Field'
import { FormSubmit, useFormValidation } from '../../design-system/FormValidation'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { RegistryTable } from '../../design-system/RegistryTable'
import { StatusBadge } from '../../design-system/StatusBadge'
import { formatDateTime } from '../../core/i18n/formatDay'
import { sampleTypeLabel } from '../laboratory/laboratoryCloudService'
import { NO_SURVEILLANCE_REASONS, reasonLabel } from '../laboratory/sampleReviewModel'
import './surveillanceRegistry.css'

export const worklistTexts = language => language === 'en'
  ? { title: 'To review', emptyTitle: 'No samples to review', emptyText: 'New positive samples without an episode appear here until a decision is made.', saved: 'Decision saved.' }
  : { title: 'Προς έλεγχο', emptyTitle: 'Δεν υπάρχουν δείγματα προς έλεγχο', emptyText: 'Τα νέα θετικά δείγματα χωρίς επεισόδιο εμφανίζονται εδώ μέχρι να ληφθεί απόφαση.', saved: 'Η απόφαση αποθηκεύτηκε.' }

// «Προς έλεγχο»: the positive/alert samples that have no episode and no decision yet.
// The two actions live here only (one action, one place): open an episode from the
// sample, or record that no surveillance is needed, with a reason.
export function SampleReviewWorklist({ rows, empty, language, t, canOpenEpisode, onOpenEpisode, onDecide }) {
  const en = language === 'en'
  const [deciding, setDeciding] = useState(null)
  return (
    <div className="scroll-table sample-review-worklist">
      <RegistryTable
        bare
        columns={[
          { key: 'patient', label: `${t('patient')} · ${t('department')}` },
          { key: 'sample', label: `${t('sampleType')} · ${en ? 'Date' : 'Ημερομηνία'}` },
          { key: 'alert', label: en ? 'Organism / alert' : 'Μικροοργανισμός / ειδοποίηση' },
          { key: 'actions', label: en ? 'Decision' : 'Απόφαση' },
        ]}
        rows={rows}
        emptyTitle={empty?.title}
        emptyText={empty?.text}
        emptyIcon={empty?.icon || ClipboardCheck}
        rowKey={sample => sample.recordId || sample.id}
        renderRow={sample => (
          <>
            <td>
              <strong>{en ? sample.patientEn || sample.patient : sample.patient}</strong>
              <small>{[sample.patientId, en ? sample.departmentEn : sample.department].filter(Boolean).join(' · ') || '—'}</small>
            </td>
            <td>
              <strong>{sampleTypeLabel(sample.type, t)}</strong>
              <small>{[formatDateTime(sample.collectedAt || sample.requestedAt, language), sample.id].join(' · ')}</small>
            </td>
            <td>
              <strong>{sample.organism || (en ? 'Positive' : 'Θετικό')}</strong>
              <small>
                {[sample.resistance, sample.critical ? (en ? 'Critical' : 'Κρίσιμο') : '', sample.type === 'bloodCulture' ? (en ? 'Blood culture' : 'Αιμοκαλλιέργεια') : ''].filter(Boolean).join(' · ')}
              </small>
            </td>
            <td>
              <span className="sample-review-actions">
                {canOpenEpisode && (
                  <Button className="sample-review-open" variant="secondary" onClick={() => onOpenEpisode(sample)}>
                    <PlayCircle size={14} />
                    {en ? 'Open episode' : 'Άνοιγμα επεισοδίου'}
                  </Button>
                )}
                <Button className="sample-review-dismiss" variant="ghost" onClick={() => setDeciding(sample)}>
                  {en ? 'No surveillance needed' : 'Δεν χρειάζεται επιτήρηση'}
                </Button>
              </span>
            </td>
          </>
        )}
      />
      {deciding && (
        <NoSurveillanceDialog
          sample={deciding}
          language={language}
          onClose={() => setDeciding(null)}
          onSave={async decision => {
            if ((await onDecide(deciding, decision)) !== false) setDeciding(null)
          }}
        />
      )}
    </div>
  )
}

// «Δεν χρειάζεται επιτήρηση»: the reason is required (contamination, colonisation, known case, other).
export function NoSurveillanceDialog({ sample, language, onClose, onSave }) {
  const en = language === 'en'
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const form = useFormValidation([{ key: 'reason', label: en ? 'Reason' : 'Λόγος', valid: Boolean(reason) }])
  async function save() {
    if (busy) return
    setBusy(true)
    try {
      await onSave({ status: 'no_surveillance_needed', reason, note: note.trim() })
    } finally {
      setBusy(false)
    }
  }
  return (
    <ObserverDialog
      width="small"
      title={en ? 'No surveillance needed' : 'Δεν χρειάζεται επιτήρηση'}
      subtitle={[en ? sample.patientEn || sample.patient : sample.patient, sample.organism, sample.id].filter(Boolean).join(' · ')}
      onClose={onClose}
      footer={
        <FormSubmit form={form} icon={false} disabled={busy} onSubmit={save}>
          {en ? 'Save' : 'Αποθήκευση'}
        </FormSubmit>
      }
    >
      <div className="entry-grid">
        <ChoiceField
          className="entry-span-2"
          label={en ? 'Reason' : 'Λόγος'}
          {...form.field('reason')}
          value={reason}
          options={NO_SURVEILLANCE_REASONS.map(code => ({ value: code, label: reasonLabel(code, language) }))}
          onChange={setReason}
        />
        <Field className="entry-span-2" label={en ? 'Note (optional)' : 'Σημείωση (προαιρετική)'}>
          <textarea rows={3} value={note} onChange={event => setNote(event.target.value)} />
        </Field>
      </div>
    </ObserverDialog>
  )
}

// The plain-word tag a decided sample carries (Laboratory list and sample record).
export function SampleReviewTag({ label }) {
  if (!label) return null
  return <StatusBadge tone="neutral">{label}</StatusBadge>
}
