import { describe, expect, it } from 'vitest'
import { KITCHEN_VIEW_ID, isKitchenSource, kitchenResponses, kitchenView, surveySummary } from '../src/features/quality/surveys/surveyModel'
import { readSource } from './helpers/readSource'
import type { Survey } from '../src/features/quality/surveys/surveyTypes'

const q = (id: string, section: string) => ({ id, type: 'rating', label: id, required: true, options: [], section })
const make = (id: string, extra: Partial<Survey> = {}) => ({ id, code: id, title: id, audience: 'patients', templateKey: 'inpatients', status: 'open', opensOn: '2026-01-01', satisfiedTarget: 80, departmentIds: [id], questions: [q('food_quality', 'food'), q('food_service', 'food'), q('care', 'care')], responseCount: 3, recentCount: 1, ...extra }) as Survey & { responseCount: number, recentCount: number }

describe('«Ικανοποίηση Κουζίνας»: a questionnaire of its own made from the food questions', () => {
  it('takes only patient questionnaires with food questions, not the kitchen template nor staff', () => {
    expect(isKitchenSource(make('a'))).toBe(true)
    expect(isKitchenSource(make('b', { templateKey: 'kitchen' }))).toBe(false)
    expect(isKitchenSource(make('c', { audience: 'staff' }))).toBe(false)
    expect(isKitchenSource(make('d', { questions: [q('care', 'care')] }))).toBe(false)
  })

  it('joins the food questions once, sums the counts and is read-only', () => {
    const view = kitchenView([make('a'), make('b', { opensOn: '2025-05-01', status: 'closed' }), make('c', { audience: 'staff' })])!
    expect(view.id).toBe(KITCHEN_VIEW_ID)
    expect(view.derived).toBe(true)
    expect(view.sources).toEqual(['a', 'b'])
    expect(view.questions.map(item => item.id)).toEqual(['food_quality', 'food_service'])
    expect(view.responseCount).toBe(6)
    expect(view.recentCount).toBe(2)
    expect(view.opensOn).toBe('2025-05-01')
    expect(view.status).toBe('open')
    expect(view.departmentIds).toEqual(['a', 'b'])
    expect(kitchenView([make('x', { audience: 'staff' })])).toBeNull()
  })

  it('keeps only the food answers of each response and drops responses without any', () => {
    const responses = [{ id: '1', answers: { food_quality: 5, care: 2 } }, { id: '2', answers: { care: 4 } }, { id: '3', answers: { food_service: '', food_quality: 4 } }]
    const kept = kitchenResponses(responses, ['food_quality', 'food_service'])
    expect(kept.map(item => item.id)).toEqual(['1', '3'])
    expect(kept[0].answers).toEqual({ food_quality: 5 })
    const view = kitchenView([make('a')])!
    expect(surveySummary(view, kept).responses).toBe(2)
  })

  it('the page hides managing, entry and deletion for the joined questionnaire', () => {
    const page = readSource('src/features/quality/surveys/SurveyRecordPage.tsx')
    expect(page).toContain('const locked = !canManage || derived')
    expect(page).toContain('!survey.derived && entryDepartments.length > 0')
    expect(page).toContain('canManage && !survey.derived && tab === \'questionnaire\' && <IconButton tone="danger"')
  })
})
