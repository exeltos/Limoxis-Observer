// Timing of a protocol run relative to its recognition time (time zero).
// Every state is computed from what was recorded; nothing is inferred.
//   g  green  done within the hour (or within its own window)
//   a  amber  not done yet, still within the hour
//   r  red    not done after the hour, done late, or cultures after the antibiotic
//   n  grey   not indicated (with a reason), or a follow-up not due yet
import { HOUR_ONE_MINUTES, stepOf, visibleSteps } from './protocolCatalogue'

const ms = value => {
  if (!value) return NaN
  return new Date(value).getTime()
}
export const minutesBetween = (from, to) => (Number.isFinite(ms(from)) && Number.isFinite(ms(to)) ? Math.round((ms(to) - ms(from)) / 60000) : null)

export function stepState(run, step, now = new Date()) {
  const recorded = stepOf(run, step.key)
  const zero = run?.recognizedAt
  const elapsed = minutesBetween(zero, now)
  if (recorded?.status === 'not_indicated') return { tone: 'n', code: 'notIndicated', minutes: null }
  if (step.followUp) {
    const [from, to] = step.windowMinutes || [0, HOUR_ONE_MINUTES]
    const base = stepOf(run, 'lactate')?.doneAt || zero
    if (recorded?.status === 'done') {
      const at = minutesBetween(base, recorded.doneAt)
      return { tone: at != null && at <= to ? 'g' : 'r', code: at != null && at <= to ? 'doneInWindow' : 'doneLate', minutes: minutesBetween(zero, recorded.doneAt) }
    }
    const since = minutesBetween(base, now)
    return { tone: since != null && since > to ? 'r' : 'n', code: since != null && since > to ? 'overdue' : 'scheduled', minutes: null, dueFrom: base ? new Date(ms(base) + from * 60000).toISOString() : null, dueBy: base ? new Date(ms(base) + to * 60000).toISOString() : null }
  }
  if (recorded?.status === 'done') {
    const at = minutesBetween(zero, recorded.doneAt)
    if (step.beforeStep) {
      const other = stepOf(run, step.beforeStep)
      if (other?.status === 'done' && ms(recorded.doneAt) > ms(other.doneAt)) return { tone: 'r', code: 'afterDependency', minutes: at }
    }
    if (at != null && at <= HOUR_ONE_MINUTES) return { tone: 'g', code: 'doneOnTime', minutes: at }
    return { tone: 'r', code: 'doneLate', minutes: at }
  }
  if (run?.status && run.status !== 'open') return { tone: 'r', code: 'notDone', minutes: null }
  if (elapsed != null && elapsed <= HOUR_ONE_MINUTES) return { tone: 'a', code: 'pending', minutes: null }
  return { tone: 'r', code: 'overdue', minutes: null }
}

export function runSummary(run, now = new Date()) {
  const steps = visibleSteps(run).map(step => ({ step, recorded: stepOf(run, step.key), state: stepState(run, step, now) }))
  const main = steps.filter(item => !item.step.followUp)
  const elapsed = minutesBetween(run?.recognizedAt, run?.status === 'open' ? now : run?.completedAt || now)
  const late = main.filter(item => item.state.tone === 'r')
  const pending = main.filter(item => !['done', 'not_indicated'].includes(item.recorded?.status))
  const onTime = main.every(item => ['g', 'n'].includes(item.state.tone))
  return { steps, elapsed, late, pending, onTime, tone: run?.status === 'open' ? (late.length ? 'r' : pending.length ? 'a' : 'g') : onTime ? 'g' : 'r' }
}

// "1 ώρα 12΄" / "1 h 12′"
export function formatElapsed(minutes, language = 'el') {
  if (minutes == null || !Number.isFinite(minutes)) return '—'
  const sign = minutes < 0 ? '−' : ''
  const value = Math.abs(minutes)
  const hours = Math.floor(value / 60)
  const rest = value % 60
  const mark = language === 'en' ? '′' : '΄'
  if (!hours) return `${sign}${rest}${mark}`
  const unit = language === 'en' ? 'h' : hours === 1 ? 'ώρα' : 'ώρες'
  return `${sign}${hours} ${unit}${rest ? ` ${rest}${mark}` : ''}`
}

// Timeline scale: 0–90 minutes, widened in steps of 30 minutes once the run
// goes past it (at most 6 hours).
export function timelineScale(run, now = new Date()) {
  const steps = visibleSteps(run)
  const doneMinutes = steps.map(step => minutesBetween(run?.recognizedAt, stepOf(run, step.key)?.doneAt)).filter(value => value != null)
  const elapsed = minutesBetween(run?.recognizedAt, run?.status === 'open' ? now : run?.completedAt || now) || 0
  const top = Math.max(90, elapsed, ...doneMinutes)
  return Math.min(360, Math.ceil(top / 30) * 30)
}
