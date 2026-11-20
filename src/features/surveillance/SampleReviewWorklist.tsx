import { useMemo, useState } from 'react'
import { ClipboardCheck, PlayCircle } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { CheckboxField } from '../../design-system/CheckboxField'
import { ChoiceField } from '../../design-system/ChoiceField'
import { Field } from '../../design-system/Field'
import { FormSubmit, useFormValidation } from '../../design-system/FormValidation'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { StatusBadge } from '../../design-system/StatusBadge'
import { formatDateTime } from '../../core/i18n/formatDay'
import { sampleTypeLabel } from '../laboratory/laboratoryCloudService'
import { NO_SURVEILLANCE_REASONS, reasonLabel } from '../laboratory/sampleReviewModel'
import { lateOnsetDay } from './lateOnsetFlags'
import { reviewRowsShown } from './sampleReviewBulk'
import './surveillanceRegistry.css'
import type { ReviewSample } from './surveillanceListTypes'
import type { Handler } from './surveillanceTypes'
import type { LucideIcon } from 'lucide-react'

export const worklistTexts = (language: string) => language === 'en'
  ? { title: 'To review', emptyTitle: 'No samples to review', emptyText: 'New positive samples without an episode appear here until a decision is made.', saved: 'Decision saved.' }
  : { title: 'Προς έλεγχο', emptyTitle: 'Δεν υπάρχουν δείγματα προς έλεγχο', emptyText: 'Τα νέα θετικά δείγματα χωρίς επεισόδιο εμφανίζονται εδώ μέχρι να ληφθεί απόφαση.', saved: 'Η απόφαση αποθηκεύτηκε.' }

interface SampleReviewWorklistProps {
  rows: ReviewSample[]
  empty?: { title?: string, text?: string, icon?: LucideIcon } | null
  language: string
  t: (key: string) => string
  canOpenEpisode: boolean
  onOpenEpisode: Handler
  onDecide: Handler
  // ΜΕΝΝ Ν6β: sample row id → hours after the neonate's admission (positive blood culture ≥ 72 h).
  lateOnset?: Record<string, number>
  // Read-only (the Platform Owner): the list and its tags, no decision.
  readOnly?: boolean
  // Several at once (owner, 19/11/2026): the ticked samples; the page opens one episode per patient, or applies one reason.
  onBulkOpen?: (samples: ReviewSample[]) => Promise<unknown>
  onBulkDecide?: (samples: ReviewSample[], decision: { status: 'no_surveillance_needed', reason: string, note: string }) => Promise<unknown>
}
export function SampleReviewWorklist({ rows: allRows, empty, language, t, canOpenEpisode, onOpenEpisode, onDecide, lateOnset = {}, readOnly = false, onBulkOpen, onBulkDecide }: SampleReviewWorklistProps) {
  const en = language === 'en'
  const [deciding, setDeciding] = useState<ReviewSample | null>(null)
  const [lateOnly, setLateOnly] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeciding, setBulkDeciding] = useState(false)
  const [busy, setBusy] = useState(false)
  const keyOf = (sample: ReviewSample) => String(sample.recordId || sample.id)
  const anyLate = allRows.some(row => row.recordId && lateOnset[String(row.recordId)] != null)
  const rows = useMemo(() => reviewRowsShown(allRows, { lateOnly: lateOnly && anyLate, lateOnset }), [allRows, lateOnly, anyLate, lateOnset])
  const selectable = !readOnly && Boolean(onBulkDecide)
  // Pages like every other list (owner, 19/11/2026).
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize)
  // Only what is still shown counts as ticked (a decided sample leaves the list).
  const picked = rows.filter(row => selected.has(keyOf(row)))
  const allPicked = rows.length > 0 && picked.length === rows.length
  const toggle = (key: string) => setSelected(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next })
  const toggleAll = () => setSelected(allPicked ? new Set() : new Set(rows.map(keyOf)))
  async function run(action: () => Promise<unknown>) {
    if (busy) return
    setBusy(true)
    try { await action(); setSelected(new Set()) } finally { setBusy(false) }
  }
  // The table fills the page down to its pages, like every list (owner, 19/11/2026): the bar and the pages sit
  // outside the scrolling part.
  return (
    <>
    <div className="scroll-table sample-review-worklist">
      {anyLate && <div className="sample-review-bulkbar">
        <CheckboxField className="sample-review-late-only" checked={lateOnly} onChange={setLateOnly} label={en ? 'Only possible late-onset infections (≥ 72 hours)' : 'Μόνο πιθανές όψιμες λοιμώξεις (≥72 ώρες)'} />
      </div>}
      <RegistryTable
        bare
        columns={[
          ...(selectable ? [{ key: 'select', className: 'sample-review-select', label: <CheckboxField checked={allPicked} disabled={!rows.length || busy} ariaLabel={en ? 'Select the whole list' : 'Επιλογή όλης της λίστας'} onChange={toggleAll} /> }] : []),
          { key: 'patient', label: `${t('patient')} · ${t('department')}` },
          { key: 'sample', label: `${t('sampleType')} · ${en ? 'Date' : 'Ημερομηνία'}` },
          { key: 'alert', label: en ? 'Organism / alert' : 'Μικροοργανισμός / ειδοποίηση' },
        ]}
        rows={pageRows}
        emptyTitle={empty?.title}
        emptyText={empty?.text}
        emptyIcon={empty?.icon || ClipboardCheck}
        // Every sample has its code.
        rowKey={sample => (sample.recordId || sample.id) as string}
        renderRow={sample => (
          <>
            {selectable && <td className="sample-review-select">
              <CheckboxField checked={selected.has(keyOf(sample))} disabled={busy} ariaLabel={`${en ? 'Select' : 'Επιλογή'}: ${en ? sample.patientEn || sample.patient : sample.patient} · ${sample.id}`} onChange={() => toggle(keyOf(sample))} />
            </td>}
            <td>
              <strong>{en ? sample.patientEn || sample.patient : sample.patient}</strong>
              <small>{[sample.patientId, en ? sample.departmentEn : sample.department].filter(Boolean).join(' · ') || '—'}</small>
            </td>
            <td>
              <strong>{sampleTypeLabel(sample, t, language)}</strong>
              <small>{[formatDateTime(sample.collectedAt || sample.requestedAt, language), sample.id].join(' · ')}</small>
            </td>
            <td>
              <strong>{sample.organism || (en ? 'Positive' : 'Θετικό')}</strong>
              {sample.recordId && lateOnset[sample.recordId] != null && <StatusBadge tone="warning">{en ? `Possible late-onset infection · NICU (day ${lateOnsetDay(lateOnset[sample.recordId])})` : `Πιθανή όψιμη λοίμωξη · ΜΕΝΝ (${lateOnsetDay(lateOnset[sample.recordId])}η ημέρα)`}</StatusBadge>}
              <small>
                {[sample.resistance, sample.critical ? (en ? 'Critical' : 'Κρίσιμο') : '', sample.type === 'bloodCulture' ? (en ? 'Blood culture' : 'Αιμοκαλλιέργεια') : ''].filter(Boolean).join(' · ')}
              </small>
            </td>
          </>
        )}
      />
    </div>
      {/* The ticked rows (owner, 19/11/2026): no buttons on the rows; one bar above the pages while something is ticked.
          One sample ticked takes the single paths (the episode form with its stay, the single dialog). */}
      {selectable && picked.length > 0 && <div className="sample-review-selection-bar" role="region" aria-label={en ? 'Selected samples' : 'Επιλεγμένα δείγματα'}>
        <strong>{en ? `${picked.length} selected` : `${picked.length} επιλεγμένα`}{allPicked && rows.length > pageRows.length ? (en ? ' (the whole list, every page)' : ' (όλη η λίστα, όλες οι σελίδες)') : ''}</strong>
        <span className="sample-review-bulk-actions">
          {canOpenEpisode && <Button variant="secondary" disabled={busy || (picked.length > 1 && !onBulkOpen)} onClick={() => (picked.length === 1 ? onOpenEpisode(picked[0]) : onBulkOpen && run(() => onBulkOpen(picked)))}>
            <PlayCircle size={14} />
            {picked.length === 1 ? (en ? 'Open episode' : 'Άνοιγμα επεισοδίου') : (en ? 'Open episodes' : 'Άνοιγμα επεισοδίων')}
          </Button>}
          <Button variant="secondary" disabled={busy} onClick={() => (picked.length === 1 ? setDeciding(picked[0]) : setBulkDeciding(true))}>
            {en ? 'No surveillance needed' : 'Δεν χρειάζεται επιτήρηση'}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setSelected(new Set())}>
            {en ? 'Clear selection' : 'Ακύρωση επιλογής'}
          </Button>
        </span>
      </div>}
      <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1) }} />
      {bulkDeciding && onBulkDecide && (
        <NoSurveillanceDialog
          count={picked.length}
          language={language}
          onClose={() => setBulkDeciding(false)}
          onSave={async decision => {
            await run(() => onBulkDecide(picked, decision))
            setBulkDeciding(false)
          }}
        />
      )}
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
    </>
  )
}

