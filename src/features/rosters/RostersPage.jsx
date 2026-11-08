import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarPlus, ChevronLeft, ChevronRight, Eraser, GripVertical, SlidersHorizontal, Trash2, Wand2 } from 'lucide-react'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { ROLES } from '../../core/permissions/roles'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { ExportMenu } from '../../design-system/ExportMenu'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { ManualDateField } from '../../design-system/ManualDateField'
import { Field } from '../../design-system/Field'
import { downloadXlsx } from '../../core/export/xlsxExport'
import { DEFAULT_RULES, checkRoster, datesBetween, demandFor, generateRoster, isLeave, isShift, periodDays, shiftTargets } from './rosterEngine'
import { deleteRoster, headsFirst, loadDepartmentStaff, loadRoster, loadRosterDepartments, loadRosterHistory, rosterPeriod, saveRoster } from './rosterService'
import './rosters.css'

// The department's monthly shift roster (owner, 8/11/2026). It opens as an empty sheet with every name, so leave and
// wishes go in first; «Αυτόματη δημιουργία» fills only the empty cells (what was set by hand stays). Under each day the
// people on each shift against those needed (a click sets the day's own number); beside each person their totals and
// target. The head of the department is first, the others are dragged into the order of priority. The new roster
// starts from the end of the previous one.
const DEMAND = { weekday: { M: 2, I: 0, A: 2, N: 1 }, weekend: { M: 2, I: 0, A: 2, N: 1 }, overrides: {} }
const SHIFTS = ['M', 'I', 'A', 'N']
const LEAVES = ['L', 'S', 'H', 'U']
const WRITERS = new Set([ROLES.HOSPITAL_ADMIN, ROLES.DEPARTMENT_MANAGER, ROLES.DEMO, ROLES.PLATFORM_OWNER])
const RULE_FIELDS = ['maxConsecutive', 'maxConsecutiveNights', 'restAfterNight', 'restAfterTwoNights', 'weeklyRestDays', 'minWeekendOff']

