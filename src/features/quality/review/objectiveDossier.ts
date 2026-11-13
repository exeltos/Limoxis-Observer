import { formatDay } from '../../../core/i18n/formatDay'
import { escapeHtml, type ReportDoc, type ReportSection } from '../../../core/export/reportDocument'
import { roleTitleText } from '../../../core/i18n/roleTitles'
import { loadEntries } from '../../registers/registerService'
import { monthlySeries } from '../../registers/registerEngine'
import { formatObjectiveValue, objectiveState, objectiveValueText } from './reviewTemplate'
import { objectiveLevelText, objectiveMeasureSource, objectiveMeasureText, objectiveStateLabel, objectiveTitle } from './QualityObjectives'
import { monthsSoFar, objectiveLevel, planStatusLabel, platformMonthlyValues } from './objectiveSources'
import { loadRegisterIndicators, missingDataTable, registerIndicatorSections } from './dossierIndicators'
import { loadResponses, loadSurveys } from '../surveys/surveyService'
import { surveySummary } from '../surveys/surveyModel'
import type { CommitteeTarget, DossierIndicatorRow, ObjectiveHistoryPoint, ObjectiveListRow, ObjectiveView, PlatformIndicatorDef, Review } from './reviewTypes'
import type { Survey, SurveyResponse } from '../surveys/surveyModel'
import type { Register, RegisterEntry } from '../../registers/registerTypes'

// The year's objectives as a file for the auditor (ISO 9001 §6.2 and §9.3): each objective with its owner and date, how it is measured,
// its value and status (no months: a summary), then what the last management review decided.
const monthName = (year: number, month: number, en: boolean) => new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
const sign = (objective: Pick<ObjectiveView, 'direction'>) => (objective.direction === 'lower' ? '≤' : '≥')

// The months of the year so far, with the value, for every objective: from its register's indicator, from the platform's
// indicator (the hospital's data of each month) or the values its owner entered.
export async function loadObjectiveHistories(organizationId: string | null | undefined, objectives: ObjectiveView[], definitions: PlatformIndicatorDef[] = []) {
  const histories = new Map<string, ObjectiveHistoryPoint[]>()
  const byRegister = new Map<string, Register>()
  for (const objective of objectives || []) if (objective.register && objective.indicator) byRegister.set(objective.register.id, objective.register)
  const entries = new Map(await Promise.all([...byRegister.values()].map(async (register): Promise<[string, RegisterEntry[]]> => [register.id, await loadEntries(organizationId, register.id, { register }).catch(() => [])])))
  const platformByYear = new Map<number, Set<string>>()
  for (const objective of objectives || []) if (objective.platformIndicator) { const keys = platformByYear.get(objective.year) || new Set(); keys.add(objective.platformIndicator.id); platformByYear.set(objective.year, keys) }
  const platform = new Map<number, Awaited<ReturnType<typeof platformMonthlyValues>>>()
  for (const [year, keys] of platformByYear) platform.set(year, await platformMonthlyValues(organizationId, definitions.length ? definitions : (objectives || []).map(item => item.platformIndicator).filter(Boolean) as PlatformIndicatorDef[], year, [...keys]))
  for (const objective of objectives || []) {
    const last = monthsSoFar(objective.year)
    if (objective.register && objective.indicator) histories.set(objective.id, monthlySeries(objective.register, objective.indicator, entries.get(objective.register.id) || [], objective.year).filter(row => row.month <= last && row.value != null))
    else if (objective.platformIndicator) histories.set(objective.id, (platform.get(objective.year) || []).map(row => ({ month: row.month, value: row.values.get((objective.platformIndicator as PlatformIndicatorDef).id) ?? null })).filter(row => row.value != null))
    else histories.set(objective.id, (objective.months || []).map(row => ({ month: Number(row.month.slice(5, 7)), value: row.value })))
  }
  return histories
}

