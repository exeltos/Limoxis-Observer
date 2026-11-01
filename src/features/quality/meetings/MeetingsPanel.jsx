import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTenant } from '../../../core/tenant/TenantContext'
import { formatDay } from '../../../core/i18n/formatDay'
import { can, CAPABILITIES, ROLES } from '../../../core/permissions/roles'
import { useRegisterAccess } from '../../registers/registerAccess'
import { loadMeetingGroups, loadMeetings } from './meetingService'
import { meetingAccess } from './meetingModel'

// The department meetings the user may see: every department for Quality, the
// own department(s) for its members (the database filters the same way).
export function useMeetings(enabled = true) {
  const { tenant, role, membership, actualRole, isRolePreview } = useTenant()
  const registerAccess = useRegisterAccess()
  const canManage = (!isRolePreview && actualRole === ROLES.PLATFORM_OWNER) || can(role, CAPABILITIES.MANAGE_QUALITY, membership?.capabilities ?? [], membership?.customCapabilities ?? [])
  const access = useMemo(() => meetingAccess(registerAccess, canManage), [registerAccess, canManage])
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(false)
  const reload = useCallback(() => {
    if (!enabled) { setLoading(false); return }
    setLoading(true)
    loadMeetings(tenant?.id).then(rows => { setMeetings(rows); setError(false) }).catch(() => { setMeetings([]); setError(true) }).finally(() => setLoading(false))
  }, [tenant?.id, enabled])
  useEffect(() => { reload() }, [reload])
  const visible = useMemo(() => meetings.filter(access.canSee), [meetings, access])
  return { meetings: visible, all: meetings, loading, error, reload, access, canManage, seesAll: registerAccess.seesAll }
}

// The meeting groups the user may see, with their meetings: every department for Quality, the own for its members.
export function useMeetingGroups(enabled = true) {
  const { tenant } = useTenant()
  const meetings = useMeetings(enabled)
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(false)
  const reloadGroups = useCallback(() => {
    if (!enabled) { setLoading(false); return }
    setLoading(true)
    loadMeetingGroups(tenant?.id).then(rows => { setGroups(rows); setError(false) }).catch(() => { setGroups([]); setError(true) }).finally(() => setLoading(false))
  }, [tenant?.id, enabled])
  useEffect(() => { reloadGroups() }, [reloadGroups])
  const visible = useMemo(() => groups.filter(group => meetings.access.canSee({ departmentId: group.departmentId, department: group.department })), [groups, meetings.access])
  const reload = useCallback(() => { reloadGroups(); meetings.reload() }, [reloadGroups, meetings])
  return { groups: visible, meetings, loading: loading || meetings.loading, error: error || meetings.error, reload, canManage: meetings.canManage }
}

const departmentOf = (meeting, en) => (en ? meeting.departmentEn : meeting.department) || meeting.department || '—'

export function meetingsExport(meetings, language) {
  const en = language === 'en'
  const yes = value => (value ? (en ? 'Yes' : 'Ναι') : '')
  return {
    name: en ? 'department-meetings' : 'synantiseis-tmimaton',
    headers: en ? ['Code', 'Department', 'Date', 'Kind', 'Topics', 'Decision', 'Training'] : ['Κωδικός', 'Τμήμα', 'Ημερομηνία', 'Είδος', 'Θέματα', 'Απόφαση', 'Εκπαίδευση'],
    rows: meetings.map(meeting => [meeting.code, departmentOf(meeting, en), formatDay(meeting.meetingDate, language), meeting.kind === 'extraordinary' ? (en ? 'Extraordinary' : 'Έκτακτη') : (en ? 'Regular' : 'Τακτική'), (meeting.topics || []).map(topic => topic.subject).filter(Boolean).join(' · '), yes(meeting.decisions.length > 0), yes(meeting.trainingHeld)]),
  }
}
