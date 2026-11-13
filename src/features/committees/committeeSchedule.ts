import { hospitalToday } from '../../core/dates/hospitalDate'
import type { Committee, CommitteeMeeting, CommitteeOverview } from './committeeTypes'
// What the schedule reads of a committee: its meetings (or the last one held, from the list counts) and its frequency.
type ScheduleSource = Pick<Committee, 'meetingFrequency' | 'status'> & { meetings?: Pick<CommitteeMeeting, 'status' | 'scheduledAt' | 'date'>[], overview?: Partial<CommitteeOverview> }
// When a committee should meet next (owner, 6/11/2026): its last meeting held plus its frequency, or the meeting
// already planned; overdue when that date has passed, soon within 30 days. Pure functions.
export const FREQUENCY_MONTHS: Record<string, number> = { monthly: 1, bimonthly: 2, quarterly: 3, semiannual: 6, annual: 12 }
export const SOON_DAYS = 30

const day = (value: unknown) => String(value || '').slice(0, 10)
const addMonths = (iso: string, months: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10)
}
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)

// { last, planned, due, days, state: 'overdue' | 'soon' | 'ok' | 'none' }
export function committeeSchedule(committee: ScheduleSource | null | undefined, today = hospitalToday()) {
  const meetings: string[] = (committee?.meetings || []).filter(item => item.status !== 'cancelled').map(item => day(item.scheduledAt || item.date)).filter(Boolean)
  const held = [committee?.overview?.lastMeetingOn, ...meetings.filter(date => date <= today)].filter(Boolean).sort()
  const last = held.at(-1) || ''
  const planned = meetings.filter(date => date > today).sort()[0] || ''
  const months = FREQUENCY_MONTHS[committee?.meetingFrequency ?? '']
  const due = planned || (last && months ? addMonths(last, months) : '')
  if (committee?.status && committee.status !== 'active') return { last, planned, due: '', days: null, state: 'none' }
  if (!due) return { last, planned, due: '', days: null, state: months && !last ? 'overdue' : 'none' }
  const days = daysBetween(today, due)
  return { last, planned, due, days, state: days < 0 ? 'overdue' : days <= SOON_DAYS ? 'soon' : 'ok' }
}
