// The protocol section of a surveillance episode (approved design n3-2): picker,
// recognition clock, timeline, the bundle steps with their timing, recording a
// step, changing the recognition time, completing / closing, and the history.
import { useEffect, useMemo, useState } from 'react'
import { Droplet, Droplets, FlaskConical, HeartPulse, History, Info, Pencil, Pill, Syringe, Timer, TriangleAlert } from 'lucide-react'
import { Button } from '../../../design-system/Button'
import { ObserverDialog, DialogActions } from '../../../design-system/ObserverDialog'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { TimeField } from '../../../design-system/TimeField'
import { SearchableSelect } from '../../../design-system/SearchableSelect'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { StagePanel } from '../ClinicalRecordViews'
import { CLINICAL_PROTOCOLS, HOUR_ONE_MINUTES, pendingSteps, protocolByKey, stepOf, visibleSteps } from './protocolCatalogue'
import { formatElapsed, minutesBetween, runSummary, timelineScale } from './protocolTiming'
import './protocols.css'

export const fill = (text, vars = {}) => String(text || '').replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? ''))
const STEP_ICONS = { lactate: FlaskConical, cultures: Droplets, antibiotic: Pill, fluids: Droplet, vasopressor: Syringe }
const pad = n => String(n).padStart(2, '0')
export const clockTime = value => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : `${pad(date.getHours())}:${pad(date.getMinutes())}`
}
export const dayTime = value => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : `${pad(date.getDate())}/${pad(date.getMonth() + 1)} · ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
const localDate = value => {
  const date = value ? new Date(value) : new Date()
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
const combine = (date, time) => {
  if (!date || !/^\d{2}:\d{2}$/.test(time || '')) return null
  const value = new Date(`${date}T${time}:00`)
  return Number.isNaN(value.getTime()) ? null : value.toISOString()
}
const numberValue = value => {
  const n = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// Re-renders every 30 seconds while a run is open, so the clock and the states move.
export function useNow(active = true) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!active) return undefined
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

const protocolText = (t, key, field) => t(`sepsis.protocols.${key}.${field}`)
const stepText = (t, key, field) => t(`sepsis.steps.${key}.${field}`)

// Picker: which protocol, time zero, trigger and weight.
export function ProtocolPickerDialog({ t, runs = [], preset = null, onClose, onStart }) {
  const open = runs.find(run => run.status === 'open')
  const [protocolKey, setProtocolKey] = useState(CLINICAL_PROTOCOLS[0].key)
  const [date, setDate] = useState(localDate(preset?.recognizedAt))
  const [time, setTime] = useState(clockTime(preset?.recognizedAt || new Date()))
  const [source, setSource] = useState(preset?.source || 'clinical')
  const [weight, setWeight] = useState('')
  const recognizedAt = combine(date, time)
  const sources = ['qsofa', 'sofa', 'clinical', 'other'].map(value => ({ value, label: t(`sepsis.source_${value}`) }))
  return (
    <ObserverDialog
      title={t('sepsis.startProtocol')}
      subtitle={t('sepsis.pickerSubtitle')}
      onClose={onClose}
      footer={
        <DialogActions
          disabled={Boolean(open) || !recognizedAt}
          saveLabel={t('sepsis.startProtocol')}
          onSave={() => onStart({ protocolKey, recognizedAt, recognitionSource: source, weightKg: numberValue(weight), triggerAssessmentId: preset?.assessmentId || null })}
        />
      }
    >
      <div className="sp-stack">
        {open && (
          <div className="sp-callout warn">
            <TriangleAlert size={16} />
            <div>{t('sepsis.alreadyOpen')}</div>
          </div>
        )}
        <div className="sp-picker" role="radiogroup" aria-label={t('sepsis.protocol')}>
          {CLINICAL_PROTOCOLS.map(protocol => (
            <button
              type="button"
              key={protocol.key}
              role="radio"
              aria-checked={protocolKey === protocol.key}
              className={`sp-option${protocolKey === protocol.key ? ' on' : ''}`}
              onClick={() => setProtocolKey(protocol.key)}
            >
              <strong>
                <span className="sp-radio" />
                <HeartPulse size={15} />
                {protocolText(t, protocol.key, 'name')}
              </strong>
              {protocolText(t, protocol.key, 'description')}
            </button>
          ))}
        </div>
        <div className="sp-form-grid">
          <ManualDateField label={t('sepsis.recognizedDate')} value={date} onChange={setDate} />
          <TimeField label={t('sepsis.recognizedTime')} value={time} onChange={setTime} required />
          <SearchableSelect label={t('sepsis.recognitionSource')} value={source} options={sources} onChange={setSource} />
          <label className="field">
            <span className="field-label lo-field-label">{t('sepsis.weightKg')}</span>
            <input type="number" min="1" max="499" step="0.1" inputMode="decimal" value={weight} onChange={event => setWeight(event.target.value)} />
            <span className="field-hint">{t('sepsis.weightHint')}</span>
          </label>
          <p className="span2 sp-muted sp-small">{t('sepsis.recognitionHint')}</p>
        </div>
        <Disclaimer t={t} />
      </div>
    </ObserverDialog>
  )
}

function Disclaimer({ t }) {
  return (
    <div className="sp-callout">
      <Info size={16} />
      <div>
        <strong>{t('sepsis.disclaimerTitle')}</strong> {t('sepsis.disclaimer')}
      </div>
    </div>
  )
}

const STATE_KEY = code => `sepsis.state_${code}`

// The section of a started protocol.
export function ProtocolPanel({ run, record, t, language, canRecord, onRecordStep, onChangeTime, onFinish }) {
  const open = run.status === 'open'
  const now = useNow(open)
  const [stepDialog, setStepDialog] = useState(null)
  const [timeDialog, setTimeDialog] = useState(false)
  const [closeDialog, setCloseDialog] = useState(false)
  const summary = useMemo(() => runSummary(run, now), [run, now])
  const scale = timelineScale(run, now)
  const protocol = protocolByKey(run.protocolKey)
  const pending = pendingSteps(run)
  const editable = canRecord && open
  let number = 0
  const numbered = summary.steps.map(item => ({ ...item, number: item.step.followUp ? null : ++number }))
  return (
    <StagePanel
      icon={Timer}
      title={protocolText(t, run.protocolKey, 'panelTitle')}
      action={
        editable ? (
          <Button className="clinical-stage-action" variant="secondary" onClick={() => setStepDialog({ key: pending[0]?.key || visibleSteps(run)[0]?.key, choose: true })}>
            {t('sepsis.recordStep')}
          </Button>
        ) : (
          <StatusBadge tone={run.status === 'completed' ? 'success' : run.status === 'closed' ? 'neutral' : 'info'}>{t(`sepsis.status_${run.status}`)}</StatusBadge>
        )
      }
    >
      <div className="sp-stack">
        {protocol?.emphasis && (
          <div className="sp-callout warn">
            <TriangleAlert size={16} />
            <div>{t('sepsis.shockEmphasis')}</div>
          </div>
        )}
        <div className="sp-clock">
          <div>
            <small>{t('sepsis.recognizedAt')}</small>
            <span className="sp-big">{dayTime(run.recognizedAt)}</span>
          </div>
          <div>
            <small>{t('sepsis.recognizedBy')}</small>
            <strong>{[language === 'en' ? record?.departmentEn || record?.department : record?.department, run.startedByName].filter(Boolean).join(' · ') || '—'}</strong>
          </div>
          <span className="sp-grow" />
          <div className="sp-clock-end">
            <small>{open ? fill(t('sepsis.nowElapsed'), { time: clockTime(now) }) : t('sepsis.totalDuration')}</small>
            <span className="sp-big">{formatElapsed(summary.elapsed, language)}</span>
          </div>
          {editable && (
            <Button variant="secondary" onClick={() => setTimeDialog(true)}>
              <Pencil size={15} />
              {t('sepsis.changeTime')}
            </Button>
          )}
        </div>
        <ProtocolTimeline t={t} language={language} run={run} items={numbered} scale={scale} now={now} />
        <div className="sp-bundle">
          {numbered.map(item => (
            <BundleStep key={item.step.key} item={item} run={run} t={t} language={language} editable={editable} onOpen={() => setStepDialog({ key: item.step.key })} />
          ))}
        </div>
        <Disclaimer t={t} />
        <details className="sp-card">
          <summary className="sp-row sp-small sp-muted">
            <History size={14} />
            {t('sepsis.history')} · {t('sepsis.auditNote')}
          </summary>
          <ul className="sp-history">
            {(run.events || []).map((event, index) => (
              <li key={event.id || index}>
                <span>{dayTime(event.at)}</span>
                <strong>{t(`sepsis.event_${event.type}`)}</strong>
                {event.stepKey && <span>{stepText(t, event.stepKey, 'title')}</span>}
                {event.type === 'recognition_changed' && event.detail?.from && <span>{dayTime(event.detail.from)} → {dayTime(event.detail.to)}</span>}
                {event.reason && <span>«{event.reason}»</span>}
                <span>{event.actorName || '—'}</span>
              </li>
            ))}
          </ul>
        </details>
        {editable && (
          <div className="sp-footer-actions">
            {pending.length > 0 && <span className="sp-muted sp-small sp-grow">{t('sepsis.completeBlocked')}</span>}
            <Button variant="secondary" onClick={() => setCloseDialog(true)}>
              {t('sepsis.close')}
            </Button>
            <Button disabled={pending.length > 0} onClick={() => onFinish({ status: 'completed' })}>
              {t('sepsis.complete')}
            </Button>
          </div>
        )}
      </div>
      {stepDialog && (
        <StepDialog
          t={t}
          run={run}
          record={record}
          initialKey={stepDialog.key}
          choose={stepDialog.choose}
          onClose={() => setStepDialog(null)}
          onSave={async draft => {
            if ((await onRecordStep(draft)) !== false) setStepDialog(null)
          }}
        />
      )}
      {timeDialog && (
        <ChangeTimeDialog
          t={t}
          run={run}
          onClose={() => setTimeDialog(false)}
          onSave={async draft => {
            if ((await onChangeTime(draft)) !== false) setTimeDialog(false)
          }}
        />
      )}
      {closeDialog && (
        <ReasonOnlyDialog
          t={t}
          title={t('sepsis.close')}
          label={t('sepsis.closeReason')}
          hint={t('sepsis.closeHint')}
          onClose={() => setCloseDialog(false)}
          onSave={async reason => {
            if ((await onFinish({ status: 'closed', reason })) !== false) setCloseDialog(false)
          }}
        />
      )}
    </StagePanel>
  )
}

function ProtocolTimeline({ t, language, run, items, scale, now }) {
  const hour = (HOUR_ONE_MINUTES / scale) * 100
  const ticks = []
  const every = scale <= 90 ? 15 : 30
  for (let minute = 0; minute <= scale; minute += every) ticks.push(minute)
  const elapsed = minutesBetween(run.recognizedAt, run.status === 'open' ? now : run.completedAt || now)
  const markers = items
    .filter(item => item.state.tone !== 'n' || item.recorded?.status === 'done')
    .map(item => {
      const minute = item.recorded?.status === 'done' ? minutesBetween(run.recognizedAt, item.recorded.doneAt) : item.step.followUp ? null : elapsed
      return minute == null ? null : { key: item.step.key, tone: item.state.tone, label: item.number ?? '', left: Math.max(0, Math.min(100, (minute / scale) * 100)) }
    })
    .filter(Boolean)
  const mark = language === 'en' ? '′' : '΄'
  return (
    <div className="sp-card sp-timeline-card">
      <div className="sp-row">
        <span className="sp-eyebrow">{t('sepsis.timelineTitle')}</span>
        <span className="sp-grow" />
        <div className="sp-legend">
          <span><i className="g" />{t('sepsis.legendDone')}</span>
          <span><i className="a" />{t('sepsis.legendPending')}</span>
          <span><i className="r" />{t('sepsis.legendLate')}</span>
          <span><i className="n" />{t('sepsis.legendScheduled')}</span>
        </div>
      </div>
      <div className="sp-timeline" aria-hidden="true">
        <div className="axis" style={{ background: `linear-gradient(90deg,#d9efe2 0,#d9efe2 ${hour}%,#f9e0e0 ${hour}%)` }} />
        <div className="hour" style={{ left: `${hour}%` }} />
        {ticks.map(minute => (
          <span key={minute} className="tick" style={{ left: `${(minute / scale) * 100}%` }}>
            {minute}
            {mark}
          </span>
        ))}
        {markers.map(marker => (
          <span key={marker.key} className={`mk ${marker.tone}`} style={{ left: `${marker.left}%` }}>
            {marker.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function BundleStep({ item, run, t, language, editable, onOpen }) {
  const { step, recorded, state, number } = item
  const Icon = STEP_ICONS[step.icon] || FlaskConical
  const title = `${number ? `${number} · ` : ''}${stepText(t, step.key, 'title')}`
  const mark = language === 'en' ? '′' : '΄'
  let hint = stepText(t, step.key, 'hint')
  if (step.mlPerKg) {
    const volume = run.weightKg ? Math.round(run.weightKg * step.mlPerKg) : null
    hint = `${hint} · ${volume ? fill(t('sepsis.fluidsTarget'), { weight: run.weightKg, volume: volume.toLocaleString(language === 'en' ? 'en-GB' : 'el-GR') }) : t('sepsis.fluidsNoWeight')}`
  }
  if (step.followUp) {
    const lactate = stepOf(run, 'lactate')?.value
    if (lactate) hint = `${hint} · ${String(lactate).replace('.', language === 'en' ? '.' : ',')} mmol/L`
  }
  let when
  let detail
  if (recorded?.status === 'done') {
    const minutes = minutesBetween(run.recognizedAt, recorded.doneAt)
    when = (
      <>
        <b>{clockTime(recorded.doneAt)}</b>
        {minutes != null ? `${minutes >= 0 ? '+' : ''}${minutes}${mark}` : ''}
      </>
    )
    let extra = t(STATE_KEY(state.code))
    if (step.key === 'lactate' && (numberValue(recorded.value) ?? 0) >= 4) extra = t('sepsis.lactateTriggersFluids')
    if (step.beforeStep) {
      const other = stepOf(run, step.beforeStep)
      const gap = other?.status === 'done' ? minutesBetween(recorded.doneAt, other.doneAt) : null
      if (gap != null && gap >= 0) extra = `${fill(t('sepsis.beforeAntibiotic'), { minutes: gap })} ✓`
    }
    detail = (
      <>
        <b>{step.kind === 'number' && recorded.value ? `${String(recorded.value).replace('.', language === 'en' ? '.' : ',')} ${step.unit}` : recorded.value || '—'}</b>
        <small>{extra}</small>
      </>
    )
  } else if (recorded?.status === 'not_indicated') {
    when = <b>{t('sepsis.stepNotIndicated')}</b>
    detail = (
      <>
        <b>—</b>
        <small>{recorded.notIndicatedReason}</small>
      </>
    )
  } else if (step.followUp) {
    when = (
      <>
        <b>{state.dueBy ? fill(t('sepsis.dueBy'), { time: clockTime(state.dueBy) }) : '—'}</b>
        {t('sepsis.fromLactate')}
      </>
    )
    detail = (
      <>
        <b>—</b>
        <small>{t(STATE_KEY(state.code))}</small>
      </>
    )
  } else {
    const elapsed = minutesBetween(run.recognizedAt, run.status === 'open' ? new Date() : run.completedAt)
    when = (
      <>
        <b>{t('sepsis.notStarted')}</b>
        {t(STATE_KEY(state.code))}
      </>
    )
    detail = (
      <>
        <b>{elapsed != null ? `+${elapsed}${mark}` : '—'}</b>
        <small>{recorded?.recordedByName || ''}</small>
      </>
    )
  }
  const content = (
    <>
      <span className={`sp-ico ${state.tone}`}>
        <Icon size={16} />
      </span>
      <div>
        <strong>{title}</strong>
        <small>{hint}</small>
      </div>
      <div className="sp-num">{when}</div>
      <div className="sp-num">{detail}</div>
    </>
  )
  const className = `sp-bundle-item ${state.tone}${step.emphasis ? ' emphasis' : ''}`
  const label = [title, t(STATE_KEY(state.code)), recorded?.recordedByName].filter(Boolean).join(' · ')
  return editable ? (
    <button type="button" className={className} onClick={onOpen} title={label} aria-label={label}>
      {content}
    </button>
  ) : (
    <div className={className} title={label}>
      {content}
    </div>
  )
}

function StepDialog({ t, run, record, initialKey, choose, onClose, onSave }) {
  const steps = visibleSteps(run)
  const [key, setKey] = useState(initialKey || steps[0]?.key)
  const step = steps.find(item => item.key === key) || steps[0]
  const recorded = stepOf(run, step?.key)
  const [status, setStatus] = useState(recorded?.status && recorded.status !== 'pending' ? recorded.status : 'done')
  const [date, setDate] = useState(localDate(recorded?.doneAt))
  const [time, setTime] = useState(clockTime(recorded?.doneAt || new Date()))
  const [value, setValue] = useState(recorded?.value || '')
  const [reason, setReason] = useState(recorded?.notIndicatedReason || '')
  const [therapyId, setTherapyId] = useState(recorded?.therapyId || '')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const next = stepOf(run, key)
    setStatus(next?.status && next.status !== 'pending' ? next.status : 'done')
    setValue(next?.value || '')
    setReason(next?.notIndicatedReason || '')
    setTherapyId(next?.therapyId || '')
    setDate(localDate(next?.doneAt))
    setTime(clockTime(next?.doneAt || new Date()))
  }, [key, run])
  if (!step) return null
  const doneAt = combine(date, time)
  const valid = status === 'pending' || (status === 'done' ? Boolean(doneAt) : reason.trim().length > 0)
  const statuses = [
    { value: 'done', label: t('sepsis.stepDone') },
    ...(step.canSkip ? [{ value: 'not_indicated', label: t('sepsis.stepNotIndicated') }] : []),
    ...(recorded && recorded.status !== 'pending' ? [{ value: 'pending', label: t('sepsis.stepPending') }] : []),
  ]
  const therapies = (record?.therapy || []).map(item => ({ value: item.id, label: [item.antimicrobial, item.dose, item.route].filter(Boolean).join(' · ') }))
  async function save() {
    if (!valid || busy) return
    setBusy(true)
    try {
      await onSave({ key: step.key, status, doneAt, value: value.trim(), notIndicatedReason: reason.trim(), therapyId: therapyId || null })
    } finally {
      setBusy(false)
    }
  }
  return (
    <ObserverDialog
      title={t('sepsis.recordStep')}
      subtitle={stepText(t, step.key, 'title')}
      onClose={onClose}
      footer={<DialogActions disabled={!valid || busy} onSave={save} />}
    >
      <div className="sp-stack">
        {choose && <SearchableSelect label={t('sepsis.chooseStep')} value={step.key} options={steps.map(item => ({ value: item.key, label: stepText(t, item.key, 'title') }))} onChange={next => next && setKey(next)} />}
        <p className="sp-muted sp-small">{stepText(t, step.key, 'hint')}</p>
        <div className="sp-picker" role="radiogroup" aria-label={t('sepsis.stepStatus')}>
          {statuses.map(option => (
            <button type="button" key={option.value} role="radio" aria-checked={status === option.value} className={`sp-option${status === option.value ? ' on' : ''}`} onClick={() => setStatus(option.value)}>
              <strong>
                <span className="sp-radio" />
                {option.label}
              </strong>
            </button>
          ))}
        </div>
        {status === 'done' && (
          <div className="sp-form-grid">
            <ManualDateField label={t('sepsis.doneDate')} value={date} onChange={setDate} />
            <TimeField label={t('sepsis.doneTime')} value={time} onChange={setTime} required />
            <label className="field span2">
              <span className="field-label lo-field-label">{step.kind === 'number' ? t('sepsis.valueLactate') : t('sepsis.value')}</span>
              <input type={step.kind === 'number' ? 'number' : 'text'} step="0.1" min="0" inputMode={step.kind === 'number' ? 'decimal' : undefined} value={value} onChange={event => setValue(event.target.value)} />
            </label>
            {step.linksTherapy && therapies.length > 0 && (
              <div className="span2">
                <SearchableSelect label={t('sepsis.linkTherapy')} value={therapyId} options={therapies} onChange={next => setTherapyId(next || '')} clearLabel={t('sepsis.noTherapyLink')} />
              </div>
            )}
          </div>
        )}
        {status === 'not_indicated' && (
          <label className="field">
            <span className="field-label lo-field-label">{t('sepsis.notIndicatedReason')} *</span>
            <textarea rows={3} value={reason} onChange={event => setReason(event.target.value)} />
          </label>
        )}
      </div>
    </ObserverDialog>
  )
}

function ChangeTimeDialog({ t, run, onClose, onSave }) {
  const [date, setDate] = useState(localDate(run.recognizedAt))
  const [time, setTime] = useState(clockTime(run.recognizedAt))
  const [weight, setWeight] = useState(run.weightKg ?? '')
  const [reason, setReason] = useState('')
  const recognizedAt = combine(date, time)
  const changedTime = recognizedAt && new Date(recognizedAt).getTime() !== new Date(run.recognizedAt).getTime()
  const nextWeight = numberValue(weight)
  const changedWeight = String(nextWeight ?? '') !== String(run.weightKg ?? '')
  const valid = (changedTime ? reason.trim().length > 0 : true) && (changedTime || changedWeight)
  return (
    <ObserverDialog
      title={t('sepsis.changeTimeTitle')}
      subtitle={t('sepsis.changeReasonHint')}
      onClose={onClose}
      footer={<DialogActions disabled={!valid} onSave={() => onSave({ recognizedAt: changedTime ? recognizedAt : null, reason: reason.trim(), weightKg: changedWeight ? nextWeight : undefined })} />}
    >
      <div className="sp-form-grid">
        <ManualDateField label={t('sepsis.recognizedDate')} value={date} onChange={setDate} />
        <TimeField label={t('sepsis.recognizedTime')} value={time} onChange={setTime} required />
        <label className="field span2">
          <span className="field-label lo-field-label">{t('sepsis.changeReason')}{changedTime ? ' *' : ''}</span>
          <textarea rows={3} value={reason} onChange={event => setReason(event.target.value)} />
        </label>
        <label className="field span2">
          <span className="field-label lo-field-label">{t('sepsis.weightKg')}</span>
          <input type="number" min="1" max="499" step="0.1" inputMode="decimal" value={weight} onChange={event => setWeight(event.target.value)} />
          <span className="field-hint">{t('sepsis.weightHint')}</span>
        </label>
      </div>
    </ObserverDialog>
  )
}

function ReasonOnlyDialog({ title, label, hint, onClose, onSave }) {
  const [reason, setReason] = useState('')
  return (
    <ObserverDialog title={title} subtitle={hint} onClose={onClose} footer={<DialogActions disabled={!reason.trim()} saveLabel={title} onSave={() => onSave(reason.trim())} />}>
      <label className="field">
        <span className="field-label lo-field-label">{label} *</span>
        <textarea rows={3} value={reason} onChange={event => setReason(event.target.value)} />
      </label>
    </ObserverDialog>
  )
}

// «Σήψη · Hour-1 72΄» while a protocol is open (surveillance list, episode tree).
export function ProtocolBadge({ entry, t, language, now = new Date() }) {
  if (!entry) return null
  const minutes = minutesBetween(entry.recognizedAt, now)
  const tone = minutes != null && minutes > HOUR_ONE_MINUTES ? 'r' : 'a'
  const label = `${t('sepsis.badge')} · ${protocolText(t, entry.protocolKey, 'short')}${minutes != null ? ` ${minutes}${language === 'en' ? '′' : '΄'}` : ''}`
  return (
    <span className={`sp-ward-badge ${tone}`} title={protocolText(t, entry.protocolKey, 'name')}>
      <HeartPulse size={11} aria-hidden="true" />
      {label}
    </span>
  )
}