export function RostersPage() {
  const { user } = useAuth()
  const { tenant, role, membership, isDemo } = useTenant()
  const { language } = useLanguage()
  const { notify, notifyError, confirm } = useFeedback()
  const en = language === 'en'
  const tx = (elText, enText) => (en ? enText : elText)
  const canEdit = WRITERS.has(role)
  const CODES = useMemo(
    () => ({
      M: { short: tx('Π', 'M'), label: tx('Πρωί 07–15', 'Morning 07–15'), name: tx('Πρωί', 'Morning') },
      I: { short: tx('Ε', 'I'), label: tx('Ενδιάμεση 11–19', 'Intermediate 11–19'), name: tx('Ενδιάμεση', 'Intermediate') },
      A: { short: tx('Α', 'A'), label: tx('Απόγευμα 15–23', 'Afternoon 15–23'), name: tx('Απόγευμα', 'Afternoon') },
      N: { short: tx('Ν', 'N'), label: tx('Νύχτα 23–07', 'Night 23–07'), name: tx('Νύχτα', 'Night') },
      R: { short: tx('Ρ', 'R'), label: tx('Ρεπό', 'Day off') },
      L: { short: tx('ΑΔ', 'LV'), label: tx('Κανονική άδεια', 'Annual leave') },
      S: { short: tx('ΑΣ', 'SK'), label: tx('Ασθένεια', 'Sick leave') },
      H: { short: tx('ΑΡ', 'PH'), label: tx('Αργία', 'Public holiday') },
      U: { short: tx('ΑΑ', 'UL'), label: tx('Άδεια άνευ αποδοχών', 'Unpaid leave') },
    }),
    [en], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const RULE_TEXT = {
    coverage: tx('Λείπουν άτομα από βάρδια', 'A shift is short of people'),
    maxConsecutive: tx('Πάρα πολλές συνεχόμενες βάρδιες', 'Too many shifts in a row'),
    nightsInRow: tx('Πάνω από τις επιτρεπόμενες συνεχόμενες νύχτες', 'More nights in a row than allowed'),
    restAfterNight: tx('Λείπει ρεπό μετά από νύχτα', 'No day off after a night'),
    restHours: tx('Απόγευμα και την επομένη πρωί (κάτω από 11 ώρες ανάπαυση)', 'Afternoon then morning (under 11 hours of rest)'),
    morningToNight: tx('Πρωί ή ενδιάμεση και την επομένη νύχτα', 'Morning or intermediate followed by a night'),
    weeklyRest: tx('Εβδομάδα με λιγότερα ρεπό από τα απαιτούμενα', 'A week with fewer days off than required'),
    weekendOff: tx('Χωρίς ρεπό Σαββατοκύριακου', 'No weekend off'),
    balance: tx('Άνιση κατανομή βαρδιών', 'Uneven share of shifts'),
  }
  const RULE_LABELS = {
    maxConsecutive: tx('Συνεχόμενες βάρδιες, έως', 'Shifts in a row, at most'),
    maxConsecutiveNights: tx('Συνεχόμενες νύχτες, έως', 'Nights in a row, at most'),
    restAfterNight: tx('Ρεπό μετά από μία νύχτα', 'Days off after one night'),
    restAfterTwoNights: tx('Ρεπό μετά από δύο νύχτες', 'Days off after two nights'),
    weeklyRestDays: tx('Ρεπό ανά εβδομάδα, τουλάχιστον', 'Days off a week, at least'),
    minWeekendOff: tx('Ολόκληρα Σ/Κ ρεπό, τουλάχιστον', 'Whole weekends off, at least'),
  }
  const [departments, setDepartments] = useState([])
  const [departmentId, setDepartmentId] = useState('')
  const [offset, setOffset] = useState(1)
  const period = useMemo(() => rosterPeriod(new Date(), offset), [offset])
  const previous = useMemo(() => rosterPeriod(new Date(), offset - 1), [offset])
  const days = useMemo(() => periodDays(period.start, period.end), [period])
  const [roster, setRoster] = useState(null)
  const [history, setHistory] = useState({ history: {}, dates: [] })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cell, setCell] = useState(null)
  const [need, setNeed] = useState(null)
  const [panel, setPanel] = useState('')
  const [leave, setLeave] = useState({ employeeId: '', code: 'L', from: '', to: '' })
  const [dragId, setDragId] = useState(null)
  const department = departments.find(d => d.id === departmentId) || null

  useEffect(() => {
    if (!tenant?.id) return
    loadRosterDepartments(tenant.id)
      .then(list => {
        // Each department sees only its own: the department manager gets their departments, the administrator all.
        let visible = list
        if (role === ROLES.DEPARTMENT_MANAGER) {
          const own = isDemo ? [membership?.previewDepartment].filter(Boolean) : membership?.departmentIds || []
          visible = list.filter(d => own.includes(d.id) || own.includes(d.name))
        }
        setDepartments(visible)
        setDepartmentId(current => (visible.some(d => d.id === current) ? current : visible[0]?.id || ''))
        if (!visible.length) setLoading(false)
      })
      .catch(error => notifyError(error, 'load', { operation: 'roster_departments_load' }))
  }, [tenant?.id, role, isDemo, membership?.previewDepartment, membership?.departmentIds, notifyError])

  const load = useCallback(async () => {
    if (!tenant?.id || !department) return
    setLoading(true)
    try {
      const [saved, staff, before] = await Promise.all([
        loadRoster(tenant.id, department.id, period.start),
        loadDepartmentStaff(tenant.id, department),
        loadRosterHistory(tenant.id, department.id, previous.start),
      ])
      // New people of the department join a saved roster; the head's mark follows the register.
      const heads = new Set(staff.filter(s => s.isHead).map(s => s.employeeId))
      const members = saved
        ? headsFirst([...saved.members, ...staff.filter(s => !saved.members.some(m => m.employeeId === s.employeeId))].map(m => ({ ...m, isHead: heads.has(m.employeeId) })))
        : staff
      setRoster(
        saved
          ? { ...saved, demand: { ...DEMAND, ...saved.demand, overrides: saved.demand?.overrides || {} }, members }
          : { departmentId: department.id, periodStart: period.start, periodEnd: period.end, demand: DEMAND, rules: {}, members, assignments: {}, status: 'draft' },
      )
      setHistory(before)
      setDirty(false)
    } catch (error) {
      notifyError(error, 'load', { operation: 'roster_load' })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, department, period, previous, notifyError])
  useEffect(() => {
    void load()
  }, [load])

  const engineEmployees = useMemo(() => (roster?.members || []).map(m => ({ id: m.employeeId, name: m.name, active: m.active !== false, fixed: m.fixed || {}, wishes: m.wishes || {} })), [roster])
  const rules = useMemo(() => ({ ...DEFAULT_RULES, ...(roster?.rules || {}) }), [roster])
  const violations = useMemo(
    () => (roster ? checkRoster({ days, employees: engineEmployees, assignments: roster.assignments, demand: roster.demand, rules, history: history.history }) : []),
    [roster, days, engineEmployees, rules, history],
  )
  const targets = useMemo(() => shiftTargets(days, engineEmployees), [days, engineEmployees])
  const update = next => {
    setRoster(next)
    setDirty(true)
  }
  const setMember = (employeeId, patch) => update({ ...roster, members: roster.members.map(m => (m.employeeId === employeeId ? { ...m, ...patch } : m)) })
  const setDemand = (kind, shift, value) => update({ ...roster, demand: { ...roster.demand, [kind]: { ...roster.demand[kind], [shift]: Math.max(0, Math.min(20, Number(value) || 0)) } } })
  const setRule = (key, value) => update({ ...roster, rules: { ...roster.rules, [key]: Math.max(0, Math.min(14, Number(value) || 0)) } })
  function setDayNeed(date, shift, value) {
    const overrides = { ...(roster.demand.overrides || {}) }
    const own = { ...(overrides[date] || {}) }
    if (value === '' || value === null) delete own[shift]
    else own[shift] = Math.max(0, Math.min(20, Number(value) || 0))
    if (Object.keys(own).length) overrides[date] = own
    else delete overrides[date]
    update({ ...roster, demand: { ...roster.demand, overrides } })
  }

  // «Automatic»: fills the cells nobody set by hand; leave, wishes and hand-set shifts stay.
  function autoGenerate() {
    setBusy(true)
    window.setTimeout(() => {
      try {
        const result = generateRoster({ days, employees: engineEmployees, demand: roster.demand, rules, history: history.history, seed: Date.now() % 100000 })
        update({ ...roster, assignments: result.assignments })
        notify(result.violations.length ? tx(`Δημιουργήθηκε με ${result.violations.length} θέματα που χρειάζονται προσοχή.`, `Made with ${result.violations.length} issues to look at.`) : tx('Το πρόγραμμα δημιουργήθηκε· όλοι οι κανόνες τηρούνται.', 'The roster was made; every rule is kept.'), result.violations.length ? 'warning' : 'success')
      } finally {
        setBusy(false)
      }
    }, 30)
  }
  // Keeps only what was set by hand (leave and hand-set shifts).
  function clearAutomatic() {
    const assignments = {}
    for (const m of roster.members) assignments[m.employeeId] = { ...(m.fixed || {}) }
    update({ ...roster, assignments })
  }
  // A cell set by hand is kept by the next «automatic»; «wish» asks for a day off; «clear» empties it.
  function setCode(employeeId, date, code) {
    const member = roster.members.find(m => m.employeeId === employeeId)
    const fixed = { ...(member.fixed || {}) }
    const wishes = { ...(member.wishes || {}) }
    const row = { ...(roster.assignments[employeeId] || {}) }
    if (code === 'wish') {
      if (wishes[date]) delete wishes[date]
      else wishes[date] = 'R'
    } else if (code) {
      fixed[date] = code
      row[date] = code
    } else {
      delete fixed[date]
      delete row[date]
    }
    update({ ...roster, assignments: { ...roster.assignments, [employeeId]: row }, members: roster.members.map(m => (m.employeeId === employeeId ? { ...m, fixed, wishes } : m)) })
    setCell(null)
  }
  // Leave «from - to» (or a wish for days off) for one person.
  function addLeave() {
    const dates = datesBetween(leave.from, leave.to, days)
    if (!leave.employeeId || !dates.length) return
    const member = roster.members.find(m => m.employeeId === leave.employeeId)
    const fixed = { ...(member.fixed || {}) }
    const wishes = { ...(member.wishes || {}) }
    const row = { ...(roster.assignments[leave.employeeId] || {}) }
    for (const date of dates) {
      if (leave.code === 'wish') wishes[date] = 'R'
      else {
        fixed[date] = leave.code
        row[date] = leave.code
      }
    }
    update({ ...roster, assignments: { ...roster.assignments, [leave.employeeId]: row }, members: roster.members.map(m => (m.employeeId === leave.employeeId ? { ...m, fixed, wishes } : m)) })
    setLeave(current => ({ ...current, from: '', to: '' }))
    notify(tx(`Καταχωρίστηκαν ${dates.length} ημέρες.`, `${dates.length} days entered.`), 'success')
  }
  // Drag a person (not the head) to a new place: the list is the order of priority.
  function dropOn(targetId) {
    if (!dragId || dragId === targetId) return
    const list = roster.members.filter(m => m.employeeId !== dragId)
    const moved = roster.members.find(m => m.employeeId === dragId)
    const at = list.findIndex(m => m.employeeId === targetId)
    list.splice(at < 0 ? list.length : at, 0, moved)
    update({ ...roster, members: headsFirst(list) })
    setDragId(null)
  }
  async function save() {
    setSaving(true)
    try {
      setRoster(await saveRoster(tenant.id, roster, user?.id))
      setDirty(false)
      notify(tx('Το πρόγραμμα αποθηκεύτηκε.', 'The roster was saved.'), 'success')
    } catch (error) {
      notifyError(error, 'save', { operation: 'roster_save' })
    } finally {
      setSaving(false)
    }
  }
  async function remove() {
    if (!roster?.id) return
    const ok = await confirm({ title: tx('Διαγραφή προγράμματος', 'Delete roster'), message: tx('Το πρόγραμμα της περιόδου διαγράφεται οριστικά.', 'The roster of the period is deleted for good.'), confirmLabel: tx('Διαγραφή', 'Delete'), danger: true })
    if (!ok) return
    try {
      await deleteRoster(tenant.id, roster)
      await load()
    } catch (error) {
      notifyError(error, 'delete', { operation: 'roster_delete' })
    }
  }

  const active = (roster?.members || []).filter(m => m.active !== false)
  const inactive = (roster?.members || []).filter(m => m.active === false)
  const codeAt = (id, date) => roster.assignments[id]?.[date] || ''
  const countOf = (id, test) => days.filter(d => test(codeAt(id, d.date))).length
  const usesI = Boolean(roster && (Number(roster.demand?.weekday?.I) || Number(roster.demand?.weekend?.I) || Object.values(roster.demand?.overrides || {}).some(o => Number(o.I)) || Object.values(roster.assignments || {}).some(row => Object.values(row || {}).includes('I'))))
  const shown = usesI ? SHIFTS : ['M', 'A', 'N']
  const fmtDay = iso => iso.split('-').reverse().slice(0, 2).join('/')
  const weekdays = en ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['Κ', 'Δ', 'Τ', 'Τ', 'Π', 'Π', 'Σ']
  const hasShifts = Boolean(roster && Object.values(roster.assignments || {}).some(row => Object.values(row || {}).some(isShift)))
  const historyDays = history.dates.slice(-3).map(date => periodDays(date, date)[0])

  function exportExcel() {
    const headers = [tx('Ονοματεπώνυμο', 'Name'), ...days.map(d => d.date.slice(8, 10)), ...shown.map(s => CODES[s].short), CODES.R.short, tx('Βάρδιες', 'Shifts'), tx('Στόχος', 'Target')]
    const rows = active.map(m => {
      const codes = days.map(d => codeAt(m.employeeId, d.date))
      return [m.name, ...codes.map(c => (c ? CODES[c]?.short || c : '')), ...shown.map(s => codes.filter(c => c === s).length), codes.filter(c => c === 'R').length, codes.filter(isShift).length, targets[m.employeeId] ?? '']
    })
    for (const s of shown) rows.push([CODES[s].name, ...days.map(d => `${active.filter(m => codeAt(m.employeeId, d.date) === s).length}/${demandFor(roster.demand, d)[s]}`)])
    downloadXlsx(`Programma_${(department?.name || '').replace(/\s+/g, '_')}_${period.start}.xlsx`, [{ name: department?.name || 'Roster', headers, rows }])
  }

  return (
    <Page
      fill
      className="roster-page"
      title={`${tx('Πρόγραμμα βαρδιών', 'Shift roster')}${department ? ` · ${department.name}` : ''}`}
      subtitle={`${tx('Περίοδος', 'Period')} ${fmtDay(period.start)} – ${fmtDay(period.end)} · ${active.length} ${tx('ενεργοί', 'active')}`}
      actions={
        <>
          {dirty && canEdit && <SaveButton onClick={save} loading={saving}>{tx('Αποθήκευση', 'Save')}</SaveButton>}
          {canEdit && roster && (
            <Button variant={dirty ? 'secondary' : 'primary'} onClick={autoGenerate} loading={busy} disabled={!active.length}>
              <Wand2 size={15} aria-hidden="true" />
              {tx('Αυτόματη δημιουργία', 'Make automatically')}
            </Button>
          )}
          {hasShifts && <ExportMenu onPrint={() => window.print()} onExcel={exportExcel} />}
          {canEdit && roster && (hasShifts || roster.id) && (
            <OverflowMenu
              label={tx('Ενέργειες', 'Actions')}
              items={[
                hasShifts && { id: 'clear', label: tx('Καθαρισμός αυτόματων βαρδιών', 'Clear the automatic shifts'), icon: Eraser, onClick: clearAutomatic },
                roster.id && { id: 'delete', label: tx('Διαγραφή προγράμματος', 'Delete roster'), icon: Trash2, tone: 'danger', separatorBefore: true, onClick: remove },
              ].filter(Boolean)}
            />
          )}
        </>
      }
    >
      <div className="roster-toolbar">
        <div className="roster-department">
          <SearchableSelect label={tx('Τμήμα', 'Department')} value={departmentId} onChange={value => value && setDepartmentId(value)} options={departments.map(d => ({ value: d.id, label: d.name }))} />
        </div>
        <div className="roster-period" role="group" aria-label={tx('Περίοδος', 'Period')}>
          <button type="button" className="roster-nav" onClick={() => setOffset(v => v - 1)} aria-label={tx('Προηγούμενη περίοδος', 'Previous period')}><ChevronLeft size={16} /></button>
          <strong>{fmtDay(period.start)} – {fmtDay(period.end)}</strong>
          <button type="button" className="roster-nav" onClick={() => setOffset(v => v + 1)} aria-label={tx('Επόμενη περίοδος', 'Next period')}><ChevronRight size={16} /></button>
        </div>
        {canEdit && roster && (
          <div className="roster-tools">
            <button type="button" className={`roster-tool${panel === 'leave' ? ' is-on' : ''}`} aria-pressed={panel === 'leave'} onClick={() => setPanel(p => (p === 'leave' ? '' : 'leave'))}>
              <CalendarPlus size={15} aria-hidden="true" />
              {tx('Άδειες & επιθυμίες', 'Leave & wishes')}
            </button>
            <button type="button" className={`roster-tool${panel === 'rules' ? ' is-on' : ''}`} aria-pressed={panel === 'rules'} onClick={() => setPanel(p => (p === 'rules' ? '' : 'rules'))}>
              <SlidersHorizontal size={15} aria-hidden="true" />
              {tx('Άτομα ανά βάρδια & κανόνες', 'People per shift & rules')}
            </button>
          </div>
        )}
      </div>

      {roster && panel === 'leave' && (
        <section className="roster-panel" aria-label={tx('Άδειες & επιθυμίες', 'Leave & wishes')}>
          <Field label={tx('Εργαζόμενος', 'Employee')}>
            <select value={leave.employeeId} onChange={event => setLeave(current => ({ ...current, employeeId: event.target.value }))}>
              <option value="">{tx('Επιλογή…', 'Choose…')}</option>
              {active.map(m => <option key={m.employeeId} value={m.employeeId}>{m.name}</option>)}
            </select>
          </Field>
          <Field label={tx('Είδος', 'Type')}>
            <select value={leave.code} onChange={event => setLeave(current => ({ ...current, code: event.target.value }))}>
              {LEAVES.map(code => <option key={code} value={code}>{CODES[code].label}</option>)}
              <option value="wish">{tx('Επιθυμία ρεπό', 'Wishes days off')}</option>
            </select>
          </Field>
          <ManualDateField label={tx('Από', 'From')} value={leave.from} onChange={value => setLeave(current => ({ ...current, from: value }))} />
          <ManualDateField label={tx('Έως', 'Until')} value={leave.to} onChange={value => setLeave(current => ({ ...current, to: value }))} optional />
          <Button onClick={addLeave} disabled={!leave.employeeId || !leave.from}>{tx('Καταχώριση', 'Enter')}</Button>
        </section>
      )}

      {roster && panel === 'rules' && (
        <section className="roster-panel roster-panel-rules" aria-label={tx('Άτομα ανά βάρδια & κανόνες', 'People per shift & rules')}>
          <div className="roster-demand">
            <span />
            <b>{tx('Καθημ.', 'Weekday')}</b>
            <b>{tx('Σ/Κ', 'Weekend')}</b>
            {SHIFTS.map(s => (
              <div key={s} className="roster-demand-row">
                <span>{CODES[s].label}</span>
                {['weekday', 'weekend'].map(kind => (
                  <input key={kind} type="number" min="0" max="20" aria-label={`${CODES[s].label} ${kind === 'weekday' ? tx('καθημερινή', 'weekday') : tx('Σαββατοκύριακο', 'weekend')}`} value={roster.demand?.[kind]?.[s] ?? 0} onChange={event => setDemand(kind, s, event.target.value)} />
                ))}
              </div>
            ))}
          </div>
          <div className="roster-rule-list">
            {RULE_FIELDS.map(key => (
              <label key={key} className="roster-rule">
                <span>{RULE_LABELS[key]}</span>
                <input type="number" min="0" max="14" value={rules[key]} onChange={event => setRule(key, event.target.value)} />
              </label>
            ))}
            <p className="roster-muted">{tx('Πάντα: όχι απόγευμα → πρωί (11 ώρες ανάπαυση), όχι πρωί/ενδιάμεση → νύχτα· ίσες βάρδιες, νύχτες και Σ/Κ· ρεπό κατά προτίμηση ανά δύο.', 'Always: no afternoon → morning (11 hours of rest), no morning/intermediate → night; even shifts, nights and weekends; days off preferably in pairs.')}</p>
          </div>
        </section>
      )}

      {loading ? (
        <div className="inline-empty">{tx('Φόρτωση…', 'Loading…')}</div>
      ) : !roster ? (
        <div className="inline-empty">{tx('Δεν υπάρχει τμήμα για πρόγραμμα βαρδιών.', 'No department to make a roster for.')}</div>
      ) : (
        <section className="roster-sheet">
          <div className="roster-grid-wrap">
            <table className="roster-grid">
              <thead>
                <tr>
                  <th className="roster-name-col">{tx('Εργαζόμενος', 'Employee')}</th>
                  {historyDays.map(d => (
                    <th key={d.date} className="roster-history" title={tx('Τέλος προηγούμενης περιόδου', 'End of the previous period')}>
                      {weekdays[d.weekday]}
                      <br />
                      {d.date.slice(8, 10)}
                    </th>
                  ))}
                  {days.map(d => (
                    <th key={d.date} className={d.weekend ? 'is-weekend' : ''}>
                      {weekdays[d.weekday]}
                      <br />
                      {d.date.slice(8, 10)}
                    </th>
                  ))}
                  {shown.map(s => <th key={s} className="roster-sum">{CODES[s].short}</th>)}
                  <th className="roster-sum">{CODES.R.short}</th>
                  <th className="roster-sum roster-total-col">{tx('Βάρδιες / στόχος', 'Shifts / target')}</th>
                </tr>
              </thead>
              <tbody>
                {active.length === 0 && (
                  <tr>
                    <td className="roster-empty" colSpan={days.length + historyDays.length + shown.length + 3}>{tx('Το τμήμα δεν έχει εργαζόμενους στο μητρώο.', 'The department has no employees in the register.')}</td>
                  </tr>
                )}
                {active.map(m => {
                  const shifts = countOf(m.employeeId, isShift)
                  const target = targets[m.employeeId] ?? 0
                  return (
                    <tr
                      key={m.employeeId}
                      className={`${dragId === m.employeeId ? 'is-dragging' : ''}${m.isHead ? ' is-head' : ''}`}
                      onDragOver={event => dragId && !m.isHead && event.preventDefault()}
                      onDrop={() => dropOn(m.employeeId)}
                    >
                      <td className="roster-name-col">
                        <span className="roster-name">
                          {canEdit && !m.isHead ? (
                            <span className="roster-grip" draggable onDragStart={() => setDragId(m.employeeId)} onDragEnd={() => setDragId(null)} title={tx('Σύρετε για αλλαγή σειράς', 'Drag to reorder')} aria-hidden="true">
                              <GripVertical size={14} />
                            </span>
                          ) : (
                            <span className="roster-grip is-fixed" aria-hidden="true" />
                          )}
                          {canEdit && <input type="checkbox" checked aria-label={tx(`${m.name}: ενεργός στο πρόγραμμα`, `${m.name}: in the roster`)} onChange={() => setMember(m.employeeId, { active: false })} />}
                          <span className="roster-name-text">{m.name}</span>
                          {m.isHead && <small className="roster-head-tag">{tx('Προϊστ.', 'Head')}</small>}
                        </span>
                      </td>
                      {historyDays.map(d => {
                        const code = history.history[m.employeeId]?.[history.dates.indexOf(d.date)] || ''
                        return <td key={d.date} className="roster-history"><span className={`roster-cell is-past code-${isLeave(code) ? 'leave' : code || 'none'}`}>{code ? CODES[code]?.short || code : ''}</span></td>
                      })}
                      {days.map(d => {
                        const code = codeAt(m.employeeId, d.date)
                        const wish = m.wishes?.[d.date]
                        const manual = Boolean(m.fixed?.[d.date]) && isShift(code)
                        const bad = violations.some(v => v.employeeId === m.employeeId && v.date === d.date)
                        return (
                          <td key={d.date} className={d.weekend ? 'is-weekend' : ''}>
                            <button
                              type="button"
                              className={`roster-cell code-${isLeave(code) ? 'leave' : code || 'none'}${wish ? ' has-wish' : ''}${bad ? ' is-bad' : ''}${manual ? ' is-manual' : ''}`}
                              disabled={!canEdit}
                              aria-label={`${m.name} ${fmtDay(d.date)}: ${[CODES[code]?.label || tx('κενό', 'empty'), wish && tx('επιθυμία ρεπό', 'wishes a day off')].filter(Boolean).join(' · ')}`}
                              title={[CODES[code]?.label, wish && tx('επιθυμία ρεπό', 'wishes a day off'), manual && tx('ορίστηκε με το χέρι', 'set by hand')].filter(Boolean).join(' · ')}
                              onClick={event => {
                                const rect = event.currentTarget.getBoundingClientRect()
                                setNeed(null)
                                setCell({ employeeId: m.employeeId, date: d.date, top: Math.min(rect.bottom + 4, window.innerHeight - 380), left: Math.min(rect.left, window.innerWidth - 230) })
                              }}
                            >
                              {code ? CODES[code]?.short || code : wish ? '★' : ''}
                            </button>
                          </td>
                        )
                      })}
                      {shown.map(s => <td key={s} className="roster-sum">{countOf(m.employeeId, c => c === s)}</td>)}
                      <td className="roster-sum">{countOf(m.employeeId, c => c === 'R')}</td>
                      <td className={`roster-sum roster-total-col${hasShifts && Math.abs(shifts - target) > rules.balanceTolerance ? ' is-off-target' : ''}`}>
                        {shifts} / {target}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                {shown.map(s => (
                  <tr key={s} className="roster-coverage">
                    <th className="roster-name-col" scope="row">{CODES[s].name}</th>
                    {historyDays.map(d => <td key={d.date} className="roster-history" />)}
                    {days.map(d => {
                      const have = active.filter(m => codeAt(m.employeeId, d.date) === s).length
                      const needed = demandFor(roster.demand, d)[s]
                      const own = roster.demand.overrides?.[d.date]?.[s] !== undefined
                      return (
                        <td key={d.date} className={d.weekend ? 'is-weekend' : ''}>
                          <button
                            type="button"
                            className={`roster-need${hasShifts && have < needed ? ' is-short' : ''}${own ? ' is-own' : ''}`}
                            disabled={!canEdit}
                            aria-label={`${CODES[s].name} ${fmtDay(d.date)}: ${have} ${tx('από', 'of')} ${needed}`}
                            onClick={event => {
                              const rect = event.currentTarget.getBoundingClientRect()
                              setCell(null)
                              setNeed({ date: d.date, shift: s, value: String(needed), top: Math.max(8, rect.top - 124), left: Math.min(rect.left, window.innerWidth - 230) })
                            }}
                          >
                            {have}/{needed}
                          </button>
                        </td>
                      )
                    })}
                    <td className="roster-sum" colSpan={shown.length + 2} />
                  </tr>
                ))}
              </tfoot>
            </table>
          </div>
          {inactive.length > 0 && (
            <p className="roster-inactive">
              {tx('Εκτός προγράμματος:', 'Out of the roster:')}{' '}
              {inactive.map(m => (
                <label key={m.employeeId}>
                  <input type="checkbox" checked={false} disabled={!canEdit} onChange={() => setMember(m.employeeId, { active: true })} />
                  {m.name}
                </label>
              ))}
            </p>
          )}
          <div className="roster-legend">
            {shown.map(c => <span key={c}><i className={`code-${c}`}>{CODES[c].short}</i>{CODES[c].label}</span>)}
            <span><i className="code-R">{CODES.R.short}</i>{CODES.R.label}</span>
            <span><i className="code-leave">{CODES.L.short}</i>{tx('Άδεια / αργία', 'Leave / holiday')}</span>
            <span><i className="code-wish">★</i>{tx('Επιθυμία ρεπό', 'Wishes a day off')}</span>
            <span><i className="code-none is-manual-key" />{tx('Ορίστηκε με το χέρι', 'Set by hand')}</span>
          </div>
          {hasShifts &&
            (violations.length === 0 ? (
              <p className="roster-ok">✓ {tx('Όλοι οι κανόνες τηρούνται.', 'Every rule is kept.')}</p>
            ) : (
              <ul className="roster-violations">
                {/* One line per rule: the first days and the people (their cells are framed red). */}
                {Object.entries(violations.reduce((acc, v) => ({ ...acc, [v.rule]: [...(acc[v.rule] || []), v] }), {})).map(([rule, list]) => {
                  const dates = [...new Set(list.map(v => v.date).filter(Boolean))]
                  const people = [...new Set(list.map(v => roster.members.find(m => m.employeeId === v.employeeId)?.name).filter(Boolean))]
                  return (
                    <li key={rule}>
                      <strong>{RULE_TEXT[rule] || rule}</strong>
                      {dates.length > 0 && ` · ${dates.slice(0, 6).map(fmtDay).join(', ')}${dates.length > 6 ? tx(` και ${dates.length - 6} ακόμη`, ` and ${dates.length - 6} more`) : ''}`}
                      {people.length > 0 && ` · ${people.slice(0, 3).join(', ')}${people.length > 3 ? '…' : ''}`}
                    </li>
                  )
                })}
              </ul>
            ))}
        </section>
      )}

      {cell && (
        <>
          <div className="roster-cell-backdrop" onClick={() => setCell(null)} aria-hidden="true" />
          <div className="roster-cell-menu" role="menu" style={{ top: cell.top, left: cell.left }}>
            {[...SHIFTS, 'R', ...LEAVES].map(code => (
              <button key={code} type="button" role="menuitem" onClick={() => setCode(cell.employeeId, cell.date, code)}>
                <i className={`code-${LEAVES.includes(code) ? 'leave' : code}`}>{CODES[code].short}</i>
                {CODES[code].label}
              </button>
            ))}
            <button type="button" role="menuitem" onClick={() => setCode(cell.employeeId, cell.date, 'wish')}>
              <i className="code-wish">★</i>
              {tx('Επιθυμία ρεπό', 'Wishes a day off')}
            </button>
            <button type="button" role="menuitem" onClick={() => setCode(cell.employeeId, cell.date, '')}>
              <i className="code-none">–</i>
              {tx('Καθαρισμός', 'Clear')}
            </button>
          </div>
        </>
      )}
      {need && (
        <>
          <div className="roster-cell-backdrop" onClick={() => setNeed(null)} aria-hidden="true" />
          <div className="roster-cell-menu roster-need-menu" role="dialog" aria-label={`${CODES[need.shift].name} ${fmtDay(need.date)}`} style={{ top: need.top, left: need.left }}>
            <label>
              <span>{CODES[need.shift].name} {fmtDay(need.date)} · {tx('χρειάζονται', 'needed')}</span>
              <input type="number" min="0" max="20" value={need.value} onChange={event => setNeed(current => ({ ...current, value: event.target.value }))} />
            </label>
            <div className="roster-need-actions">
              <button type="button" onClick={() => { setDayNeed(need.date, need.shift, null); setNeed(null) }}>{tx('Όπως οι άλλες μέρες', 'Like the other days')}</button>
              <button type="button" className="is-primary" onClick={() => { setDayNeed(need.date, need.shift, need.value); setNeed(null) }}>{tx('Ορισμός', 'Set')}</button>
            </div>
          </div>
        </>
      )}
    </Page>
  )
}
