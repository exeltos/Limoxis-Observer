import { describe, expect, it } from 'vitest'
import { carriedDecisions, departmentMeetingStatus, latestMeetings, meetingAccess, newMeetingFor, nextMeetingCode, previousMonth } from '../src/features/quality/meetings/meetingModel'
import type { Meeting } from '../src/features/quality/meetings/meetingModel'

const meeting = (id, departmentId, meetingDate, decisions = [], extra = {}) => ({ id, code: id, departmentId, department: departmentId, meetingDate, nextMeetingDate: '', status: 'final', decisions, participants: [], ...extra }) as Meeting

describe('Department meetings', () => {
  it('numbers meetings within the department and reviews the month before', () => {
    expect(nextMeetingCode(['DM-2026-01', 'DM-2026-03', 'DM-2025-09'], 2026)).toBe('DM-2026-04')
    expect(nextMeetingCode([], 2027)).toBe('DM-2027-01')
    expect(previousMonth('2026-01-15')).toBe('2025-12-01')
  })

  it('carries the participants of the previous meeting (decisions are no longer carried: a follow-up is a corrective action)', () => {
    const previous = meeting('DM-1', 'ΜΕΘ', '2026-09-01', [{ title: 'Open', status: 'open' }, { title: 'Done', status: 'done' }], { participants: [{ name: 'A', role: 'Nurse', attended: false }] })
    const next = newMeetingFor({ id: 'ΜΕΘ', name: 'ΜΕΘ' }, [previous, meeting('X', 'ΤΕΠ', '2026-09-20', [{ title: 'Other', status: 'open' }])], '2026-10-05')
    expect(next.decisions).toEqual([])
    expect(next.participants).toEqual([{ name: 'A', role: 'Nurse', attended: true }])
    expect(next.periodMonth).toBe('2026-09-01')
    expect(carriedDecisions(null)).toEqual([])
  })

  it('counts open decisions on each department’s latest meeting only', () => {
    const rows = [meeting('a', 'ΜΕΘ', '2026-08-01', [{ title: 'x', status: 'open' }]), meeting('b', 'ΜΕΘ', '2026-09-01', [{ title: 'x', status: 'open', carriedFrom: 'a' }], { nextMeetingDate: '2026-10-01' }), meeting('c', 'ΤΕΠ', '2026-09-10')]
    expect(latestMeetings(rows).map(row => row.id).sort()).toEqual(['b', 'c'])
    expect(departmentMeetingStatus(rows, '2026-10-17').find(row => row.meeting.id === 'b').overdue).toBe(true)
  })

  it('lets a department see and write only its own meetings; Quality sees all', () => {
    const access = { seesAll: false, isMember: ({ departmentId }) => departmentId === 'ΜΕΘ' }
    const department = meetingAccess(access, false)
    expect(department.canSee(meeting('a', 'ΜΕΘ', '2026-09-01'))).toBe(true)
    expect(department.canSee(meeting('b', 'ΤΕΠ', '2026-09-01'))).toBe(false)
    expect(department.canWrite(meeting('a', 'ΜΕΘ', '2026-09-01', [], { status: 'draft' }))).toBe(true)
    // No draft / final: the department keeps writing its meetings.
    expect(department.canWrite(meeting('a', 'ΜΕΘ', '2026-09-01'))).toBe(true)
    expect(department.canWrite(meeting('b', 'ΤΕΠ', '2026-09-01'))).toBe(false)
    expect(department.canCreateCapa()).toBe(false)
    const quality = meetingAccess({ seesAll: true, isMember: () => false }, true)
    expect(quality.canSee(meeting('b', 'ΤΕΠ', '2026-09-01'))).toBe(true)
  })
})