// The chart of the months as inline SVG (a document has no scripts): the line, the target dashed, the last point marked.
export function historyChartHtml(objective: Pick<ObjectiveView, 'target'>, history: ObjectiveHistoryPoint[], language: string) {
  if (!history || history.length < 2) return ''
  const width = 560, height = 110, pad = 8
  const target = Number.isFinite(Number(objective.target)) && objective.target !== '' ? Number(objective.target) : null
  const values = [...history.map(row => Number(row.value)), ...(target == null ? [] : [target])]
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1
  const x = (index: number) => pad + (index * (width - pad * 2)) / Math.max(1, history.length - 1)
  const y = (value: unknown) => pad + (1 - (Number(value) - min) / span) * (height - pad * 2)
  const line = history.map((row, index: number) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(row.value).toFixed(1)}`).join(' ')
  const last = history.length - 1
  const caption = language === 'en' ? 'Value by month' : 'Τιμή ανά μήνα'
  return `<figure style="margin:6px 0"><figcaption style="font-size:8pt;color:#5d7083;text-transform:uppercase">${caption}</figcaption><svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${caption}">${target == null ? '' : `<line x1="${pad}" x2="${width - pad}" y1="${y(target).toFixed(1)}" y2="${y(target).toFixed(1)}" stroke="#9aa9b8" stroke-dasharray="4 3"/>`}<path d="${line}" fill="none" stroke="#2f5f9e" stroke-width="2"/><circle cx="${x(last).toFixed(1)}" cy="${y(history[last].value).toFixed(1)}" r="3.5" fill="#fff" stroke="#2f5f9e" stroke-width="2"/></svg></figure>`
}

// One objective's section: the facts, the chart and the months.
export function objectiveSection(objective: ObjectiveView, history: ObjectiveHistoryPoint[], language: string) {
  const en = language === 'en'
  const unit = objective.unit
  const state = objective.current.status
  return {
    title: `${objective.code} · ${objectiveTitle(objective, language)}`,
    facts: [
      [en ? 'Level' : 'Επίπεδο', objectiveLevelText(objective, language)],
      [en ? 'Measured by' : 'Μετριέται με', `${objectiveMeasureText(objective, language)} (${objectiveMeasureSource(objective, language)})`],
      [en ? 'Target' : 'Στόχος', `${sign(objective)} ${formatObjectiveValue(objective.target, unit, language)}`],
      [en ? 'Value today' : 'Τιμή σήμερα', formatObjectiveValue(objective.current.value, unit, language)],
      [en ? 'Status' : 'Κατάσταση', objectiveStateLabel(state, en)],
      [en ? 'Owner' : 'Υπεύθυνος', roleTitleText(objective.ownerLabel, language) || '—'],
      [en ? 'Due' : 'Προθεσμία', objective.dueDate ? formatDay(objective.dueDate, language) : '—'],
    ],
    html: historyChartHtml(objective, history, language),
    table: history?.length ? { columns: [en ? 'Month' : 'Μήνας', en ? 'Value' : 'Τιμή', en ? 'Status' : 'Κατάσταση'], rows: history.map(row => [monthName(objective.year, row.month, en), formatObjectiveValue(row.value, unit, language), { text: objectiveStateLabel(objectiveState(objective, row.value), en), className: objectiveState(objective, row.value) === 'missed' ? 'rd-bad' : 'rd-good' }]) } : undefined,
  }
}

// The rest of the year's file: the department registers' indicators for the year so far and the satisfaction surveys of the year.
export async function loadDossierExtras(organizationId: string | null | undefined, year: number) {
  // The platform's own indicators (infections, microbiology, controls) are not in this file: each has its own report.
  const [registerRows, surveys] = await Promise.all([
    loadRegisterIndicators(organizationId, year).catch(() => []),
    loadSurveys(organizationId).catch(() => []),
  ])
  const inYear = (survey: Survey) => (!survey.opensOn || Number(survey.opensOn.slice(0, 4)) <= year) && (!survey.closesOn || Number(survey.closesOn.slice(0, 4)) >= year)
  const surveyRows = await Promise.all(surveys.filter((survey: Survey) => survey.status !== 'draft' && inYear(survey)).map(async (survey: Survey) => {
    const responses = (await loadResponses(organizationId, survey.id).catch(() => [])).filter((row: SurveyResponse & { createdAt?: string }) => String(row.submittedAt || row.createdAt || '').startsWith(String(year)))
    return { survey, summary: surveySummary(survey, responses) }
  }))
  return { year, indicatorRows: [], registerRows, surveyRows }
}

