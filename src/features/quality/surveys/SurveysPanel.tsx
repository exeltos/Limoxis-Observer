import { useDepartments } from '../../management/useLibraries'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FilterBar, FilterSelect } from '../../../design-system/FilterBar'
import { RegistryPagination } from '../../../design-system/RegistryPagination'
import { useSortedPaging, withSort } from '../useSortedPaging'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { formatDay } from '../../../core/i18n/formatDay'
import { loadResponses, loadSurveys } from './surveyService'
import { SURVEY_AUDIENCES, SURVEY_STATUSES, audienceLabel, isSurveyOpen, satisfactionCounts, surveyStatusLabel, surveyStatusTone } from './surveyModel'
import { hospitalToday } from '../../../core/dates/hospitalDate'
import type { AnyRecord } from '../../../types/featureTypes'
import type { Survey } from './surveyModel'
import type { ReactNode } from 'react'

// The surveys the user may see (the database returns a department only the
// surveys that cover it).
export function useSurveys(enabled = true) {
  const { tenant } = useTenant()
  const [surveys, setSurveys] = useState<AnyRecord[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(false)
  const reload = useCallback(() => {
    if (!enabled) { setLoading(false); return }
    setLoading(true)
    loadSurveys(tenant?.id).then(rows => { setSurveys(rows); setError(false) }).catch(() => { setSurveys([]); setError(true) }).finally(() => setLoading(false))
  }, [tenant?.id, enabled])
  useEffect(() => { reload() }, [reload])
  return { surveys, loading, error, reload }
}

const SOON_DAYS = 14
// The share of satisfied answers (4 or 5) of each questionnaire in the list, read once the list is on screen.
function useSatisfaction(surveys: AnyRecord) {
  const { tenant } = useTenant()
  const [byId, setById] = useState(() => new Map())
  const key = surveys.map((survey: AnyRecord) => `${survey.id}:${survey.responseCount || 0}`).join(',')
  useEffect(() => {
    if (!key) return undefined
    let live = true
    Promise.all(surveys.filter((survey: AnyRecord) => survey.responseCount).map((survey: AnyRecord) => loadResponses(tenant?.id, survey.id).then(responses => [survey.id, satisfactionCounts(survey, responses)]).catch(() => [survey.id, null])))
      .then(rows => { if (live) setById(new Map(rows)) })
    return () => { live = false }
  }, [key, tenant?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return byId
}
const percentText = (value: number, en: boolean) => new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(value)
const daysUntil = (day: string) => (day ? Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${hospitalToday()}T00:00:00Z`)) / 86400000) : null)
export const surveyClosingSoon = (survey: AnyRecord) => { const days = daysUntil(survey.closesOn); return isSurveyOpen(survey) && days != null && days >= 0 && days <= SOON_DAYS }

// The figures of the Surveys view.
export function surveyCounts(surveys: AnyRecord[] = []) {
  return {
    open: surveys.filter(survey => isSurveyOpen(survey)).length,
    recent: surveys.reduce((sum, survey) => sum + (survey.recentCount || 0), 0),
    responses: surveys.reduce((sum, survey) => sum + (survey.responseCount || 0), 0),
    closing: surveys.filter(surveyClosingSoon).length,
    drafts: surveys.filter(survey => survey.status === 'draft').length,
  }
}

export function filterSurveys(surveys: AnyRecord[], filters: AnyRecord) {
  const q = String(filters.query || '').trim().toLowerCase()
  return surveys
    .filter((survey: AnyRecord) => !q || `${survey.code} ${survey.title} ${survey.titleEn || ''}`.toLowerCase().includes(q))
    .filter((survey: AnyRecord) => filters.audience === 'all' || survey.audience === filters.audience)
    .filter((survey: AnyRecord) => filters.status === 'all' || survey.status === filters.status)
    .filter((survey: AnyRecord) => !filters.quick || (filters.quick === 'open' ? isSurveyOpen(survey) : filters.quick === 'closing' ? surveyClosingSoon(survey) : filters.quick === 'draft' ? survey.status === 'draft' : true))
    // Open surveys first, then the most recent.
    .sort((a: AnyRecord, b: AnyRecord) => Number(isSurveyOpen(b)) - Number(isSurveyOpen(a)) || String(b.opensOn || b.createdAt || '').localeCompare(String(a.opensOn || a.createdAt || '')))
}

export function surveysExport(surveys: AnyRecord[], language: string) {
  const en = language === 'en'
  return {
    name: en ? 'satisfaction-surveys' : 'erevnes-ikanopoiisis',
    headers: en ? ['Code', 'Questionnaire', 'Asks', 'From', 'To', 'Responses', 'Last 30 days', 'Target', 'Status'] : ['Κωδικός', 'Ερωτηματολόγιο', 'Απευθύνεται σε', 'Από', 'Έως', 'Απαντήσεις', 'Τελευταίες 30 ημέρες', 'Στόχος απαντήσεων', 'Κατάσταση'],
    rows: surveys.map((survey: AnyRecord) => [survey.code, en ? survey.titleEn || survey.title : survey.title, audienceLabel(survey.audience, language), formatDay(survey.opensOn, language), formatDay(survey.closesOn, language), survey.responseCount || 0, survey.recentCount || 0, survey.targetResponses || '', surveyStatusLabel(survey.status, language)]),
  }
}

export function SurveysList({ list, registry = null, filters, setFilters, onOpen, filterEnd = null }: { list: ReturnType<typeof useSurveys>, registry?: AnyRecord | null, filters: AnyRecord, setFilters: (update: (current: AnyRecord) => AnyRecord) => void, onOpen: (survey: Survey) => void, filterEnd?: ReactNode }) {
  const { t, language } = useLanguage()
  const en = language === 'en'
  const { departments }: { departments: AnyRecord[] } = useDepartments()
  // The departments a questionnaire is about, by name (up to three; otherwise how many).
  const departmentsOf = (survey: AnyRecord) => { const names = (survey.departmentIds || []).map((id: string) => departments.find(item => (item.id || item.name) === id)).filter(Boolean).map((item: AnyRecord) => (en ? item.nameEn || item.name : item.name)); return names.length > 3 ? `${names.length} ${en ? 'departments' : 'τμήματα'}` : names.join(', ') }
  const set = (key: string, value: unknown) => setFilters(current => ({ ...current, [key]: value }))
  const rows = useMemo(() => filterSurveys(list.surveys, filters), [list.surveys, filters])
  const sortBy: Record<string, (survey: AnyRecord) => unknown> = { code: (survey: AnyRecord) => survey.code, survey: (survey: AnyRecord) => (en ? survey.titleEn || survey.title : survey.title), period: (survey: AnyRecord) => survey.opensOn, responses: (survey: AnyRecord) => survey.responseCount || 0, status: (survey: AnyRecord) => survey.status }
  const satisfaction = useSatisfaction(list.surveys)
  const satisfiedOf = (survey: AnyRecord) => { const counts = satisfaction.get(survey.id); return counts?.answered ? Math.round((counts.satisfied / counts.answered) * 1000) / 10 : null }
  sortBy.satisfaction = satisfiedOf
  const paging = useSortedPaging(rows, JSON.stringify(filters), sortBy)
  const advanced = ['audience', 'status'].filter(key => filters[key] !== 'all').length
  return <>
    <FilterBar query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search questionnaires…' : 'Αναζήτηση ερωτηματολογίου…'} activeAdvancedCount={advanced} onClear={() => setFilters(current => ({ ...current, query: '', audience: 'all', status: 'all', quick: null }))} end={filterEnd}>
      <FilterSelect label={en ? 'Asks' : 'Απευθύνεται σε'} value={filters.audience} onChange={value => set('audience', value)}><option value="all">{t('all')}</option>{SURVEY_AUDIENCES.map(item => <option key={item.value} value={item.value}>{item.label[en ? 1 : 0]}</option>)}</FilterSelect>
      <FilterSelect label={t('status')} value={filters.status} onChange={value => set('status', value)}><option value="all">{t('all')}</option>{SURVEY_STATUSES.map(item => <option key={item.value} value={item.value}>{item.label[en ? 1 : 0]}</option>)}</FilterSelect>
    </FilterBar>
    <div className="scroll-table" ref={registry?.scrollRef}>
      <RegistryTable sort={paging.sort} onSort={paging.onSort} bare className="quality-table quality-register-table" rows={paging.rows} rowKey={survey => survey.id} error={list.error} onRetry={list.reload} empty={!list.loading && !list.error && !rows.length} emptyFiltered={list.surveys.length > 0} onClearFilters={() => setFilters(current => ({ ...current, query: '', audience: 'all', status: 'all', quick: null }))}
        columns={withSort([{ key: 'survey', label: en ? 'Questionnaire' : 'Ερωτηματολόγιο' }, { key: 'period', label: en ? 'Period' : 'Περίοδος' }, { key: 'responses', label: en ? 'Responses' : 'Απαντήσεις' }, { key: 'satisfaction', label: en ? 'Satisfaction' : 'Ικανοποίηση' }, { key: 'status', label: t('status') }], sortBy)}
        emptyTitle={en ? 'No questionnaires yet' : 'Δεν υπάρχουν ερωτηματολόγια'} emptyText={en ? 'Start one from a template: inpatients, outpatients and emergency, or staff.' : 'Ξεκινήστε από πρότυπο: νοσηλευόμενοι, εξωτερικοί ασθενείς και ΤΕΠ, ή προσωπικό.'}
        rowProps={survey => ({ ...(registry?.rowProps(survey.id) || { className: 'registry-row-clickable' }), onClick: () => onOpen(survey) })}
        renderRow={survey => { const closing = surveyClosingSoon(survey); return <>
          <td><strong>{en ? survey.titleEn || survey.title : survey.title}</strong><small>{[survey.code, audienceLabel(survey.audience, language), departmentsOf(survey), `${survey.questions?.length || 0} ${en ? 'questions' : 'ερωτήσεις'}`].filter(Boolean).join(' · ')}</small></td>
          <td className="nowrap-cell">{survey.opensOn && !survey.closesOn ? `${en ? 'from' : 'από'} ${formatDay(survey.opensOn, language)}` : [formatDay(survey.opensOn, language), formatDay(survey.closesOn, language)].filter(Boolean).join(' – ') || '—'}{closing && <small className="quality-overdue-text">{en ? 'Closes soon' : 'Λήγει σύντομα'}</small>}</td>
          <td>{survey.responseCount || 0}{survey.targetResponses ? ` / ${survey.targetResponses}` : ''}<small>{en ? `${survey.recentCount || 0} in 30 days` : `${survey.recentCount || 0} σε 30 ημέρες`}</small></td>
          <td>{(() => { const value = satisfiedOf(survey); return value == null ? <span className="indicator-approval-none">—</span> : <><strong className={value < (survey.satisfiedTarget || 0) ? 'quality-overdue-text' : undefined}>{percentText(value, en)}%</strong><small>{en ? 'target' : 'στόχος'} {survey.satisfiedTarget || 80}%</small></> })()}</td>
          <td><StatusBadge tone={surveyStatusTone(survey.status)}>{surveyStatusLabel(survey.status, language)}</StatusBadge></td>
        </> }} />
    </div>
    {rows.length > 0 && <RegistryPagination language={language} {...paging.props} />}
  </>
}
