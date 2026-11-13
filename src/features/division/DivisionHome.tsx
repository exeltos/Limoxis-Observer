import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { type LucideIcon, ArrowLeft, ArrowRight, Building2, CalendarClock, ClipboardList, GraduationCap, HandHeart, ListChecks, ShieldAlert, Syringe, UserSearch, Users } from 'lucide-react'
import { Card, CardHeader } from '../../design-system/Card'
import { Page } from '../../design-system/Page'
import { KpiCard, KpiStrip } from '../../design-system/KpiCard'
import { RegistryTable } from '../../design-system/RegistryTable'
import { StatusBadge } from '../../design-system/StatusBadge'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { Button } from '../../design-system/Button'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { RegistryEmptyState } from '../../design-system/RegistryEmptyState'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { loadDivisionInterviews, loadDivisionOverview, type DivisionDepartment, type DivisionInterview, type DivisionFigures, type DivisionOverview } from './divisionService'
import { type AttentionItem, attentionItems, categoryName, monthGenitive, monthTitle, percentStatus, percentText, rosterPill } from './divisionModel'
import { useMedia } from '../../app/useSidebarRail'
import './division.css'

// The training target of the hospital (≥ 90%) and the shown rows of the side lists.
const TRAINING_TARGET = 90
const SIDE_SHOWN = 3

// One read of the division (division_overview) for the home, «Τμήματα Διεύθυνσης» and a department's page.
export function useDivisionOverview() {
  const { tenant, divisionId } = useTenant()
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error', data: DivisionOverview | null }>({ status: 'loading', data: null })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setState(current => ({ status: 'loading', data: current.data }))
    loadDivisionOverview(tenant?.id, divisionId).then(data => { if (active) setState({ status: 'ready', data }) }).catch(() => { if (active) setState({ status: 'error', data: null }) })
    return () => { active = false }
  }, [tenant?.id, divisionId, attempt])
  return { ...state, retry: () => setAttempt(value => value + 1) }
}

const departmentPath = (id: string) => `/my-department?department=${encodeURIComponent(id)}`
const rosterPath = (id: string) => `/rosters?department=${encodeURIComponent(id)}`

function useText() {
  const { language } = useLanguage()
  const english = language === 'en'
  return { language, english, tr: (el: string, en: string) => (english ? en : el) }
}

// The four key figures of the division (or of one department).
export function DivisionKpis({ totals = {}, nextMonth, departmentCount, loading = false, error = false }: { totals?: DivisionFigures, nextMonth?: string, departmentCount?: number, loading?: boolean, error?: boolean }) {
  const { language, tr } = useText()
  const month = monthGenitive(nextMonth, language)
  const published = Number(totals.rosterPublished) || 0
  const nights = Number(totals.uncoveredNights) || 0
  return <KpiStrip className="division-kpis" label={tr('Βασικά στοιχεία της διεύθυνσης', 'Key figures of the division')}>
    <KpiCard icon={Users} label={tr('Προσωπικό', 'Staff')} value={totals.staff ?? 0} hint={tr(`${totals.staffOnLeave ?? 0} σε άδεια`, `${totals.staffOnLeave ?? 0} on leave`)} loading={loading} error={error} />
    <KpiCard icon={CalendarClock} label={tr(`Βάρδιες ${month}`, `${month} rosters`)} value={`${published}/${departmentCount ?? 0}`} status={departmentCount ? (published === departmentCount ? 'good' : 'warning') : null} statusLabel={published === departmentCount ? tr('Όλα δημοσιευμένα', 'All published') : tr('Δεν έχουν δημοσιευτεί όλα', 'Not all published')} hint={tr(`${nights} κενές νύχτες`, `${nights} open nights`)} loading={loading} error={error} />
    <KpiCard icon={GraduationCap} label={tr('Εκπαίδευση', 'Training')} value={percentText(totals.trainingPct).replace('%', '')} unit="%" target={tr(`στόχος ≥ ${TRAINING_TARGET}%`, `target ≥ ${TRAINING_TARGET}%`)} status={percentStatus(totals.trainingPct, TRAINING_TARGET)} meter={totals.trainingPct ?? null} meterTarget={TRAINING_TARGET} loading={loading} error={error} />
    {totals.fluPct == null
      ? <KpiCard icon={Syringe} label={tr('Εμβολιασμός γρίπης', 'Flu vaccination')} value="—" hint={tr('Δεν υπάρχουν καταγραφές', 'No records')} loading={loading} error={error} />
      : <KpiCard icon={Syringe} label={tr('Εμβολιασμός γρίπης', 'Flu vaccination')} value={percentText(totals.fluPct).replace('%', '')} unit="%" meter={totals.fluPct} loading={loading} error={error} />}
  </KpiStrip>
}

