import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { filterSelf, isOverdue, selfChapters, selfCounts, selfFigures, selfGaps, selfStatusLabel } from '../src/features/quality/selfAssessment/selfAssessmentModel'

const rows = [
  { id: 'a', position: 1, chapterRef: '1', chapterTitle: 'Α', item: 'Q1', weight: 1, answer: 'yes' },
  { id: 'b', position: 2, chapterRef: '1', chapterTitle: 'Α', item: 'Q2', weight: 2, answer: 'partial' },
  { id: 'c', position: 3, chapterRef: '2', chapterTitle: 'Β', item: 'Q3', weight: 1, answer: 'no', critical: true },
  { id: 'd', position: 4, chapterRef: '2', chapterTitle: 'Β', item: 'Q4', weight: 1, answer: '' },
]

describe('Self-assessment model', () => {
  it('counts the progress and scores the answers on the audit scale', () => {
    const figures = selfFigures(rows)
    expect(figures).toMatchObject({ total: 4, answered: 3, pct: 75, criticalFailed: 1 })
    expect(figures.score).toBe(Math.round((1 + 1 + 0) * 100 / 4)) // (1·1 + 0.5·2 + 0·1) / 4
  })

  it('lists the gaps with the critical ones first and groups the rows by chapter', () => {
    expect(selfGaps(rows).map(row => row.id)).toEqual(['c', 'b'])
    expect(selfChapters(rows).map(chapter => [chapter.ref, chapter.rows.length])).toEqual([['1', 2], ['2', 2]])
  })

  it('counts, filters and names the statuses', () => {
    const items = [{ title: 'A', departmentName: 'ΜΕΘ', status: 'draft', dueOn: '' }, { title: 'B', departmentName: 'Χειρουργείο', status: 'released', dueOn: '2020-01-01' }, { title: 'C', departmentName: 'ΜΕΘ', status: 'submitted' }]
    expect(selfCounts(items)).toEqual({ total: 3, inProgress: 1, submitted: 1, drafts: 1, overdue: 1 })
    expect(isOverdue(items[1], '2026-10-28')).toBe(true)
    expect(isOverdue(items[0], '2026-10-28')).toBe(false)
    expect(filterSelf(items, 'μεθ').length).toBe(2)
    expect(selfStatusLabel('released', 'en')).toBe('In progress')
  })
})

describe('Self-assessment database', () => {
  const sql = fs.readFileSync('supabase/migrations/20261214100000_quality_self_assessments.sql', 'utf8')
  it('the department sees only released ones of its own departments and writes only through the function', () => {
    expect(sql).toContain("status in ('released', 'submitted', 'closed')")
    expect(sql).toContain('private.current_user_department_scopes()')
    expect(sql).toMatch(/create policy quality_self_assessments_insert[\s\S]*current_user_quality_manage_orgs/)
    expect(sql).toContain('create policy quality_self_assessments_module_gate')
    expect(sql).toContain("raise exception 'SELF_ASSESSMENT_INCOMPLETE'")
    expect(sql).toContain("v_row.status = 'released' and")
  })
  it('is reachable from the audits tab, the department menu and the routes', () => {
    expect(fs.readFileSync('src/features/quality/QualityLists.jsx', 'utf8')).toContain("<SelfAssessmentPanel query={filters.query} canManage={canManageSelf} toolbarSlot={toolbarSlot}/>")
    expect(fs.readFileSync('src/app/navigation.js', 'utf8')).toContain("key:'departmentSelfAssessment'")
    const app = fs.readFileSync('src/app/App.jsx', 'utf8')
    for (const route of ['my-department/self-assessment"', 'my-department/self-assessment/:id', 'quality/self-assessments/:id', 'quality/self-assessments/new']) expect(app).toContain(route)
  })
})
