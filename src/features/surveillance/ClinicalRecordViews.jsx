import { HistoryTimeline } from '../../design-system/HistoryTimeline'
import { RegistryTable } from '../../design-system/RegistryTable'
import { StatusBadge } from '../../design-system/StatusBadge'
import { sampleTone } from './patientRecordScope'
import {
  Activity,
  AlertTriangle,
  BedDouble,
  FileClock,
  Microscope,
  Pill,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react'
import { translate } from '../../core/i18n/LanguageContext'
import {
  RESISTANCE_ALERT,
  episodeTypeLabel,
  clinicalTerm,
  libraryLabel,
  clinicalValueLabel,
  timelineLabel,
  ISOLATION_STATUS,
  termLabel,
} from './clinicalRecordLabels'

// Read-only views of the clinical record: the timeline and the
// final report of a completed episode.

// A sample's result as a status-badge tone (sampleTone: positive / negative / pending).
export const SAMPLE_TONES = { positive: 'danger', negative: 'success', pending: 'warning' }

export function StagePanel({ icon: Icon, title, action, children }) {
  return (
    <section className="clinical-panel full-panel">
      <div className="record-section-header">
        <div>
          {Icon && <Icon size={17} />}
          <strong>{title}</strong>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
export function TagList({ title, items = [], rows = [], t, language }) {
  if (!items?.length) return null
  return (
    <>
      <span className="lo-field-label tag-list-label">{title}</span>
      <div className="tag-row">
        {items.map(x => (
          <span className="clinical-tag" key={x}>
            {libraryLabel(x, rows, language, t)}
          </span>
        ))}
      </div>
    </>
  )
}
// `title`/`subtitle` replace the surveillance heading (an admission without surveillance).
export function Timeline({ record, t, language, fmtDateTime, title, subtitle }) {
  const tr = key => translate(`copy.clinicalRecordCopy.${key}`, language === 'el' ? 'el' : 'en')
  const events = [...(record?.timeline || [])]
    .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
    // One line says what happened ("Reassessment: clinical improvement"), the next who and which sample.
    .map(x => ({
      at: x.at,
      title: [timelineLabel(x.type, language, t), x.detail ? clinicalValueLabel(x.detail, language, t) : ''].filter(Boolean).join(': '),
      detail: null,
      meta: [x.actor || x.actorId, x.sampleId && `${tr('sample')}: ${x.sampleId}`],
    }))
  return (
    <HistoryTimeline
      title={title || tr('surveillanceHistory')}
      subtitle={subtitle || tr('chronologicalAuditTrailOfClinicalActions')}
      events={events}
      when={fmtDateTime}
      emptyText={tr('noRecordedEventsYet')}
    />
  )
}
export function CompletedReport({
  record,
  t,
  fmtDate,
  fmtDateTime,
  language = 'el',
  libraries = {},
}) {
  const el = language !== 'en'
  const samples = record.samples || [],
    positive = samples.filter(x => x.result === 'positive'),
    therapy = record.therapy || [],
    reassessments = record.reassessments || []
  const organism = positive.find(x => x.organism)?.organism || record.organism || '',
    resistance = record.resistance || positive.find(x => x.resistance)?.resistance || ''
  const start = record.startedAt,
    end = record.completedAt || record.outcome?.date
  const days =
    start && end
      ? Math.max(
          1,
          Math.round(
            (new Date(String(end).slice(0, 10)) - new Date(String(start).slice(0, 10))) / 86400000,
          ) + 1,
        )
      : null
  const hai = record.haiClassification,
    iso = record.isolation
  const Section = ({ icon: Icon, title, children, wide = false }) => (
    <section className={`final-report-card${wide ? ' wide' : ''}`}>
      <header>
        <span className="final-report-card-icon">
          <Icon size={16} />
        </span>
        <h3>{title}</h3>
      </header>
      {children}
    </section>
  )
  const Empty = ({ text }) => <p className="final-report-empty">{text}</p>
  return (
    <article className="surveillance-final-report final-report-v2">
      <header className="final-report-hero">
        <div>
          <span className="eyebrow">{t('clinicalRecords.finalSurveillanceReport')}</span>
          <h2>{episodeTypeLabel(record, t) || record.patient}</h2>
          <p>
            {record.patient} · {record.department || '—'} · {record.id}
          </p>
        </div>
        <div className="final-report-hero-facts">
          <div>
            <small>{t('finalReport.period')}</small>
            <strong>
              {fmtDate(start)} → {fmtDate(end)}
            </strong>
          </div>
          <div>
            <small>{t('finalReport.duration')}</small>
            <strong>
              {days ? `${days} ${t(days === 1 ? 'finalReport.day' : 'finalReport.days')}` : '—'}
            </strong>
          </div>
          <div>
            <small>{t('outcome')}</small>
            <strong>{record.outcome ? termLabel(record.outcome.status, t, language) : '—'}</strong>
          </div>
          <div>
            <small>{t('finalReport.finding')}</small>
            <strong className="final-report-chips">
              {organism ? <em className="sv-chip sv-chip-organism">{organism}</em> : '—'}
              {resistance && (
                <em
                  className={`sv-chip ${RESISTANCE_ALERT.has(String(resistance).toUpperCase()) ? 'sv-chip-danger' : 'sv-chip-muted'}`}
                >
                  {resistance}
                </em>
              )}
            </strong>
          </div>
        </div>
      </header>
      <div className="final-report-grid">
        <Section icon={ShieldCheck} title={t('clinicalAssessment')}>
          {record.assessment ? (
            <>
              <div className="final-report-facts">
                <div>
                  <small>{t('assessmentDate')}</small>
                  <strong>{fmtDate(record.assessment.date)}</strong>
                </div>
                <div>
                  <small>{t('classification')}</small>
                  <strong>
                    {clinicalTerm(record.assessment.classification || 'undetermined', language, t)}
                  </strong>
                </div>
              </div>
              {(record.assessment.summary || record.assessment.notes) && (
                <p>
                  {el
                    ? record.assessment.summary || record.assessment.notes
                    : record.assessment.summaryEn ||
                      record.assessment.summary ||
                      record.assessment.notes}
                </p>
              )}
              <TagList
                title={t('signsSymptoms')}
                items={record.assessment.signsSymptoms || record.assessment.symptoms}
                rows={libraries.clinicalSymptoms || []}
                t={t}
                language={language}
              />
              <TagList
                title={t('riskFactors')}
                items={record.assessment.riskFactors}
                rows={libraries.clinicalRiskFactors || []}
                t={t}
                language={language}
              />
            </>
          ) : (
            <Empty text={t('clinicalRecords.notDocumented')} />
          )}
        </Section>
        <Section icon={AlertTriangle} title={t('haiAmr')}>
          {hai ? (
            <>
              <div className="final-report-facts">
                <div>
                  <small>{t('finalReport.infectionType')}</small>
                  <strong>{termLabel(hai.type, t, language)}</strong>
                </div>
                <div>
                  <small>{t('status')}</small>
                  <strong>{termLabel(hai.status, t, language)}</strong>
                </div>
                <div>
                  <small>{t('finalReport.criteria')}</small>
                  <strong>
                    {hai.criteriaMet
                      ? t('finalReport.criteriaMet')
                      : t('finalReport.criteriaNotMet')}
                  </strong>
                </div>
              </div>
              {hai.definitionSet && (
                <small className="final-report-note">{hai.definitionSet}</small>
              )}
              {(hai.rationale || hai.rationaleEn) && (
                <p>{el ? hai.rationale : hai.rationaleEn || hai.rationale}</p>
              )}
            </>
          ) : (
            <Empty text={t('clinicalRecords.notDocumented')} />
          )}
        </Section>
        <Section icon={Microscope} title={t('microbiology')} wide>
          {samples.length ? (
            <RegistryTable
              className="final-report-table"
              wrapperClassName="scroll-table final-report-table-wrap"
              columns={[
                { key: 'date', label: t('date') },
                { key: 'type', label: t('sampleType') },
                { key: 'result', label: t('finalReport.result') },
                { key: 'organism', label: t('organism') },
                { key: 'resistance', label: t('finalReport.resistance') },
              ]}
              rows={samples}
              renderRow={x => (
                <>
                  <td>{fmtDate(x.collectedAt || x.requestedAt)}</td>
                  <td>{termLabel(x.type, t, language)}</td>
                  <td>
                    <StatusBadge tone={SAMPLE_TONES[sampleTone(x)]}>
                      {termLabel(x.result || x.status || 'pending', t, language)}
                    </StatusBadge>
                  </td>
                  <td>{x.organism || '—'}</td>
                  <td>{x.resistance || '—'}</td>
                </>
              )}
            />
          ) : (
            <Empty text={t('clinicalRecords.noPositiveFindings')} />
          )}
        </Section>
        <Section icon={Pill} title={t('therapy')}>
          {therapy.length ? (
            <ul className="final-report-list">
              {therapy.map(x => (
                <li key={x.id}>
                  <strong>{x.antimicrobial}</strong>
                  <span>{[x.dose, x.route].filter(Boolean).join(' · ') || '—'}</span>
                  <small>
                    {fmtDate(x.startedAt)}
                    {x.plannedEnd || x.endedAt ? ` → ${fmtDate(x.endedAt || x.plannedEnd)}` : ''}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text={t('clinicalRecords.noTherapyRecorded')} />
          )}
        </Section>
        <Section icon={BedDouble} title={t('isolation')}>
          {iso ? (
            <div className="final-report-facts">
              <div>
                <small>{t('status')}</small>
                <strong>
                  {ISOLATION_STATUS[iso.status]
                    ? t(ISOLATION_STATUS[iso.status])
                    : termLabel(iso.status, t, language)}
                </strong>
              </div>
              <div>
                <small>{t('startDate')}</small>
                <strong>{fmtDate(iso.startedAt)}</strong>
              </div>
              <div>
                <small>{t('finalReport.end')}</small>
                <strong>{fmtDate(iso.endedAt)}</strong>
              </div>
              {iso.reason && (
                <div>
                  <small>{t('reason')}</small>
                  <strong>{iso.reason}</strong>
                </div>
              )}
            </div>
          ) : (
            <Empty
              text={
                record.isolationDecision?.required === false
                  ? t('notRequired')
                  : t('clinicalRecords.noIsolationRecorded')
              }
            />
          )}
        </Section>
        <Section icon={RefreshCcw} title={t('reassessment')}>
          {reassessments.length ? (
            <ul className="final-report-list">
              {reassessments.map(x => (
                <li key={x.id || x.date}>
                  <strong>{termLabel(x.status, t, language)}</strong>
                  <span>{x.notes || '—'}</span>
                  <small>{fmtDate(x.date)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text={t('clinicalRecords.noReassessmentRecorded')} />
          )}
        </Section>
        <Section icon={Activity} title={t('outcome')}>
          {record.outcome ? (
            <>
              <div className="final-report-facts">
                <div>
                  <small>{t('status')}</small>
                  <strong>{termLabel(record.outcome.status, t, language)}</strong>
                </div>
                <div>
                  <small>{t('date')}</small>
                  <strong>{fmtDate(record.outcome.date)}</strong>
                </div>
              </div>
              {record.outcome.notes && (
                <p>{el ? record.outcome.notes : record.outcome.notesEn || record.outcome.notes}</p>
              )}
            </>
          ) : (
            <Empty text={t('clinicalRecords.notDocumented')} />
          )}
        </Section>
        <Section icon={FileClock} title={t('clinicalRecords.courseSummary')} wide>
          {(record.timeline || []).length ? (
            <div className="course-timeline">
              {record.timeline.map((x, i) => (
                <div key={`${x.at}-${i}`} className="course-event">
                  <time>{fmtDateTime(x.at)}</time>
                  <span>{termLabel(x.type, t, language)}</span>
                  <strong>{x.actor || x.actorId || '—'}</strong>
                  <p>{x.detail || '—'}</p>
                </div>
              ))}
            </div>
          ) : (
            <Empty text={t('finalReport.noEvents')} />
          )}
        </Section>
      </div>
    </article>
  )
}