// «Τμήματα που εποπτεύω»: one row per department; a row opens the department (read only).
export function DivisionDepartmentsTable({ departments = [], nextMonth, loading = false, error = false, onRetry }: { departments?: DivisionDepartment[], nextMonth?: string, loading?: boolean, error?: boolean, onRetry?: () => void }) {
  const { language, tr } = useText()
  const navigate = useNavigate()
  const month = monthGenitive(nextMonth, language)
  const columns = [
    { key: 'name', label: tr('Τμήμα', 'Department') },
    { key: 'staff', label: tr('Προσωπικό', 'Staff'), className: 'division-number' },
    { key: 'rosterNextMonth', label: tr(`Βάρδιες ${month}`, `${month} roster`), sortable: false },
    { key: 'pendingRequests', label: tr('Αιτήματα', 'Requests'), className: 'division-number' },
    { key: 'trainingPct', label: tr('Εκπαίδευση', 'Training'), className: 'division-number' },
    { key: 'fluPct', label: tr('Γρίπη', 'Flu'), className: 'division-number' },
    { key: 'handHygienePct', label: tr('Υγιεινή χεριών', 'Hand hygiene'), className: 'division-number' },
    { key: 'falls30', label: <>{tr('Πτώσεις / Κατακλίσεις', 'Falls / Pressure ulcers')}<br />{tr('30 ημ.', '30 days')}</>, ariaLabel: tr('Πτώσεις / Κατακλίσεις 30 ημ.', 'Falls / Pressure ulcers 30 days'), className: 'division-number', sortValue: (row: DivisionDepartment) => (Number(row.falls30) || 0) + (Number(row.pressureUlcers30) || 0) },
  ]
  return <RegistryTable className="division-table" columns={columns} rows={departments} rowKey={row => row.id} loading={loading} error={error} onRetry={onRetry}
    emptyTitle={tr('Δεν υπάρχουν ακόμα τμήματα στη διεύθυνση', 'The division has no departments yet')}
    emptyText={tr('Ο διαχειριστής ορίζει τα τμήματα κάθε διεύθυνσης στις Συνεντεύξεις › Διευθύνσεις.', 'The administrator sets each division’s departments in Interviews › Divisions.')}
    rowProps={row => ({ className: 'registry-row-clickable', tabIndex: 0, title: tr(`Άνοιγμα: ${row.name}`, `Open: ${row.name}`), onClick: () => navigate(departmentPath(row.id)), onKeyDown: event => { if (event.key === 'Enter') navigate(departmentPath(row.id)) } })}
    renderRow={row => {
      const [pill, tone] = rosterPill(row, language)
      const waiting = Number(row.pendingRequestsOver3Days) || 0
      return <>
        <td><strong>{row.name}</strong></td>
        <td className="division-number">{row.staff ?? 0}</td>
        <td><StatusBadge tone={tone}>{pill}</StatusBadge></td>
        <td className="division-number"><span className="division-requests">{row.pendingRequests ?? 0}{waiting > 0 && <small className="division-late" title={tr('Περιμένουν πάνω από 3 ημέρες', 'Waiting over 3 days')}>{tr(`${waiting} καθυστερούν`, `${waiting} late`)}</small>}</span></td>
        <td className={`division-number is-${percentStatus(row.trainingPct, TRAINING_TARGET) || 'none'}`}>{percentText(row.trainingPct)}</td>
        <td className="division-number" title={row.fluPct == null ? tr('Δεν υπάρχουν καταγραφές', 'No records') : undefined}>{percentText(row.fluPct)}</td>
        <td className="division-number">{percentText(row.handHygienePct)}</td>
        <td className="division-number">{row.falls30 ?? 0} / {row.pressureUlcers30 ?? 0}</td>
      </>
    }} />
}