interface NoSurveillanceDialogProps {
  sample?: ReviewSample
  // Several samples at once: the subtitle says how many.
  count?: number
  language: string
  onClose: Handler
  onSave: Handler
}
export function NoSurveillanceDialog({ sample, count, language, onClose, onSave }: NoSurveillanceDialogProps) {
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
      subtitle={sample ? [en ? sample.patientEn || sample.patient : sample.patient, sample.organism, sample.id].filter(Boolean).join(' · ') : en ? `${count} samples: one reason for all` : `${count} δείγματα: ένας λόγος για όλα`}
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

interface SampleReviewTagProps {
  label: string
}
export function SampleReviewTag({ label }: SampleReviewTagProps) {
  if (!label) return null
  return <StatusBadge tone="neutral">{label}</StatusBadge>
}

// What a decision for several samples did, in one sentence: how many, and which failed (owner, 19/11/2026).
export function bulkSummaryText(result: { done: number, failed: { label: string }[] }, kind: 'open' | 'decide', language: string) {
  const en = language === 'en'
  const head = kind === 'open'
    ? (en ? `${result.done} episode(s) opened.` : `Άνοιξαν ${result.done} επεισόδια.`)
    : (en ? `${result.done} sample(s) recorded as «No surveillance needed».` : `${result.done} δείγματα καταχωρίστηκαν ως «Δεν χρειάζεται επιτήρηση».`)
  if (!result.failed.length) return head
  return `${head} ${en ? 'Not done' : 'Δεν έγιναν'} (${result.failed.length}): ${result.failed.slice(0, 5).map(item => item.label).join(', ')}${result.failed.length > 5 ? '…' : ''}`
}
