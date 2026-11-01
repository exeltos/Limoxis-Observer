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

  it('opens the meeting on tabs, with a training tab that creates the programme from the meeting', () => {
    const page = read('src/features/quality/meetings/MeetingRecordPage.jsx')
    for (const id of ["id: 'details'", "id: 'indicators'", "id: 'topics'", "id: 'decisions'", "id: 'training'", "id: 'people'"]) expect(page).toContain(id)
    expect(page).toContain("navigate('/training/new', { state: { trainingDraft:")
    expect(read('src/features/training/TrainingCreatePage.jsx')).toContain('linkMeetingTraining(tenant.id,location.state.meetingTraining,program)')
  })

  it('gives the department its own «Meetings» and takes them out of the registers', () => {
    expect(read('src/app/App.jsx')).toContain('path="my-department/meetings"')
    expect(read('src/features/registers/RegistersPage.jsx')).not.toContain("value: 'meetings'")
  })
})