// The rest of the year's file, as loadDossierExtras reads it.
type DossierExtras = Awaited<ReturnType<typeof loadDossierExtras>>

const LEVEL_ORDER: string[] = ['hospital', 'department', 'committee']

// The objectives grouped like the indicators' print (owner, 6/11/2026): one table per place (the hospital, each department, each
// committee), the same columns and widths in every table, no months.
const STATE_CLASS: Record<string, string> = { missed: 'rd-bad', met: 'rd-good' }
export function objectivesPlaceTable(list: ObjectiveListRow[], language: string) {
  const en = language === 'en'
  return {
    columns: [{ text: en ? 'Objective' : 'Στόχος', width: '42%' }, { text: en ? 'Value' : 'Τιμή', align: 'right', width: '12%' }, { text: en ? 'Target' : 'Όριο', width: '11%' }, { text: en ? 'Owner' : 'Υπεύθυνος', width: '19%' }, { text: en ? 'Status' : 'Κατάσταση', width: '16%' }],
    rows: list.map(objective => objective.kind === 'plan'
      ? [{ html: `${escapeHtml(objective.title || '—')}${objective.indicator ? `<small>${escapeHtml(objective.indicator)}</small>` : ''}` }, { text: objective.baseline ? `${en ? 'from' : 'από'} ${objective.baseline}` : '—', align: 'right' }, objective.target || '—', roleTitleText(objective.ownerLabel, language) || '—', planStatusLabel(objective.status, en)]
      : [{ html: `${escapeHtml(objectiveTitle(objective, language))}<small>${escapeHtml(objective.code || '')}</small>` }, { text: objectiveValueText(objective.current.value, objective.unit, language), align: 'right' }, `${sign(objective)} ${formatObjectiveValue(objective.target, objective.unit, language)}`, roleTitleText(objective.ownerLabel, language) || '—', { text: objectiveStateLabel(objective.current.status, en), className: STATE_CLASS[objective.current.status] || '' }]),
  }
}
const placeOf = (objective: ObjectiveListRow, language: string) => (objective.kind === 'plan' ? objective.committeeName : objectiveLevelText(objective, language)) || '—'
export function objectivesByPlace(list: ObjectiveListRow[], language: string) {
  const places: { place: string, list: ObjectiveListRow[] }[] = []
  for (const objective of list) { const place = placeOf(objective, language); const group = places.find(item => item.place === place); if (group) group.list.push(objective); else places.push({ place, list: [objective] }) }
  return places.map(({ place, list: items }) => ({ title: `${place} (${items.length})`, table: objectivesPlaceTable(items, language) }))
}

// The objectives list as printed from Indicators & objectives › Objectives: what the list shows, grouped by place.
export function objectivesListDoc({ rows, year, language }: { rows: ObjectiveListRow[], year: number | string | null, language: string }): ReportDoc {
  const en = language === 'en'
  const own = rows.filter(objective => objective.kind !== 'plan')
  const count = (status: string) => own.filter(objective => objective.current?.status === status).length
  const ordered = LEVEL_ORDER.flatMap(level => rows.filter(objective => (objective.kind === 'plan' ? 'committee' : objectiveLevel(objective)) === level))
  return {
    language,
    kind: en ? 'Quality objectives' : 'Στόχοι ποιότητας',
    code: year ? String(year) : '',
    title: en ? 'Quality objectives' : 'Στόχοι ποιότητας',
    subtitle: [year ? String(year) : null, `${rows.length} ${en ? 'objectives' : 'στόχοι'}`, `${count('met')} ${en ? 'met' : 'επιτυγχάνονται'}`, `${count('missed')} ${en ? 'not met' : 'δεν επιτυγχάνονται'}`].filter(Boolean).join(' · '),
    sections: objectivesByPlace(ordered, language),
    filename: `${en ? 'quality-objectives' : 'stoxoi-poiotitas'}${year ? `-${year}` : ''}`,
  }
}
const levelHeading = (level: string, en: boolean) => (en ? { hospital: 'Hospital objectives', department: 'Department objectives', committee: 'Committee objectives' } : { hospital: 'Στόχοι νοσοκομείου', department: 'Στόχοι τμημάτων', committee: 'Στόχοι επιτροπών' })[level]
const percent = (value: number | null) => (value == null ? '—' : `${Math.round(value)}%`)

