// Attendance, quorum and the checks before the minutes of a meeting are finalized.

// Voting members needed for quorum. Simple majority is more than half of the
// voting members; two thirds rounds up; a custom rule (set by the committee's
// regulations) cannot be computed and returns null.
export function quorumRequired(rule, votingCount) {
  if (!votingCount) return 0
  if (rule === 'two_thirds') return Math.ceil(votingCount * 2 / 3)
  if (rule === 'custom') return null
  return Math.floor(votingCount / 2) + 1
}

// One attendance row per member, keeping rows already recorded for a member,
// then the recorded attendees who are not members (for example minutes imported
// from an earlier system, where only the names were kept). Members are voting
// unless marked otherwise; attendees who are not members never vote, so they
// count towards attendance but not towards quorum.
export function attendanceFor(members, existing = []) {
  const recorded = new Map(existing.filter(row => row.memberId).map(row => [row.memberId, row]))
  const guests = existing.filter(row => !row.memberId && row.name).map(row => ({ ...row, voting: false }))
  return [...members.map(member => recorded.get(member.id) || {
    id: `ATT-${member.id}`,
    memberId: member.id,
    memberDbId: member.dbId || null,
    employeeDbId: member.employeeDbId || null,
    name: member.name,
    voting: member.voting !== false,
    status: 'not_recorded',
  }), ...guests]
}

// Quorum of a meeting from its attendance: `quorum` is null when the rule is
// custom, otherwise whether enough voting members were present. A meeting
// without any voting member has no quorum. `attendance` counts everyone
// present, voting or not.
export function meetingQuorum(attendanceRecords = [], rule = 'simple_majority') {
  const voting = attendanceRecords.filter(row => row.voting)
  const presentVoting = voting.filter(row => row.status === 'present').length
  const required = quorumRequired(rule || 'simple_majority', voting.length)
  return {
    required,
    votingMembers: voting.length,
    presentVoting,
    quorum: required === null ? null : voting.length > 0 && presentVoting >= required,
    attendance: attendanceRecords.filter(row => row.status === 'present').length,
  }
}

// Why the minutes cannot be finalized yet, or null when they can:
// 'no_attendance' (nobody recorded present), 'no_voting_members' (the committee
// has no member with a vote), 'no_quorum' (quorum not met under a computable
// rule), 'topic_without_decision' (a topic has no conclusion).
export function finalizationBlocker(meeting, { required, quorum, attendance, votingMembers }) {
  if (!attendance) return 'no_attendance'
  if (votingMembers === 0) return 'no_voting_members'
  if (required !== null && !quorum) return 'no_quorum'
  if ((meeting.topics || []).some(topic => topic.subject?.trim() && !topic.decision?.trim())) return 'topic_without_decision'
  return null
}
