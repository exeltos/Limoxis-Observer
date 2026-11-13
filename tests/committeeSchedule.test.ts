import { describe, expect, it } from 'vitest'
import { committeeSchedule } from '../src/features/committees/committeeSchedule'

const TODAY = '2026-11-06'
describe('when a committee should meet next', () => {
  it('adds the frequency to the last meeting held', () => {
    expect(committeeSchedule({ status: 'active', meetingFrequency: 'quarterly', overview: { lastMeetingOn: '2026-04-30' } }, TODAY)).toMatchObject({ last: '2026-04-30', due: '2026-07-30', state: 'overdue' })
    expect(committeeSchedule({ status: 'active', meetingFrequency: 'monthly', overview: { lastMeetingOn: '2026-10-07' } }, TODAY)).toMatchObject({ due: '2026-11-07', state: 'soon' })
    expect(committeeSchedule({ status: 'active', meetingFrequency: 'annual', overview: { lastMeetingOn: '2026-05-13' } }, TODAY)).toMatchObject({ due: '2027-05-13', state: 'ok' })
  })
  it('takes a meeting already planned, and keeps «as needed» and inactive committees out', () => {
    expect(committeeSchedule({ status: 'active', meetingFrequency: 'quarterly', meetings: [{ date: '2026-04-01', status: 'finalized' }, { date: '2026-11-20', status: 'scheduled' }] }, TODAY)).toMatchObject({ last: '2026-04-01', planned: '2026-11-20', due: '2026-11-20', state: 'soon' })
    expect(committeeSchedule({ status: 'active', meetingFrequency: 'as_needed' }, TODAY).state).toBe('none')
    expect(committeeSchedule({ status: 'inactive', meetingFrequency: 'monthly', overview: { lastMeetingOn: '2025-01-01' } }, TODAY).state).toBe('none')
    expect(committeeSchedule({ status: 'active', meetingFrequency: 'quarterly' }, TODAY).state).toBe('overdue')
  })
})