// The division's title and subtitle: «8 τμήματα · Νοσηλευτικό, Ιατρικό · Νοέμβριος 2026».
function divisionHeading(data: DivisionOverview | null, language: string) {
  const english = language === 'en'
  const count = data?.departments?.length || 0
  const categories = (data?.division?.categories || []).map((key: string) => categoryName(key, language)).filter(Boolean)
  return {
    title: data?.division?.name || (english ? 'My division' : 'Η διεύθυνσή μου'),
    subtitle: [english ? `${count} ${count === 1 ? 'department' : 'departments'}` : `${count} ${count === 1 ? 'τμήμα' : 'τμήματα'}`, categories.join(', '), monthTitle(undefined, language)].filter(Boolean).join(' · '),
  }
}

// «Διεύθυνση ▾»: a director of more than one division chooses which one (in a preview the role picker does).
function DivisionSwitch({ divisions = [] }: { divisions?: Array<{ id: string, name: string }> }) {
  const { tr } = useText()
  const { divisionId, selectDivision, isRolePreview } = useTenant()
  if (isRolePreview || divisions.length < 2 || !selectDivision) return null
  return <div className="division-switch"><SearchableSelect label={tr('Διεύθυνση', 'Division')} value={divisionId || divisions[0]?.id || ''} options={divisions.map(item => ({ value: item.id, label: item.name }))} onChange={value => value && selectDivision(value)} /></div>
}

