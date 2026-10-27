import { useCallback, useEffect, useMemo, useState } from 'react'
import { FilterBar, FilterSelect } from '../../../design-system/FilterBar'
import { RegistryPagination } from '../../../design-system/RegistryPagination'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { formatDay } from '../../../core/i18n/formatDay'
import { loadSurveys } from './surveyService'
import { SURVEY_AUDIENCES, SURVEY_STATUSES, audienceLabel, isSurveyOpen, surveyStatusLabel, surveyStatusTone } from './surveyModel'

// The surveys the user may see (the database returns a department only the
// surveys that cover it).
export function useSurveys(enabled = true) {
  const { tenant } = useTenant()
  const [surveys, setSurveys] = useState([])
  const [loading, setLoading] = useState(enabled)
  const reload = useCallback(() => {
    if (!enabled) { setLoading(false); return }
    setLoading(true)
    loadSurveys(tenant?.id).then(setSurveys).catch(() => setSurveys([])).finally(() => setLoading(false))
  }, [tenant?.id, enabled])
  useEffect(() => { reload() }, [reload])
  return { surveys, loading, reload }
}

const SOON_DAYS = 14
const daysUntil = day => (day ? Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)) / 86400000) : null)
export const surveyClosingSoon = survey => { const days = daysUntil(survey.closesOn); return isSurveyOpen(survey) && days != null && days >= 0 && days <= SOON_DAYS }

// The figures of the Surveys view.
export function surveyCounts(surveys = []) {
  return {
    open: surveys.filter(survey => isSurveyOpen(survey)).length,
    recent: surveys.reduce((sum, survey) => sum + (survey.recentCount || 0), 0),
    responses: surveys.reduce((sum, survey) => sum + (survey.responseCount || 0), 0),
    closing: surveys.filter(surveyClosingSoon).length,
    drafts: surveys.filter(survey => survey.status === 'draft').length,
  }
}

export function filterSurveys(surveys, filters) {
  const q = String(filters.query || '').trim().toLowerCase()
  return surveys
    .filter(survey => !q || `${survey.code} ${survey.title} ${survey.titleEn || ''}`.toLowerCase().includes(q))
    .filter(survey => filters.audience === 'all' || survey.audience === filters.audience)
    .filter(survey => filters.status === 'all' || survey.status === filters.status)
    .filter(survey => !filters.quick || (filters.quick === 'open' ? isSurveyOpen(survey) : filters.quick === 'closing' ? surveyClosingSoon(survey) : filters.quick === 'draft' ? survey.status === 'draft' : true))
    // Open surveys first, then the most recent.
    .sort((a, b) => Number(isSurveyOpen(b)) - Number(isSurveyOpen(a)) || String(b.opensOn || b.createdAt || '').localeCompare(String(a.opensOn || a.createdAt || '')))
}

export function surveysExport(surveys, language) {
  const en = language === 'en'
  return {
    name: en ? 'satisfaction-surveys' : 'erevnes-ikanopoiisis',
    headers: en ? ['Code', 'Survey', 'Asks', 'From', 'To', 'Responses', 'Last 30 days', 'Target', 'Status'] : ['Κωδικός', 'Έρευνα', 'Απευθύνεται σε', 'Από', 'Έως', 'Απαντήσεις', 'Τελευταίες 30 ημέρες', 'Στόχος απαντήσεων', 'Κατάσταση'],
    rows: surveys.map(survey => [survey.code, en ? survey.titleEn || survey.title : survey.title, audienceLabel(survey.audience, language), formatDay(survey.opensOn, language), formatDay(survey.closesOn, language), survey.responseCount || 0, survey.recentCount || 0, survey.targetResponses || '', surveyStatusLabel(survey.status, language)]),
  }
}

export function SurveysList({ list, registry = null, filters, setFilters, onOpen, filterEnd = null }) {
  const { t, language } = useLanguage()
  const en = language === 'en'
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const set = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  const rows = useMemo(() => filterSurveys(list.surveys, filters), [list.surveys, filters])
  useEffect(() => setPage(1), [filters, pageSize])
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize)), safePage = Math.min(page, totalPages)
  const advanced = ['audience', 'status'].filter(key => filters[key] !== 'all').length
  return <>
    <FilterBar query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search surveys…' : 'Αναζήτηση έρευνας…'} activeAdvancedCount={advanced} onClear={() => setFilters(current => ({ ...current, query: '', audience: 'all', status: 'all', quick: null }))} end={filterEnd}>
      <FilterSelect label={en ? 'Asks' : 'Απευθύνεται σε'} value={filters.audience} onChange={value => set('audience', value)}><option value="all">{t('all')}</option>{SURVEY_AUDIENCES.map(item => <option key={item.value} value={item.value}>{item.label[en ? 1 : 0]}</option>)}</FilterSelect>
      <FilterSelect label={t('status')} value={filters.status} onChange={value => set('status', value)}><option value="all">{t('all')}</option>{SURVEY_STATUSES.map(item => <option key={item.value} value={item.value}>{item.label[en ? 1 : 0]}</option>)}</FilterSelect>
    </FilterBar>
    <div className="scroll-table" ref={registry?.scrollRef}>
      <RegistryTable bare className="quality-table quality-register-table" rows={rows.slice((safePage - 1) * pageSize, safePage * pageSize)} rowKey={survey => survey.id} empty={!list.loading && !rows.length} emptyFiltered={list.surveys.length > 0} onClearFilters={() => setFilters(current => ({ ...current, query: '', audience: 'all', status: 'all', quick: null }))}
        columns={[{ key: 'code', label: t('code') }, { key: 'survey', label: en ? 'Survey' : 'Έρευνα' }, { key: 'period', label: en ? 'Period' : 'Περίοδος' }, { key: 'responses', label: en ? 'Responses' : 'Απαντήσεις' }, { key: 'status', label: t('status') }]}
        emptyTitle={en ? 'No surveys yet' : 'Δεν υπάρχουν έρευνες'} emptyText={en ? 'Start one from a template: inpatients, outpatients and emergency, or staff.' : 'Ξεκινήστε από πρότυπο: νοσηλευόμενοι, εξωτερικοί ασθενείς και ΤΕΠ, ή προσωπικό.'}
        rowProps={survey => ({ ...(registry?.rowProps(survey.id) || { className: 'registry-row-clickable' }), onClick: () => onOpen(survey) })}
        renderRow={survey => { const closing = surveyClosingSoon(survey); return <>
          <td><strong>{survey.code || '—'}</strong><small>{audienceLabel(survey.audience, language)}</small></td>
          <td>{en ? survey.titleEn || survey.title : survey.title}<small>{survey.questions?.length || 0} {en ? 'questions' : 'ερωτήσεις'}</small></td>
          <td className="nowrap-cell">{[formatDay(survey.opensOn, language), formatDay(survey.closesOn, language)].filter(Boolean).join(' – ') || '—'}{closing && <small className="quality-overdue-text">{en ? 'Closes soon' : 'Λήγει σύντομα'}</small>}</td>
          <td>{survey.responseCount || 0}{survey.targetResponses ? ` / ${survey.targetResponses}` : ''}<small>{en ? `${survey.recentCount || 0} in 30 days` : `${survey.recentCount || 0} σε 30 ημέρες`}</small></td>
          <td><StatusBadge tone={surveyStatusTone(survey.status)}>{surveyStatusLabel(survey.status, language)}</StatusBadge></td>
        </> }} />
    </div>
    {rows.length > 0 && <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />}
  </>
}
