import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('department meetings: topics and training', () => {
  it('keeps topics and training needs in tables of their own, closed like the meeting', () => {
    const sql = read('supabase/migrations/20261231140000_department_meeting_topics_trainings.sql')
    for (const table of ['quality_department_meeting_topics', 'quality_department_meeting_trainings']) expect(sql).toContain(`create table if not exists public.${table}`)
    expect(sql).toContain("t || '_module_gate'")
    expect(sql).toContain('current_user_department_scopes')
    // The FileMaker «TopicDiscussed» becomes a topic, not a decision.
    expect(sql).toContain("insert into public.quality_department_meeting_topics (id, organization_id, meeting_id, subject, position)")
  })

  it('opens the meeting on tabs, with the training held at it as a yes/no and a link, not a tab', () => {
    const page = read('src/features/quality/meetings/MeetingRecordPage.jsx')
    for (const id of ["id: 'details'", "id: 'topics'", "id: 'decisions'", "id: 'people'", "id: 'files'"]) expect(page).toContain(id)
    // No indicators and no training tab: the meeting only says whether a training was held and which one.
    expect(page).not.toContain("id: 'indicators'")
    expect(page).not.toContain("id: 'training'")
    expect(page).toContain('Έγινε εκπαίδευση στη συνάντηση;')
    expect(page).toContain("navigate('/training/new', { state: { trainingDraft:")
    expect(read('src/features/training/TrainingCreatePage.jsx')).toContain('linkMeetingTraining(tenant.id,location.state.meetingTraining,program)')
    expect(read('supabase/migrations/20261231160000_department_meeting_training_held.sql')).toContain('training_held boolean')
  })

  it('gives the department its own «Meetings» and takes them out of the registers', () => {
    expect(read('src/app/App.jsx')).toContain('path="my-department/meetings"')
    expect(read('src/features/registers/RegistersPage.jsx')).not.toContain("value: 'meetings'")
  })
})

describe('department meeting groups', async () => {
  const { groupStatus, frequencyLabel, meetingInGroup, newMeetingFor } = await import('../src/features/quality/meetings/meetingModel')
  const group = { id: 'g1', departmentId: 'd1', frequencyDays: 90, active: true }
  const meeting = (id, meetingDate, extra = {}) => ({ id, meetingDate, departmentId: 'd1', groupId: 'g1', decisions: [], ...extra })

  it('dates the next meeting from the last one and the frequency', () => {
    const status = groupStatus(group, [meeting('m1', '2026-01-10'), meeting('m2', '2026-04-01')], '2026-05-01')
    expect(status.last.id).toBe('m2')
    expect(status.nextDue).toBe('2026-06-30')
    expect(status.overdue).toBe(false)
    expect(groupStatus(group, [meeting('m2', '2026-04-01')], '2026-07-15').overdue).toBe(true)
  })

  it('keeps a meeting recorded before the groups in its department’s group', () => {
    expect(meetingInGroup({ departmentId: 'd1' }, group)).toBe(true)
    expect(meetingInGroup({ departmentId: 'd1', groupId: 'g2' }, group)).toBe(false)
  })

  it('names the frequency and starts a new meeting in the group', () => {
    expect(frequencyLabel(90, 'el')).toBe('Κάθε 3 μήνες')
    expect(frequencyLabel(45, 'el')).toBe('Κάθε 45 ημέρες')
    const next = newMeetingFor({ id: 'd1', name: 'ΜΕΘ' }, [], '2026-05-01', group)
    expect(next.groupId).toBe('g1')
    expect(next.nextMeetingDate).toBe('2026-07-30')
  })

  it('keeps the groups in a table of their own, written by Quality and read by the department', () => {
    const sql = read('supabase/migrations/20261231150000_department_meeting_groups.sql')
    expect(sql).toContain('create table if not exists public.quality_department_meeting_groups')
    expect(sql).toContain('quality_department_meeting_groups_module_gate')
    expect(sql).toContain("add column if not exists employee_id uuid references public.employees(id)")
  })
})