// The Division Director's home. weekCard: the calendar's «Επόμενες 7 ημέρες» of the home page.
export function DivisionHome({ weekCard = null }: { weekCard?: ReactNode }) {
  const { language, english, tr } = useText()
  const navigate = useNavigate()
  const { tenant } = useTenant()
  const { status, data, retry } = useDivisionOverview()
  const loading = status === 'loading' && !data
  const departments = data?.departments || []
  const heading = divisionHeading(data, language)
  const attention = attentionItems(departments, data?.nextMonth, language)
  const [allAttention, setAllAttention] = useState(false)
  const categoryKey = (data?.division?.categories || []).join(',')
  const [interviews, setInterviews] = useState<DivisionInterview[] | null>(null)
  useEffect(() => {
    let active = true
    if (!data?.division) { setInterviews([]); return () => { active = false } }
    loadDivisionInterviews(tenant?.id, categoryKey ? categoryKey.split(',') : []).then(rows => { if (active) setInterviews(rows) }).catch(() => { if (active) setInterviews([]) })
    return () => { active = false }
  }, [tenant?.id, data?.division, categoryKey])
  const openAttention = (item: AttentionItem) => navigate(item.to === 'training' ? '/training' : rosterPath(item.departmentId))
  const when = (value: string) => new Intl.DateTimeFormat(english ? 'en-GB' : 'el-GR', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Athens' }).format(new Date(value))
  const shownAttention = allAttention ? attention : attention.slice(0, SIDE_SHOWN)
  // A wide screen keeps the home in one view; a tablet lays the side cards in a row under the table and scrolls.
  const wide = useMedia('(min-width:1181px)')

  if (status === 'ready' && !data?.division) return <Page fill className="dashboard-page division-page" title={heading.title} subtitle={tr('Αρχική', 'Home')}>
    <Card className="dashboard-card"><RegistryEmptyState icon={Building2} title={tr('Δεν σας έχει ανατεθεί ακόμα διεύθυνση', 'No division has been assigned to you yet')} text={tr('Ο διαχειριστής σάς ορίζει διευθυντή μιας διεύθυνσης στις Συνεντεύξεις › Διευθύνσεις.', 'The administrator makes you the director of a division in Interviews › Divisions.')} /></Card>
  </Page>

  return <Page fill={wide} className="dashboard-page division-page" title={heading.title} subtitle={heading.subtitle} actions={<DivisionSwitch divisions={data?.divisions} />}>
    <DivisionKpis totals={data?.totals} nextMonth={data?.nextMonth} departmentCount={departments.length} loading={loading} error={status === 'error'} />
    <div className="division-home">
      <Card className="dashboard-card division-departments" id="division-departments" tabIndex={-1}>
        <CardHeader icon={Building2} title={tr('Τμήματα που εποπτεύω', 'Departments I oversee')} subtitle={tr('Επιλέξτε τμήμα για να δείτε την εικόνα του.', 'Choose a department to see its overview.')} />
        <DivisionDepartmentsTable departments={departments} nextMonth={data?.nextMonth} loading={loading} error={status === 'error'} onRetry={retry} />
      </Card>
      <div className="division-side">
        <Card className="dashboard-card">
          <CardHeader icon={ShieldAlert} title={tr('Χρειάζονται προσοχή', 'Need attention')} subtitle={attention.length ? tr('Τα πιο επείγοντα πρώτα.', 'The most urgent first.') : undefined} />
          {loading ? <TableSkeleton /> : attention.length ? <div className="task-list">{shownAttention.map(item => <button type="button" className="task-row" key={item.key} onClick={() => openAttention(item)}><span className={`priority ${item.tone === 'danger' ? 'high' : item.tone === 'warning' ? 'medium' : 'low'}`} /><span className="task-copy"><strong>{item.title}</strong></span>{item.count != null && <b className={`task-count${item.tone === 'danger' ? ' urgent' : ''}`}>{item.count}</b>}<ArrowRight size={17} /></button>)}</div> : <div className="inline-empty">{tr('Όλα είναι σε τάξη στα τμήματά σας.', 'All is in order in your departments.')}</div>}
          {attention.length > SIDE_SHOWN && <button type="button" className="text-button dashboard-more" onClick={() => setAllAttention(value => !value)}>{allAttention ? tr('Λιγότερα', 'Fewer') : tr(`Όλα (${attention.length})`, `All (${attention.length})`)}</button>}
        </Card>
        <Card className="dashboard-card dashboard-week">
          <CardHeader icon={UserSearch} title={tr('Επόμενες συνεντεύξεις', 'Upcoming interviews')} actions={<button type="button" className="text-button" onClick={() => navigate('/interviews')}>{tr('Υποψήφιοι', 'Candidates')}<ArrowRight size={14} /></button>} />
          {interviews === null ? <TableSkeleton /> : interviews.length ? <div className="dashboard-week-list">{interviews.slice(0, SIDE_SHOWN).map(item => <button type="button" key={item.id} onClick={() => navigate('/interviews')}><span className="dashboard-week-day">{when(item.scheduledAt)}</span><span className="dashboard-week-copy"><strong>{item.name}</strong><small>{item.position || '—'}</small></span></button>)}</div> : <div className="inline-empty">{tr('Δεν έχουν προγραμματιστεί συνεντεύξεις.', 'No interviews are scheduled.')}</div>}
        </Card>
        {weekCard}
      </div>
    </div>
  </Page>
}

// «Τμήματα Διεύθυνσης» (menu): the departments of the division, one row each.
export function DivisionDepartmentsPage() {
  const { language, tr } = useText()
  const { status, data, retry } = useDivisionOverview()
  const heading = divisionHeading(data, language)
  return <Page fill className="dashboard-page division-page" title={tr('Τμήματα Διεύθυνσης', 'Division departments')} subtitle={data?.division ? `${heading.title} · ${heading.subtitle}` : undefined} actions={<DivisionSwitch divisions={data?.divisions} />}>
    <Card className="dashboard-card division-departments">
      <DivisionDepartmentsTable departments={data?.departments || []} nextMonth={data?.nextMonth} loading={status === 'loading' && !data} error={status === 'error'} onRetry={retry} />
    </Card>
  </Page>
}

// A department of the division, read only (from «Τμήματα που εποπτεύω»): its figures and where to read more.
export function DivisionDepartmentView({ departmentId }: { departmentId: string }) {
  const { language, tr } = useText()
  const navigate = useNavigate()
  const { status, data, retry } = useDivisionOverview()
  const row = (data?.departments || []).find(item => String(item.id) === String(departmentId)) || null
  const loading = status === 'loading' && !data
  const back = <Button variant="secondary" onClick={() => navigate('/')}><ArrowLeft size={15} aria-hidden="true" />{tr('Αρχική', 'Home')}</Button>
  if (!loading && !row) return <Page fill className="dashboard-page division-page" title={tr('Τμήμα', 'Department')} actions={back}>
    <Card className="dashboard-card">{status === 'error' ? <RegistryEmptyState error onRetry={retry} /> : <RegistryEmptyState icon={Building2} title={tr('Το τμήμα δεν ανήκει στη διεύθυνσή σας', 'The department is not in your division')} text={tr('Επιλέξτε ένα τμήμα από την Αρχική.', 'Choose a department from Home.')} />}</Card>
  </Page>
  const [pill, tone] = rosterPill(row, language)
  const month = monthGenitive(data?.nextMonth, language)
  const links: Array<[LucideIcon, string, string]> = [
    [CalendarClock, tr('Πρόγραμμα βαρδιών', 'Shift roster'), rosterPath(departmentId)],
    [Users, tr('Προσωπικό', 'Staff'), '/employees'],
    [GraduationCap, tr('Εκπαίδευση', 'Training'), '/training'],
    [ClipboardList, tr('Μητρώα', 'Registers'), '/registers'],
    [ListChecks, tr('Έλεγχοι', 'Controls'), '/controls'],
  ]
  return <Page fill className="dashboard-page division-page" title={row?.name || tr('Τμήμα', 'Department')} subtitle={[data?.division?.name, tr('μόνο ανάγνωση', 'read only')].filter(Boolean).join(' · ')} actions={back}>
    <DivisionKpis totals={{ ...(row || {}), rosterPublished: row?.rosterNextMonth === 'published' ? 1 : 0 }} nextMonth={data?.nextMonth} departmentCount={1} loading={loading} />
    {row && <div className="division-home">
      <Card className="dashboard-card">
        <CardHeader icon={ShieldAlert} title={tr('Εικόνα του τμήματος', 'Department overview')} subtitle={tr('Τελευταίες 30 ημέρες', 'Last 30 days')} />
        <dl className="division-facts">
          <div><dt>{tr(`Βάρδιες ${month}`, `${month} roster`)}</dt><dd><StatusBadge tone={tone}>{pill}</StatusBadge></dd></div>
          <div><dt>{tr('Αιτήματα σε αναμονή', 'Pending requests')}</dt><dd>{row.pendingRequests ?? 0}{Number(row.pendingRequestsOver3Days) > 0 && ` · ${row.pendingRequestsOver3Days} ${tr('πάνω από 3 ημέρες', 'over 3 days')}`}</dd></div>
          <div><dt>{tr('Εκπαιδεύσεις που λήγουν σε 30 ημέρες', 'Training expiring within 30 days')}</dt><dd>{row.trainingExpiring30 ?? 0}</dd></div>
          <div><dt><HandHeart size={14} aria-hidden="true" /> {tr('Υγιεινή χεριών', 'Hand hygiene')}</dt><dd>{percentText(row.handHygienePct)}</dd></div>
          <div><dt>{tr('Πτώσεις', 'Falls')}</dt><dd>{row.falls30 ?? 0}</dd></div>
          <div><dt>{tr('Κατακλίσεις', 'Pressure ulcers')}</dt><dd>{row.pressureUlcers30 ?? 0}</dd></div>
          <div><dt>{tr('Ανοιχτά συμβάντα', 'Open incidents')}</dt><dd>{row.incidentsOpen ?? 0}</dd></div>
        </dl>
      </Card>
      <Card className="dashboard-card">
        <CardHeader icon={ArrowRight} title={tr('Δείτε αναλυτικά', 'See in detail')} subtitle={tr('Οι οθόνες ανοίγουν μόνο για ανάγνωση.', 'The screens open read only.')} />
        <div className="dashboard-week-list division-links">{links.map(([Icon, label, to]) => <button type="button" key={to} onClick={() => navigate(to)}><span className="dashboard-week-day"><Icon size={16} aria-hidden="true" /></span><span className="dashboard-week-copy"><strong>{label}</strong></span></button>)}</div>
      </Card>
    </div>}
  </Page>
}
