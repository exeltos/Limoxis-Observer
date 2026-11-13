import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { BarChart3, ClipboardList, Lock, MessageSquareText, Play, Plus, QrCode as QrIcon, RotateCcw, Smile, Trash2 } from 'lucide-react'
import { Page } from '../../../design-system/Page'
import { EntityRecordShell } from '../../../design-system/EntityRecordShell'
import { RecordTabPanel } from '../../../design-system/RecordTabPanel'
import { ExportMenu } from '../../../design-system/ExportMenu'
import { ObserverDialog } from '../../../design-system/ObserverDialog'
import { ChoiceField } from '../../../design-system/ChoiceField'
import { FilterBar, FilterDate, FilterSelect } from '../../../design-system/FilterBar'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { RegistryPagination } from '../../../design-system/RegistryPagination'
import { Button } from '../../../design-system/Button'
import { SaveButton } from '../../../design-system/SaveButton'
import { IconButton } from '../../../design-system/IconButton'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { formatDay } from '../../../core/i18n/formatDay'
import { exportRegistry } from '../../../core/export/registryExports'
import { can, CAPABILITIES, ROLES } from '../../../core/permissions/roles'
import { useContextualNavigation } from '../../../core/navigation/useContextualNavigation'
import { useDepartments } from '../../management/useLibraries'
import { addResponse, deleteResponse, deleteSurvey, loadResponses, loadSurvey, saveSurvey } from './surveyService'
import { RESPONSE_CHANNELS, answerText, audienceLabel, channelLabel, filterResponses, responsesExport, surveyFromTemplate, surveyProblems, surveyStatusLabel, surveyStatusTone, textOf } from './surveyModel'
import { SurveyResults, SurveyResultsLine } from './SurveyResults'
import { SurveyCollect } from './SurveyCollect'
import { SurveyEditor } from './SurveyEditor'
import { SurveyForm, missingAnswers } from './SurveyForm'
import '../quality.css'
import './surveys.css'
import { LinkedActions } from '../LinkedActions'
import { TableSkeleton } from '../../../design-system/LoadingSkeleton'
import { hospitalToday } from '../../../core/dates/hospitalDate'
import type { Survey, SurveyResponse } from './surveyModel'
import type { SurveyDepartment, SurveyEntry, SurveyQuestionResult } from './surveyTypes'

const NO_FILTERS: Record<string, string> = { query: '', department: 'all', channel: 'all', from: '', to: '' }