// The whole file of one year, everything in it: the summary by level, the objectives of the hospital, the departments and
// the committees (with the committees' annual plans), each objective with its months, the department registers' indicators for the year,
// the satisfaction surveys and what the last management review decided.
export function objectivesDossier({ objectives, committeeTargets = [], reviews, extras = null, year, language }: { objectives: ObjectiveView[], committeeTargets?: CommitteeTarget[], histories?: Map<string, ObjectiveHistoryPoint[]>, reviews: Review[], extras?: DossierExtras | null, year: number, language: string }): ReportDoc {
  const en = language === 'en'
  const rows = (objectives || []).filter(objective => Number(objective.year) === Number(year))
  const plans = (committeeTargets || []).filter(item => Number(item.year) === Number(year))
  const count = (list: ObjectiveView[], status: string) => list.filter(objective => objective.current.status === status).length
  const review = [...(reviews || [])].filter(item => item.status !== 'draft').sort((a, b) => String(b.reviewDate).localeCompare(String(a.reviewDate)))[0] || null
  const byLevel = LEVEL_ORDER.map(level => ({ level, list: rows.filter(objective => objectiveLevel(objective) === level) }))
  const summary = { title: en ? 'Summary' : 'Σύνοψη', table: { columns: [en ? 'Level' : 'Επίπεδο', en ? 'Objectives' : 'Στόχοι', en ? 'Met' : 'Επιτυγχάνονται', en ? 'Not met' : 'Δεν επιτυγχάνονται', en ? 'Not measured yet' : 'Δεν μετριέται ακόμα'], rows: [...byLevel.map(({ level, list }) => [levelHeading(level, en), String(list.length + (level === 'committee' ? plans.length : 0)), String(count(list, 'met') + (level === 'committee' ? plans.filter(item => item.status === 'completed').length : 0)), String(count(list, 'missed')), String(count(list, 'pending') + (level === 'committee' ? plans.filter(item => item.status !== 'completed').length : 0))])] } }
  // One table per place (the hospital, each department, each committee with its annual plan), without the months
  // (owner, 6/11/2026: the file is a summary for the auditor).
  const levelSections = byLevel.flatMap(({ level, list }): ReportSection[] => {
    const all: ObjectiveListRow[] = level === 'committee' ? [...list, ...plans.map(item => ({ ...item, kind: 'plan' as const }))] : list
    if (!all.length) return []
    const places = objectivesByPlace(all, language)
    return level === 'hospital' ? [{ title: levelHeading(level, en), table: places[0].table }, ...places.slice(1)] : [{ title: levelHeading(level, en), text: places.map(item => item.title).join(' · ') }, ...places]
  })
  const indicatorRows: DossierIndicatorRow[] = []
  const registerRows = (extras?.year === year ? extras.registerRows : []) || []
  // The registers' indicators like the indicators' print: those with a target, one table per register.
  const registerSections = registerIndicatorSections(registerRows, language)
  const registerIndicators = registerSections.length ? [{ title: en ? 'Department register indicators' : 'Δείκτες μητρώων τμημάτων', text: en ? `The indicators with a target of every active register for the year so far: ${registerSections.map(item => item.title).join(' · ')}.` : `Οι δείκτες με στόχο κάθε ενεργού μητρώου για το έτος έως σήμερα: ${registerSections.map(item => item.title).join(' · ')}.` }, ...registerSections] : null
  const missingTable = missingDataTable({ indicatorRows, registerRows, objectives: rows }, language)
  const missing = { title: en ? 'Missing data' : 'Δεδομένα που λείπουν', pageBreak: true, text: missingTable ? (en ? 'What the platform does not record, and the indicators and objectives it leaves without a value: what to start recording.' : 'Τι δεν καταγράφεται στην πλατφόρμα και ποιους δείκτες και στόχους αφήνει χωρίς τιμή: τι πρέπει να αρχίσει να καταγράφεται.') : (en ? 'Every indicator and objective of the year has a value.' : 'Όλοι οι δείκτες και οι στόχοι του έτους έχουν τιμή.'), ...(missingTable ? { table: missingTable } : {}) }
  const surveyRows = (extras?.year === year ? extras.surveyRows : []) || []
  const surveys = surveyRows.length ? { title: en ? 'Satisfaction surveys' : 'Ερωτηματολόγια ικανοποίησης', table: { columns: [en ? 'Questionnaire' : 'Ερωτηματολόγιο', en ? 'Responses' : 'Απαντήσεις', en ? 'Satisfied' : 'Ικανοποιημένοι', en ? 'Target' : 'Στόχος', 'NPS'], rows: surveyRows.map(({ survey, summary: result }) => [`${survey.code} · ${en ? survey.titleEn || survey.title : survey.title}`, String(result.responses), { text: percent(result.satisfied), className: result.satisfied == null ? '' : result.satisfied >= result.target ? 'rd-good' : 'rd-bad' }, `≥ ${result.target}%`, result.nps == null ? '—' : String(result.nps)]) } } : null
  return {
    language,
    kind: en ? 'Annual objectives file' : 'Ετήσιος φάκελος στοχοθεσίας',
    code: String(year),
    title: en ? `Objectives and indicators ${year}` : `Στόχοι και δείκτες ${year}`,
    subtitle: en ? 'For the auditor: every objective of the hospital, the departments and the committees, who owns it, its value and its status; the department registers’ indicators, the satisfaction surveys and the management review.' : 'Για τον επιθεωρητή: όλοι οι στόχοι του νοσοκομείου, των τμημάτων και των επιτροπών, ποιος τον υπηρετεί, η τιμή και η κατάστασή του· οι δείκτες των μητρώων των τμημάτων, τα ερωτηματολόγια ικανοποίησης και η ανασκόπηση της διοίκησης.',
    meta: [[en ? 'Objectives' : 'Στόχοι', String(rows.length + plans.length)], [en ? 'Met' : 'Επιτυγχάνονται', String(count(rows, 'met'))], [en ? 'Not met' : 'Δεν επιτυγχάνονται', String(count(rows, 'missed'))], [en ? 'Register indicators' : 'Δείκτες μητρώων', String(registerRows.length)]],
    sections: [
      summary,
      ...levelSections,
      ...(registerIndicators || []),
      ...(surveys ? [surveys] : []),
      review ? { title: en ? `Management review ${review.code}` : `Ανασκόπηση διοίκησης ${review.code}`, text: `${formatDay(review.reviewDate, language)}${review.summary ? `\n\n${review.summary}` : ''}`, table: review.actions?.length ? { columns: [en ? 'Decision' : 'Απόφαση', en ? 'Owner' : 'Υπεύθυνος', en ? 'Due' : 'Προθεσμία', en ? 'Status' : 'Κατάσταση'], rows: review.actions.map(action => [action.title, roleTitleText(action.ownerLabel, language) || '—', action.dueDate ? formatDay(action.dueDate, language) : '—', action.status === 'done' ? (en ? 'Done' : 'Ολοκληρώθηκε') : (en ? 'Open' : 'Ανοιχτή')]) } : null } : { title: en ? 'Management review' : 'Ανασκόπηση διοίκησης', text: en ? 'No management review has been recorded yet.' : 'Δεν έχει καταγραφεί ακόμη ανασκόπηση διοίκησης.' },
      missing,
    ].filter(Boolean) as ReportSection[],
    signatures: [en ? 'Prepared by' : 'Συντάχθηκε από', en ? 'Approved by' : 'Εγκρίθηκε από'],
    filename: `${en ? 'objectives-indicators' : 'stoxoi-deiktes'}-${year}`,
  }
}
