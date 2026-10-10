import { describe, it, expect } from 'vitest'
import { attendanceFor, finalizationBlocker, meetingQuorum, quorumRequired } from '../src/features/committees/committeeMeetingRules'

const present = (voting = true) => ({ voting, status: 'present' })
const absent = (voting = true) => ({ voting, status: 'absent' })

describe('quorumRequired', () => {
  it('simple majority is more than half of the voting members', () => {
    expect([1, 2, 3, 4, 5, 6].map(n => quorumRequired('simple_majority', n))).toEqual([1, 2, 2, 3, 3, 4])
  })

  it('two thirds rounds up', () => {
    expect([3, 4, 5, 6, 7].map(n => quorumRequired('two_thirds', n))).toEqual([2, 3, 4, 4, 5])
  })

  it('a custom rule cannot be computed; no voting members need no quorum', () => {
    expect(quorumRequired('custom', 5)).toBeNull()
    expect(quorumRequired('two_thirds', 0)).toBe(0)
  })
})

describe('meetingQuorum', () => {
  it('counts only present voting members towards quorum, and everyone present towards attendance', () => {
    const rows = [present(), present(), absent(), absent(), present(false), present(false)]
    expect(meetingQuorum(rows, 'simple_majority')).toEqual({ required: 3, votingMembers: 4, presentVoting: 2, quorum: false, attendance: 4 })
    expect(meetingQuorum([...rows, present()], 'simple_majority').quorum).toBe(true)
  })

  it('defaults to simple majority and leaves quorum open under a custom rule', () => {
    expect(meetingQuorum([present(), absent()]).required).toBe(2)
    expect(meetingQuorum([present(), absent()], 'custom').quorum).toBeNull()
  })

  it('a meeting without voting members has no quorum', () => {
    expect(meetingQuorum([present(false)])).toMatchObject({ required: 0, votingMembers: 0, quorum: false, attendance: 1 })
    expect(meetingQuorum([present(false)], 'custom').quorum).toBe(false)
  })
})

describe('finalizationBlocker', () => {
  const quorate = { required: 2, quorum: true, attendance: 3 }
  it('needs someone present, the quorum, and a conclusion for every topic with a subject', () => {
    expect(finalizationBlocker({}, { ...quorate, attendance: 0 })).toBe('no_attendance')
    expect(finalizationBlocker({}, { ...quorate, quorum: false })).toBe('no_quorum')
    expect(finalizationBlocker({ topics: [{ subject: 'Budget', decision: ' ' }] }, quorate)).toBe('topic_without_decision')
  })

  it('a committee without voting members cannot finalize minutes, whatever the rule', () => {
    expect(finalizationBlocker({}, meetingQuorum([present(false)]))).toBe('no_voting_members')
    expect(finalizationBlocker({}, meetingQuorum([present(false)], 'custom'))).toBe('no_voting_members')
  })

  it('accepts a quorate meeting, a custom rule, and empty topics', () => {
    expect(finalizationBlocker({ topics: [{ subject: 'Budget', decision: 'Approved' }, { subject: '', decision: '' }] }, quorate)).toBeNull()
    expect(finalizationBlocker({}, { required: null, quorum: null, attendance: 1 })).toBeNull()
  })
})

describe('attendanceFor', () => {
  it('adds a not-recorded row per member and keeps rows already recorded', () => {
    const members = [{ id: 'M1', dbId: 'd1', name: 'A' }, { id: 'M2', name: 'B', voting: false }]
    const kept = { id: 'ATT-M1', memberId: 'M1', status: 'present', voting: true }
    const rows = attendanceFor(members, [kept, { memberId: 'GONE', status: 'present' }])
    expect(rows).toEqual([kept, { id: 'ATT-M2', memberId: 'M2', memberDbId: null, employeeDbId: null, name: 'B', voting: false, status: 'not_recorded' }])
  })
})
