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
import { RESPONSE_CHANNELS, audienceLabel, channelLabel, filterResponses, responsesExport, surveyFromTemplate, surveyProblems, surveyStatusLabel, surveyStatusTone, textOf } from './surveyModel'
import { SurveyResults } from './SurveyResults'
import { SurveyCollect } from './SurveyCollect'
import { SurveyEditor } from './SurveyEditor'
import { SurveyForm, missingAnswers } from './SurveyForm'
import '../quality.css'
import './surveys.css'

const NO_FILTERS = { query: '', department: 'all', channel: 'all', from: '', to: '' }

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
  const [survey, setSurvey] = useState(null)
  const [responses, setResponses] = useState([])
  const [tab, setTab] = useState(isNew ? 'questionnaire' : 'results')
  const [saving, setSaving] = useState(false)
  const [filters, setFilters] = useState(NO_FILTERS)
  const [entry, setEntry] = useState(null)
  const [page, setPage] = useState(1)

  const reload = useCallback(async () => {
    if (isNew) { setSurvey(surveyFromTemplate(location.state?.template || 'wards', { hospital: tenant?.name || '' })); return }
    try {
      const found = await loadSurvey(tenant?.id, surveyId)
      setSurvey(found ? structuredClone(found) : false)
      if (found) setResponses(await loadResponses(tenant?.id, found.id))
    } catch (error) { console.error(error); setSurvey(false) }
  }, [isNew, surveyId, tenant?.id, tenant?.name, location.state])
  useEffect(() => { void reload() }, [reload])

  // The departments a response may be about: the survey's, and for a department only its own.
  const own = useMemo(() => new Set([...(membership?.departmentIds || []), membership?.previewDepartment].filter(Boolean)), [membership])
  const covered = useMemo(() => (survey?.departmentIds?.length ? departments.filter(item => survey.departmentIds.includes(item.id || item.name)) : departments), [departments, survey])
  const entryDepartments = useMemo(() => (canManage || (isDemo && role === ROLES.DEMO) ? covered : covered.filter(item => own.has(item.id) || own.has(item.name))), [canManage, isDemo, role, covered, own])
  const shown = useMemo(() => filterResponses(responses, filters), [responses, filters])
  useEffect(() => setPage(1), [filters])

  if (survey === null) return <Page fill><div className="inline-empty">{en ? 'Loading…' : 'Φόρτωση…'}</div></Page>
  if (survey === false) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Survey not found' : 'Η έρευνα δεν βρέθηκε'}</strong></div></Page>

  const locked = !canManage
  const problems = surveyProblems(survey, language)
  async function persist(next, message) {
    setSaving(true)
    try {
      const saved = await saveSurvey(tenant?.id, next)
      notify(message || (en ? 'Survey saved.' : 'Η έρευνα αποθηκεύτηκε.'), 'success')
      if (isNew) navigate(`/quality/surveys/${saved.id}`, { replace: true })
      else setSurvey(structuredClone(saved))
    } catch (error) { console.error(error); notify(en ? 'The survey could not be saved.' : 'Δεν ήταν δυνατή η αποθήκευση της έρευνας.', 'error') } finally { setSaving(false) }
  }
  function save() {
    if (!String(survey.title).trim()) { notify(en ? 'Give the survey a title.' : 'Δώστε τίτλο στην έρευνα.', 'error'); return }
    void persist(survey)
  }
  function openSurvey() {
    if (problems.length) { setTab('questionnaire'); notify(`${en ? 'Before opening:' : 'Πριν ανοίξει:'} ${problems.join(' · ')}`, 'error'); return }
    void persist({ ...survey, status: 'open', opensOn: survey.opensOn || new Date().toISOString().slice(0, 10) }, en ? 'The survey is open: share its link or print its posters.' : 'Η έρευνα άνοιξε: μοιραστείτε τον σύνδεσμο ή τυπώστε τις αφίσες.')
  }
  const closeSurvey = () => persist({ ...survey, status: 'closed' }, en ? 'The survey is closed.' : 'Η έρευνα έκλεισε.')
  const reopen = () => persist({ ...survey, status: 'open', closesOn: survey.closesOn && survey.closesOn < new Date().toISOString().slice(0, 10) ? '' : survey.closesOn }, en ? 'The survey is open again.' : 'Η έρευνα άνοιξε ξανά.')
  async function remove() {
    const ok = await confirm({ title: en ? 'Delete survey' : 'Διαγραφή έρευνας', message: en ? `The survey and its ${responses.length} responses are deleted.` : `Διαγράφονται η έρευνα και οι ${responses.length} απαντήσεις της.`, confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })
    if (!ok) return
    try { await deleteSurvey(tenant?.id, survey.id); notify(en ? 'Survey deleted.' : 'Η έρευνα διαγράφηκε.', 'success'); goBack() } catch (error) { console.error(error); notify(en ? 'The survey could not be deleted.' : 'Δεν ήταν δυνατή η διαγραφή.', 'error') }
  }
  async function removeResponse(response) {
    const ok = await confirm({ title: en ? 'Delete response' : 'Διαγραφή απάντησης', message: en ? 'Only for a response entered by mistake.' : 'Μόνο για απάντηση που καταχωρίστηκε κατά λάθος.', confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })
    if (!ok) return
    try { await deleteResponse(tenant?.id, response.id); setResponses(current => current.filter(item => item.id !== response.id)) } catch (error) { console.error(error); notify(en ? 'The response could not be deleted.' : 'Δεν ήταν δυνατή η διαγραφή.', 'error') }
  }
  // A question below target opens a corrective action that names the survey.
  function openAction(result) {
    navigate('/quality/capas/new', { state: { qualitySource: { source: 'other', sourceId: `SRV:${survey.code}`, title: en ? `Improve: ${textOf(result.question, 'en')}` : `Βελτίωση: ${textOf(result.question, 'el')}`, description: en ? `Survey ${survey.code} «${textOf(survey, 'en')}»: ${result.satisfied}% satisfied (target ${survey.satisfiedTarget}%), ${result.count} answers.` : `Έρευνα ${survey.code} «${survey.title}»: ${result.satisfied}% ικανοποιημένοι (στόχος ${survey.satisfiedTarget}%), ${result.count} απαντήσεις.` } } })
  }
  const exportResponses = () => exportRegistry(responsesExport(survey, shown, language))

  const tabs = isNew ? [{ id: 'questionnaire', label: en ? 'Questionnaire' : 'Ερωτηματολόγιο', icon: ClipboardList }] : [
    { id: 'results', label: en ? 'Results' : 'Αποτελέσματα', icon: BarChart3 },
    { id: 'responses', label: en ? `Responses ${responses.length}` : `Απαντήσεις ${responses.length}`, icon: MessageSquareText },
    { id: 'questionnaire', label: en ? `Questionnaire ${survey.questions.length}` : `Ερωτηματολόγιο ${survey.questions.length}`, icon: ClipboardList },
    { id: 'collect', label: en ? 'Collection' : 'Συλλογή', icon: QrIcon },
  ]
  const headerActions = <div className="row-actions">
    {!isNew && canManage && survey.status === 'draft' && <Button disabled={saving} onClick={openSurvey}><Play size={15} />{en ? 'Open the survey' : 'Άνοιγμα έρευνας'}</Button>}
    {!isNew && canManage && survey.status === 'open' && <Button variant="secondary" disabled={saving} onClick={closeSurvey}><Lock size={15} />{en ? 'Close' : 'Κλείσιμο'}</Button>}
    {!isNew && canManage && survey.status === 'closed' && <Button variant="secondary" disabled={saving} onClick={reopen}><RotateCcw size={15} />{en ? 'Reopen' : 'Επανάνοιγμα'}</Button>}
    {!isNew && canManage && <IconButton tone="danger" label={en ? 'Delete survey' : 'Διαγραφή έρευνας'} onClick={remove}><Trash2 size={16} /></IconButton>}
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

  return <Page fill><EntityRecordShell className="register-record-shell survey-record-shell workspace-fill" avatar={<Smile size={19} />} eyebrow={survey.code || (en ? 'New survey' : 'Νέα έρευνα')} title={textOf(survey, language) || (en ? 'New survey' : 'Νέα έρευνα')}
    subtitle={[audienceLabel(survey.audience, language), [survey.opensOn && formatDay(survey.opensOn, language), survey.closesOn && formatDay(survey.closesOn, language)].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')}
    status={!isNew && <StatusBadge tone={surveyStatusTone(survey.status)}>{surveyStatusLabel(survey.status, language)}</StatusBadge>}
    headerActions={headerActions} tabs={tabs} activeTab={tab} onTabChange={setTab} onBack={goBack}>
    {tab === 'results' && <RecordTabPanel title={en ? 'Results' : 'Αποτελέσματα'} subtitle={en ? 'Satisfied = share answering 4 or 5. Recommendation score = promoters (9–10) minus detractors (0–6).' : 'Ικανοποιημένοι = ποσοστό που απαντά 4 ή 5. Δείκτης σύστασης = υποστηρικτές (9–10) μείον επικριτές (0–6).'} actions={<ExportMenu onPrint={()=>window.print()} onExcel={exportResponses} />}>
      {filterBar}
      <SurveyResults survey={survey} responses={shown} language={language} canAct={canManage} onAction={openAction} />
    </RecordTabPanel>}
    {tab === 'responses' && <RecordTabPanel title={en ? 'Responses' : 'Απαντήσεις'} subtitle={en ? 'Anonymous: no name or details are kept.' : 'Ανώνυμες: δεν κρατείται όνομα ούτε στοιχεία.'}
      actions={<div className="row-actions"><ExportMenu onExcel={exportResponses} />{entryDepartments.length > 0 && survey.status === 'open' && <Button onClick={() => setEntry({ departmentId: entryDepartments.length === 1 ? entryDepartments[0].id || entryDepartments[0].name : '', channel: 'paper', answers: {}, missing: [] })}><Plus size={15} />{en ? 'Enter a response' : 'Καταχώριση απάντησης'}</Button>}</div>}
      footer={shown.length > pageSize && <RegistryPagination language={language} page={safePage} totalPages={pages} totalItems={shown.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={() => {}} />}>
      {filterBar}
      <RegistryTable className="quality-table" rows={shown.slice((safePage - 1) * pageSize, safePage * pageSize)} rowKey={row => row.id}
        columns={[{ key: 'date', label: en ? 'Date' : 'Ημερομηνία' }, { key: 'department', label: en ? 'Department' : 'Τμήμα' }, { key: 'channel', label: en ? 'Channel' : 'Τρόπος' }, { key: 'overall', label: overall ? textOf(overall, language) : '—' }, { key: 'comment', label: en ? 'Comment' : 'Σχόλιο' }, { key: 'actions', label: '' }]}
        emptyTitle={en ? 'No responses' : 'Δεν υπάρχουν απαντήσεις'} emptyText={en ? 'Answers come in through the link or QR posters; paper forms are entered here.' : 'Οι απαντήσεις έρχονται από τον σύνδεσμο ή τις αφίσες QR· τα έντυπα καταχωρίζονται εδώ.'}
        renderRow={row => <>
          <td className="nowrap-cell">{formatDay(row.submittedAt, language)}</td>
          <td>{(en ? row.departmentEn : row.department) || '—'}</td>
          <td>{channelLabel(row.channel, language)}</td>
          <td>{overall ? row.answers?.[overall.id] ?? '—' : '—'}</td>
          <td className="survey-comment-cell">{comment ? row.answers?.[comment.id] || '' : ''}</td>
          <td>{canManage && <IconButton size="sm" tone="danger" label={en ? 'Delete response' : 'Διαγραφή απάντησης'} onClick={() => removeResponse(row)}><Trash2 size={14} /></IconButton>}</td>
        </>} />
    </RecordTabPanel>}
    {tab === 'questionnaire' && <RecordTabPanel title={en ? 'Questionnaire' : 'Ερωτηματολόγιο'} subtitle={problems.length && !locked ? `${en ? 'To open it needs:' : 'Για να ανοίξει χρειάζεται:'} ${problems.join(' · ')}` : ''}
      footer={!locked && <div className="inline-edit-footer"><SaveButton loading={saving} disabled={saving} onClick={save}>{isNew ? (en ? 'Create survey' : 'Δημιουργία έρευνας') : (en ? 'Save' : 'Αποθήκευση')}</SaveButton></div>}>
      <SurveyEditor survey={survey} onChange={setSurvey} onTemplate={key => setSurvey(current => ({ ...surveyFromTemplate(key, { hospital: tenant?.name || '' }), departmentIds: current.departmentIds, opensOn: current.opensOn, closesOn: current.closesOn }))} isNew={isNew} locked={locked} hasResponses={responses.length > 0} departments={departments} language={language} />
    </RecordTabPanel>}
    {tab === 'collect' && <RecordTabPanel title={en ? 'Collection' : 'Συλλογή'} subtitle={en ? 'How patients reach the questionnaire from their phone.' : 'Πώς φτάνουν οι ασθενείς στο ερωτηματολόγιο από το κινητό τους.'}>
      <SurveyCollect survey={survey} departments={departments} language={language} canOpen={canManage && !saving} onOpen={openSurvey} />
    </RecordTabPanel>}
    {entry && <ResponseEntry survey={survey} entry={entry} setEntry={setEntry} departments={entryDepartments} language={language} onSaved={response => { setResponses(current => (response ? [response, ...current] : current)); if (!response) void reload() }} tenantId={tenant?.id} />}
  </EntityRecordShell></Page>
}

// A response typed in from a paper form, or given on a tablet at the ward.
function ResponseEntry({ survey, entry, setEntry, departments, language, onSaved, tenantId }) {
  const en = language === 'en'
  const { notify } = useFeedback()
  const [saving, setSaving] = useState(false)
  const set = next => setEntry(current => ({ ...current, ...next }))
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