export function SurveyRecordPage() {
  const { surveyId } = useParams()
  const isNew = surveyId === 'new'
  const location = useLocation()
  const navigate = useNavigate()
  const { goBack } = useContextualNavigation('/quality')
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, confirm } = useFeedback()
  const { tenant, role, membership, actualRole, isRolePreview, isDemo } = useTenant()
  const { departments } = useDepartments()
  const canManage = (!isRolePreview && actualRole === ROLES.PLATFORM_OWNER) || can(role, CAPABILITIES.MANAGE_QUALITY, membership?.capabilities ?? [], membership?.customCapabilities ?? [])
  // One response opened from the list: its answers, and (for the Quality team) «Delete» in its ⋯.
  // Header «Export» on the Collection tab: each click prints the posters (counted, so the same click twice prints twice).
  const [printPosters, setPrintPosters] = useState(0)
  const [viewing, setViewing] = useState<SurveyResponse | null>(null)
  const [survey, setSurveyValue] = useState<Survey | null | false>(null)
  // Every change after the load works on the open questionnaire (null while loading, false when not found).
  const setSurvey = setSurveyValue as (next: Survey | false | ((current: Survey) => Survey)) => void
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [tab, setTab] = useState(isNew ? 'questionnaire' : 'results')
  const [saving, setSaving] = useState(false)
  const [filters, setFilters] = useState(NO_FILTERS)
  const [entry, setEntry] = useState<SurveyEntry | null>(null)
  const [page, setPage] = useState(1)

  const reload = useCallback(async () => {
    if (isNew) { setSurvey(surveyFromTemplate(location.state?.template || 'wards', { hospital: tenant?.name || '' })); return }
    try {
      const found = await loadSurvey(tenant?.id, surveyId as string)
      setSurvey(found ? structuredClone(found) : false)
      if (found) setResponses(await loadResponses(tenant?.id, found.id))
    } catch (error) { console.error(error); setSurvey(false) }
  }, [isNew, surveyId, tenant?.id, tenant?.name, location.state, setSurvey])
  useEffect(() => { void reload() }, [reload])

  // The departments a response may be about: the survey's, and for a department only its own.
  const own = useMemo(() => new Set([...(membership?.departmentIds || []), membership?.previewDepartment].filter(Boolean)), [membership])
  const covered = useMemo(() => ((survey || null)?.departmentIds?.length ? departments.filter(item => (survey as Survey).departmentIds.includes(item.id || item.name)) : departments), [departments, survey])
  const entryDepartments = useMemo(() => (canManage || (isDemo && role === ROLES.DEMO) ? covered : covered.filter(item => own.has(item.id) || own.has(item.name))), [canManage, isDemo, role, covered, own])
  const shown = useMemo(() => filterResponses(responses, filters), [responses, filters])
  useEffect(() => setPage(1), [filters])

  if (survey === null) return <Page fill><TableSkeleton/></Page>
  if (survey === false) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Questionnaire not found' : 'Το ερωτηματολόγιο δεν βρέθηκε'}</strong></div></Page>

  const locked = !canManage
  const problems = surveyProblems(survey, language)
  async function persist(next: Survey, message?: string) {
    setSaving(true)
    try {
      const saved = await saveSurvey(tenant?.id, next)
      notify(message || (en ? 'Questionnaire saved.' : 'Το ερωτηματολόγιο αποθηκεύτηκε.'), 'success')
      if (isNew) navigate(`/quality/surveys/${saved!.id}`, { replace: true })
      else setSurvey(structuredClone(saved!))
    } catch (error) { console.error(error); notify(en ? 'The questionnaire could not be saved.' : 'Δεν ήταν δυνατή η αποθήκευση του ερωτηματολογίου.', 'error') } finally { setSaving(false) }
  }
  function save() {
    if (!survey) return
    if (!String(survey.title).trim()) { notify(en ? 'Give the questionnaire a title.' : 'Δώστε τίτλο στο ερωτηματολόγιο.', 'error'); return }
    void persist(survey)
  }
  function openSurvey() {
    if (!survey) return
    if (problems.length) { setTab('questionnaire'); notify(`${en ? 'Before opening:' : 'Πριν ανοίξει:'} ${problems.join(' · ')}`, 'error'); return }
    void persist({ ...survey, status: 'open', opensOn: survey.opensOn || hospitalToday() }, en ? 'The survey is open: share its link or print its posters.' : 'Το ερωτηματολόγιο άνοιξε: μοιραστείτε τον σύνδεσμο ή τυπώστε τις αφίσες.')
  }
  const closeSurvey = () => persist({ ...survey, status: 'closed' }, en ? 'The questionnaire is closed.' : 'Το ερωτηματολόγιο έκλεισε.')
  const reopen = () => persist({ ...survey, status: 'open', closesOn: survey.closesOn && survey.closesOn < hospitalToday() ? '' : survey.closesOn }, en ? 'The survey is open again.' : 'Το ερωτηματολόγιο άνοιξε ξανά.')
  async function remove() {
    if (!survey) return
    const ok = await confirm({ title: en ? 'Delete questionnaire' : 'Διαγραφή ερωτηματολογίου', message: en ? `The questionnaire and its ${responses.length} responses are deleted.` : `Διαγράφονται το ερωτηματολόγιο και οι ${responses.length} απαντήσεις του.`, confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })
    if (!ok) return
    try { await deleteSurvey(tenant?.id, survey.id); notify(en ? 'Questionnaire deleted.' : 'Το ερωτηματολόγιο διαγράφηκε.', 'success'); goBack() } catch (error) { console.error(error); notify(en ? 'The survey could not be deleted.' : 'Δεν ήταν δυνατή η διαγραφή.', 'error') }
  }
  async function removeResponse(response: SurveyResponse) {
    const ok = await confirm({ title: en ? 'Delete response' : 'Διαγραφή απάντησης', message: en ? 'Only for a response entered by mistake.' : 'Μόνο για απάντηση που καταχωρίστηκε κατά λάθος.', confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })
    if (!ok) return
    try { await deleteResponse(tenant?.id, response.id); setResponses(current => current.filter(item => item.id !== response.id)); setViewing(null) } catch (error) { console.error(error); notify(en ? 'The response could not be deleted.' : 'Δεν ήταν δυνατή η διαγραφή.', 'error') }
  }
  // A question below target opens a corrective action that names the survey.
  function openAction(result: SurveyQuestionResult) {
    if (!survey) return
    navigate('/quality/capas/new', { state: { qualitySource: { source: 'other', sourceId: `SRV:${survey.code}`, title: en ? `Improve: ${textOf(result.question, 'en')}` : `Βελτίωση: ${textOf(result.question, 'el')}`, description: en ? `Survey ${survey.code} «${textOf(survey, 'en')}»: ${result.satisfied}% satisfied (target ${survey.satisfiedTarget}%), ${result.count} answers.` : `Έρευνα ${survey.code} «${survey.title}»: ${result.satisfied}% ικανοποιημένοι (στόχος ${survey.satisfiedTarget}%), ${result.count} απαντήσεις.` } } })
  }
  const exportResponses = () => exportRegistry(responsesExport(survey, shown, language))

  // A new survey is one page (the questionnaire), without a strip of a single tab.
  const tabs = isNew ? [] : [
    { id: 'results', label: en ? 'Results' : 'Αποτελέσματα', icon: BarChart3 },
    { id: 'responses', label: en ? `Responses ${responses.length}` : `Απαντήσεις ${responses.length}`, icon: MessageSquareText },
    { id: 'questionnaire', label: en ? `Questions ${survey.questions.length}` : `Ερωτήσεις ${survey.questions.length}`, icon: ClipboardList },
    { id: 'collect', label: en ? 'Collection' : 'Συλλογή', icon: QrIcon },
  ]
  // Header: export of the tab on screen and, for a draft, the main command; the record's «…» (close/reopen, delete) only on
  // the Questions tab, where the questionnaire itself is (owner, 6/11/2026).
  const headerActions = <div className="row-actions">
    {!isNew && (tab === 'results' || tab === 'responses') && <ExportMenu onPrint={tab === 'results' ? () => window.print() : undefined} onExcel={exportResponses} />}
    {/* Collection: the posters of the QR codes, from the header like every other tab's export. */}
    {!isNew && tab === 'collect' && survey.departmentIds?.length > 0 && <ExportMenu items={[{ id: 'posters', kind: 'print', label: survey.departmentIds.length > 1 ? (en ? 'Print every poster' : 'Εκτύπωση όλων των αφισών') : (en ? 'Print the poster' : 'Εκτύπωση αφίσας'), onClick: () => setPrintPosters(value => value + 1) }]} />}
    {!isNew && canManage && survey.status === 'draft' && <Button disabled={saving} onClick={openSurvey}><Play size={15} />{en ? 'Open the questionnaire' : 'Άνοιγμα ερωτηματολογίου'}</Button>}
    {!isNew && canManage && tab === 'questionnaire' && survey.status === 'open' && <Button recordMenu disabled={saving} onClick={closeSurvey}><Lock size={15} />{en ? 'Close the questionnaire' : 'Κλείσιμο ερωτηματολογίου'}</Button>}
    {!isNew && canManage && tab === 'questionnaire' && survey.status === 'closed' && <Button recordMenu disabled={saving} onClick={reopen}><RotateCcw size={15} />{en ? 'Reopen the questionnaire' : 'Επανάνοιγμα ερωτηματολογίου'}</Button>}
    {!isNew && canManage && tab === 'questionnaire' && <IconButton tone="danger" label={en ? 'Delete questionnaire' : 'Διαγραφή ερωτηματολογίου'} onClick={remove}><Trash2 size={16} /></IconButton>}
  </div>
  const departmentFilter = <>
    {covered.length > 1 && <FilterSelect label={en ? 'Department' : 'Τμήμα'} value={filters.department} onChange={value => setFilters(current => ({ ...current, department: value }))}><option value="all">{en ? 'All departments' : 'Όλα τα τμήματα'}</option>{covered.map(item => <option key={item.id || item.name} value={item.id || item.name}>{en ? item.nameEn || item.name : item.name}</option>)}</FilterSelect>}
    <FilterSelect label={en ? 'Channel' : 'Τρόπος'} value={filters.channel} onChange={value => setFilters(current => ({ ...current, channel: value }))}><option value="all">{en ? 'All' : 'Όλοι'}</option>{RESPONSE_CHANNELS.map(item => <option key={item.value} value={item.value}>{item.label[en ? 1 : 0]}</option>)}</FilterSelect>
    <FilterDate label={en ? 'From' : 'Από'} value={filters.from} onChange={value => setFilters(current => ({ ...current, from: value }))} />
    <FilterDate label={en ? 'To' : 'Έως'} value={filters.to} onChange={value => setFilters(current => ({ ...current, to: value }))} />
  </>
  const advanced = ['department', 'channel'].filter(key => filters[key] !== 'all').length + (filters.from ? 1 : 0) + (filters.to ? 1 : 0)
  const filterBar = <FilterBar query={filters.query} onQueryChange={query => setFilters(current => ({ ...current, query }))} placeholder={en ? 'Search the comments…' : 'Αναζήτηση στα σχόλια…'} activeAdvancedCount={advanced} onClear={() => setFilters(NO_FILTERS)}>{departmentFilter}</FilterBar>
  const pageSize = 20
  const pages = Math.max(1, Math.ceil(shown.length / pageSize)), safePage = Math.min(page, pages)
  const overall = survey.questions.find(question => question.id === 'overall') || survey.questions.find(question => question.type === 'rating')
  const comment = survey.questions.find(question => question.type === 'text')

  return <Page fill><EntityRecordShell className="register-record-shell survey-record-shell workspace-fill" avatar={<Smile size={19} />} eyebrow={survey.code || (en ? 'New questionnaire' : 'Νέο ερωτηματολόγιο')} title={textOf(survey, language) || (en ? 'New questionnaire' : 'Νέο ερωτηματολόγιο')}
    subtitle={[audienceLabel(survey.audience, language), survey.opensOn && !survey.closesOn ? `${en ? 'From' : 'Από'} ${formatDay(survey.opensOn, language)}` : [survey.opensOn && formatDay(survey.opensOn, language), survey.closesOn && formatDay(survey.closesOn, language)].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')}
    status={!isNew && <StatusBadge tone={surveyStatusTone(survey.status)}>{surveyStatusLabel(survey.status, language)}</StatusBadge>}
    headerActions={headerActions} tabs={tabs} activeTab={tab} onTabChange={setTab} onBack={goBack}>
    {/* Results: no heading of its own (the tab says it); the figures beside the filters, the definitions in their tooltips. */}
    {tab === 'results' && <section className="record-tab-panel survey-results-panel"><div className="record-tab-panel-body">
      <FilterBar query={filters.query} onQueryChange={query => setFilters(current => ({ ...current, query }))} placeholder={en ? 'Search the comments…' : 'Αναζήτηση στα σχόλια…'} activeAdvancedCount={advanced} onClear={() => setFilters(NO_FILTERS)} end={<SurveyResultsLine survey={survey} responses={shown} language={language} />}>{departmentFilter}</FilterBar>
      <SurveyResults survey={survey} responses={shown} language={language} canAct={canManage} onAction={openAction} showLine={false} />
      {survey.code && <LinkedActions sourceId={`SRV:${survey.code}`} organizationId={tenant?.id} returnTab="results" />}
    </div></section>}
    {viewing && <ObserverDialog title={en ? 'Response' : 'Απάντηση'} subtitle={[formatDay(viewing.submittedAt, language), (en ? viewing.departmentEn : viewing.department) || '', channelLabel(viewing.channel, language)].filter(Boolean).join(' · ')} onClose={() => setViewing(null)}
      footer={canManage && <Button variant="danger" onClick={() => removeResponse(viewing)}><Trash2 size={15} />{en ? 'Delete response' : 'Διαγραφή απάντησης'}</Button>}>
      <dl className="survey-response-answers">{survey.questions.filter(question => answerText(question, viewing.answers?.[question.id], language)).map(question => <div key={question.id}><dt>{textOf(question, language)}</dt><dd>{answerText(question, viewing.answers?.[question.id], language)}</dd></div>)}</dl>
    </ObserverDialog>}
    {tab === 'responses' && <RecordTabPanel title={en ? 'Responses' : 'Απαντήσεις'} subtitle={en ? 'Anonymous: no name or details are kept.' : 'Ανώνυμες: δεν κρατείται όνομα ούτε στοιχεία.'}
      actions={<div className="row-actions">{entryDepartments.length > 0 && survey.status === 'open' && <Button onClick={() => setEntry({ departmentId: entryDepartments.length === 1 ? entryDepartments[0].id || entryDepartments[0].name : '', channel: 'paper', answers: {}, missing: [] })}><Plus size={15} />{en ? 'Enter a response' : 'Καταχώριση απάντησης'}</Button>}</div>}
      footer={shown.length > pageSize && <RegistryPagination language={language} page={safePage} totalPages={pages} totalItems={shown.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={() => {}} />}>
      {filterBar}
      <RegistryTable sortable={false} className="quality-table" rows={shown.slice((safePage - 1) * pageSize, safePage * pageSize)} rowKey={row => row.id}
        columns={[{ key: 'date', label: en ? 'Date' : 'Ημερομηνία' }, { key: 'department', label: en ? 'Department' : 'Τμήμα' }, { key: 'channel', label: en ? 'Channel' : 'Τρόπος' }, { key: 'overall', label: en ? 'Overall rating' : 'Συνολική εκτίμηση' }, { key: 'comment', label: en ? 'Comment' : 'Σχόλιο' }]}
        rowProps={row => ({ className: 'registry-row-clickable', tabIndex: 0, onClick: () => setViewing(row), onKeyDown: event => { if (event.key === 'Enter') setViewing(row) } })}
        emptyTitle={en ? 'No responses' : 'Δεν υπάρχουν απαντήσεις'} emptyText={en ? 'Answers come in through the link or QR posters; paper forms are entered here.' : 'Οι απαντήσεις έρχονται από τον σύνδεσμο ή τις αφίσες QR· τα έντυπα καταχωρίζονται εδώ.'}
        renderRow={row => <>
          <td className="nowrap-cell">{formatDay(row.submittedAt, language)}</td>
          <td>{(en ? row.departmentEn : row.department) || '—'}</td>
          <td>{channelLabel(row.channel, language)}</td>
          <td>{overall ? row.answers?.[overall.id] ?? '—' : '—'}</td>
          <td className="survey-comment-cell">{comment ? row.answers?.[comment.id] || '' : ''}</td>
        </>} />
    </RecordTabPanel>}
    {tab === 'questionnaire' && <RecordTabPanel title={en ? 'Questionnaire' : 'Ερωτηματολόγιο'} subtitle={problems.length && !locked ? `${en ? 'To open it needs:' : 'Για να ανοίξει χρειάζεται:'} ${problems.join(' · ')}` : ''}
      footer={!locked && <div className="inline-edit-footer">{isNew && <Button variant="secondary" onClick={goBack}>{en ? 'Cancel' : 'Ακύρωση'}</Button>}<SaveButton loading={saving} disabled={saving} onClick={save}>{isNew ? (en ? 'Create survey' : 'Δημιουργία ερωτηματολογίου') : (en ? 'Save' : 'Αποθήκευση')}</SaveButton></div>}>
      <SurveyEditor survey={survey} onChange={setSurvey} onTemplate={(key: string) => setSurvey(current => ({ ...surveyFromTemplate(key, { hospital: tenant?.name || '' }), departmentIds: current.departmentIds, opensOn: current.opensOn, closesOn: current.closesOn }))} isNew={isNew} locked={locked} hasResponses={responses.length > 0} departments={departments} language={language} />
    </RecordTabPanel>}
    {tab === 'collect' && <RecordTabPanel title={en ? 'Collection' : 'Συλλογή'} subtitle={en ? 'How patients reach the questionnaire from their phone.' : 'Πώς φτάνουν οι ασθενείς στο ερωτηματολόγιο από το κινητό τους.'}>
      <SurveyCollect survey={survey} departments={departments} language={language} canOpen={canManage && !saving} onOpen={openSurvey} printAll={printPosters} />
    </RecordTabPanel>}
    {entry && <ResponseEntry survey={survey} entry={entry} setEntry={setEntry} departments={entryDepartments} language={language} onSaved={(response?: SurveyResponse | null) => { setResponses(current => (response ? [response, ...current] : current)); if (!response) void reload() }} tenantId={tenant?.id} />}
  </EntityRecordShell></Page>
}

// A response typed in from a paper form, or given on a tablet at the ward.
function ResponseEntry({ survey, entry, setEntry, departments, language, onSaved, tenantId }: { survey: Survey, entry: SurveyEntry, setEntry: (entry: SurveyEntry | null) => void, departments: SurveyDepartment[], language: string, onSaved: (response?: SurveyResponse | null) => void, tenantId: string | null | undefined }) {
  const en = language === 'en'
  const { notify } = useFeedback()
  const [saving, setSaving] = useState(false)
  const set = (next: Partial<SurveyEntry>) => setEntry({ ...entry, ...next })
  async function save() {
    const missing = missingAnswers(survey.questions, entry.answers, { askDepartment: departments.length > 0, departmentId: entry.departmentId })
    if (missing.length) { set({ missing }); return }
    setSaving(true)
    try {
      const saved = await addResponse(tenantId, survey, { departmentId: entry.departmentId, channel: entry.channel, answers: entry.answers })
      notify(en ? 'Response recorded.' : 'Η απάντηση καταχωρίστηκε.', 'success')
      onSaved(saved || null)
      // The next form starts empty, in the same department and channel.
      setEntry({ departmentId: entry.departmentId, channel: entry.channel, answers: {}, missing: [] })
    } catch (error) { console.error(error); notify(en ? 'The response could not be recorded.' : 'Δεν ήταν δυνατή η καταχώριση.', 'error') } finally { setSaving(false) }
  }
  return <ObserverDialog width="wide" title={en ? 'Enter a response' : 'Καταχώριση απάντησης'} subtitle={textOf(survey, language)} onClose={() => setEntry(null)}
    footer={<><SaveButton loading={saving} disabled={saving} onClick={save}>{en ? 'Record and next' : 'Καταχώριση και επόμενη'}</SaveButton></>}>
    <div className="survey-entry-head">
      <ChoiceField label={en ? 'How it came in' : 'Πώς ήρθε'} value={entry.channel} options={RESPONSE_CHANNELS.filter(item => item.value !== 'link').map(item => ({ value: item.value, label: item.label[en ? 1 : 0] }))} onChange={value => set({ channel: value })} />
    </div>
    <SurveyForm survey={survey} answers={entry.answers} onChange={answers => set({ answers })} language={language} missing={entry.missing} departments={departments.map(item => ({ id: item.id || item.name, name: item.name, nameEn: item.nameEn }))} departmentId={entry.departmentId} onDepartment={departmentId => set({ departmentId })} askDepartment={departments.length > 0} />
  </ObserverDialog>
}
