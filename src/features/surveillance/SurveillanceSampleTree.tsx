// The samples of the surveillance tab as a tree: each sample with its follow-up samples under it.
import { sampleParentCode, sampleTone } from './patientRecordScope'
import { Microscope, PlayCircle, RefreshCcw } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { StatusBadge } from '../../design-system/StatusBadge'
import { translate } from '../../core/i18n/LanguageContext'
import { RESISTANCE_ALERT } from './clinicalRecordLabels'
import { SAMPLE_TONES } from './ClinicalRecordViews'
import type { MicrobiologyResult } from './clinicalTypes'
import type { TreeSample } from './surveillanceListTypes'
import type { Handler } from './surveillanceTypes'

interface SampleTreeProps {
  samples?: TreeSample[]
  linked: boolean
  onFollowUp: Handler
  onCreateFromSample: Handler
  canCreate: boolean
  canCreateSample: boolean
  sampleMenu: Handler
  t: (key: string) => string
  language: string
  fmtDate: (value: unknown) => string
}
export function SampleTree({
  samples = [],
  linked,
  onFollowUp,
  onCreateFromSample,
  canCreate,
  canCreateSample,
  sampleMenu,
  t,
  language,
  fmtDate,
}: SampleTreeProps) {
  const codes = new Set(samples.map(x => String(x.id || '')))
  const byDate = (a: TreeSample, b: TreeSample) =>
    String(a.collectedAt || a.requestedAt || '').localeCompare(
      String(b.collectedAt || b.requestedAt || ''),
    )
  const roots = samples
    .filter(x => !sampleParentCode(x) || !codes.has(sampleParentCode(x)))
    .sort(byDate)
  const render = (sample: TreeSample, depth = 0) => {
    const children = samples
      .filter(x => sampleParentCode(x) === String(sample.id || ''))
      .sort(byDate)
    return (
      <div
        className={`sv-sample-node ${depth ? 'is-followup' : ''}`}
        data-sample-root={depth === 0 ? 'true' : undefined}
        key={sample.recordId || sample.id}
      >
        <SampleTreeRow
          sample={sample}
          linked={linked}
          depth={depth}
          onFollowUp={onFollowUp}
          onCreateFromSample={onCreateFromSample}
          canCreate={canCreate}
          canCreateSample={canCreateSample}
          sampleMenu={sampleMenu}
          t={t}
          language={language}
          fmtDate={fmtDate}
        />
        {children.length > 0 && (
          <div className="sv-sample-children">
            {children.map(child => render(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }
  return <>{roots.map(x => render(x, 0))}</>
}
interface SampleTreeRowProps {
  sample: TreeSample
  linked: boolean
  depth?: number
  onFollowUp: Handler
  onCreateFromSample: Handler
  canCreate: boolean
  canCreateSample: boolean
  sampleMenu: Handler
  t: (key: string) => string
  language: string
  fmtDate: (value: unknown) => string
}
export function SampleTreeRow({
  sample,
  linked,
  depth = 0,
  onFollowUp,
  onCreateFromSample,
  canCreate,
  canCreateSample,
  sampleMenu,
  t,
  language,
  fmtDate,
}: SampleTreeRowProps) {
  // Every sample has its type.
  const type = t((sample.sampleType || sample.type) as string) || sample.sampleType || sample.type || '—'
  const status = t(sample.result || sample.status || 'pending')
  const clean = (value: unknown) => {
    const text = String(value ?? '').trim()
    return text && text !== '—' ? text : ''
  }
  const organism = clean(
    sample.organism ||
      sample.microorganism ||
      sample.microbiologyResults?.find((x: MicrobiologyResult) => x.organism)?.organism,
  )
  const amr = clean(
    sample.resistance || sample.amr || sample.microbiologyResults?.find((x: MicrobiologyResult) => x.amr)?.amr,
  )
  const tone = sampleTone(sample)
  const isNegative = tone === 'negative'
  return (
    <div className={`sv-sample sv-tone-${tone} ${linked ? 'is-linked' : 'is-unlinked'}`}>
      <span className="sv-sample-icon" aria-hidden="true">
        {depth ? <RefreshCcw size={14} /> : <Microscope size={15} />}
      </span>
      <span className="sv-sample-main">
        <strong>
          {depth
            ? `${translate('copy.clinicalRecordCopy.followUp', language === 'el' ? 'el' : 'en')} ${depth} · `
            : ''}
          {type}
        </strong>
        <small>
          {fmtDate(sample.collectedAt || sample.requestedAt)}
          {sample.id ? ` · ${sample.id}` : ''}
        </small>
      </span>
      <span className="sv-sample-result">
        <StatusBadge tone={SAMPLE_TONES[tone]}>{status}</StatusBadge>
        {organism && <em className="sv-chip sv-chip-organism">{organism}</em>}
        {amr && (
          <em
            className={`sv-chip ${RESISTANCE_ALERT.has(String(amr).toUpperCase()) ? 'sv-chip-danger' : 'sv-chip-muted'}`}
          >
            {amr}
          </em>
        )}
      </span>
      <span className="sv-sample-actions">
        {linked ? null : isNegative ? (
          <em
            className="sample-negative-note"
            title={translate(
              'copy.clinicalRecordCopy.aNegativeResultCannotStartA',
              language === 'el' ? 'el' : 'en',
            )}
          >
            {translate(
              'copy.clinicalRecordCopy.negativeNoSurveillance',
              language === 'el' ? 'el' : 'en',
            )}
          </em>
        ) : canCreate && tone !== 'pending' ? (
          <Button
            className="sample-start-action"
            variant="secondary"
            onClick={() => onCreateFromSample?.(sample)}
          >
            <PlayCircle size={14} />
            {translate(
              'copy.clinicalRecordCopy.startSurveillance',
              language === 'el' ? 'el' : 'en',
            )}
          </Button>
        ) : null}
        {/* A follow-up repeats a sample that has its result, never one still awaited. */}
        {canCreateSample && tone !== 'pending' && (
          <Button
            className="sample-followup-action"
            variant="secondary"
            onClick={() => onFollowUp?.(sample)}
          >
            <RefreshCcw size={14} />
            {translate('copy.clinicalRecordCopy.followUp', language === 'el' ? 'el' : 'en')}
          </Button>
        )}
        {/* A sample the laboratory has not closed yet (no result): «⋯» with Edit (on its laboratory record) and Delete (owner, 8/11/2026). */}
        {tone === 'pending' && sampleMenu?.(sample).length > 0 && <OverflowMenu items={sampleMenu(sample)} />}
      </span>
    </div>
  )
}
