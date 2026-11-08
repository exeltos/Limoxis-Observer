import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Trash2, Wand2 } from 'lucide-react'
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
import { downloadXlsx } from '../../core/export/xlsxExport'
import { DEFAULT_RULES, checkRoster, generateRoster, periodDays } from './rosterEngine'
import { deleteRoster, loadDepartmentStaff, loadRoster, loadRosterDepartments, rosterPeriod, saveRoster } from './rosterService'
import './rosters.css'

// The department's monthly shift roster (owner, 8/11/2026): its people (active or not, leaves and wishes), the people
// each shift needs and the rules; «Αυτόματη δημιουργία» makes the whole period, a click on a cell corrects it by hand
// and the rules are checked again.
const DEMAND = { weekday: { M: 2, I: 0, A: 2, N: 1 }, weekend: { M: 2, I: 0, A: 2, N: 1 } }
const SHIFTS = ['M', 'I', 'A', 'N']
// The department manager, the hospital administrator and the platform owner (not the HR office: owner, 8/11/2026).
const WRITERS = new Set([ROLES.HOSPITAL_ADMIN, ROLES.DEPARTMENT_MANAGER, ROLES.DEMO, ROLES.PLATFORM_OWNER])
const LEAVES = ['L', 'S', 'H', 'U']

export function RostersPage() {
  const { user } = useAuth()
  const { tenant, role, membership } = useTenant()
  const { language } = useLanguage()
  const { notify, notifyError, confirm } = useFeedback()
  const en = language === 'en'
  const tx = (elText, enText) => (en ? enText : elText)
  const canEdit = WRITERS.has(role)
  const CODES = useMemo(
    () => ({
      M: { short: tx('Π', 'M'), label: tx('Πρωί 07–15', 'Morning 07–15') },
      I: { short: tx('Ε', 'I'), label: tx('Ενδιάμεση 11–19', 'Intermediate 11–19') },
      A: { short: tx('Α', 'A'), label: tx('Απόγευμα 15–23', 'Afternoon 15–23') },
      N: { short: tx('Ν', 'N'), label: tx('Νύχτα 23–07', 'Night 23–07') },
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
    maxConsecutive: tx('Πάνω από 5 συνεχόμενες βάρδιες', 'More than 5 shifts in a row'),
    weekendOff: tx('Χωρίς ρεπό Σαββατοκύριακου', 'No weekend off'),
    nightToMorning: tx('Νύχτα και την επομένη πρωί ή ενδιάμεση', 'Night followed by a morning or intermediate'),
    morningToNight: tx('Πρωί ή ενδιάμεση και την επομένη νύχτα', 'Morning or intermediate followed by a night'),
    balance: tx('Άνισος αριθμός βαρδιών', 'Uneven number of shifts'),
  }
  const [departments, setDepartments] = useState([])
  const [departmentId, setDepartmentId] = useState('')
  const [offset, setOffset] = useState(1)
  const period = useMemo(() => rosterPeriod(new Date(), offset), [offset])
  const days = useMemo(() => periodDays(period.start, period.end), [period])
  const [roster, setRoster] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cell, setCell] = useState(null)
  const department = departments.find(d => d.id === departmentId) || null

  useEffect(() => {
    if (!tenant?.id) return
    loadRosterDepartments(tenant.id)
      .then(list => {
        // A department manager sees their own departments first (the database lets them write only those).
        const own = new Set(membership?.departmentIds || [])
        const sorted = own.size ? [...list.filter(d => own.has(d.id)), ...list.filter(d => !own.has(d.id))] : list
        setDepartments(sorted)
        setDepartmentId(current => current || sorted[0]?.id || '')
      })
      .catch(error => notifyError(error, 'load', { operation: 'roster_departments_load' }))
  }, [tenant?.id, membership?.departmentIds, notifyError])

  const load = useCallback(async () => {
    if (!tenant?.id || !department) return
    setLoading(true)
    try {
      const [saved, staff] = await Promise.all([loadRoster(tenant.id, department.id, period.start), loadDepartmentStaff(tenant.id, department)])
      // New people of the department join a saved roster; people who left stay in it until removed.
      const members = saved ? [...saved.members, ...staff.filter(s => !saved.members.some(m => m.employeeId === s.employeeId))] : staff
      setRoster(saved ? { ...saved, members } : { departmentId: department.id, periodStart: period.start, periodEnd: period.end, demand: DEMAND, rules: {}, members, assignments: {}, status: 'draft' })
      setDirty(false)
    } catch (error) {
      notifyError(error, 'load', { operation: 'roster_load' })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, department, period, notifyError])
  useEffect(() => {
    void load()
  }, [load])

  const engineEmployees = useMemo(() => (roster?.members || []).map(m => ({ id: m.employeeId, name: m.name, active: m.active !== false, fixed: m.fixed || {}, wishes: m.wishes || {} })), [roster])
  const rules = useMemo(() => ({ ...DEFAULT_RULES, ...(roster?.rules || {}) }), [roster])
  const violations = useMemo(
    () => (roster && Object.keys(roster.assignments || {}).length ? checkRoster({ days, employees: engineEmployees, assignments: roster.assignments, demand: roster.demand, rules }) : []),
    [roster, days, engineEmployees, rules],
  )
  const update = next => {
    setRoster(next)
    setDirty(true)
  }
  const setMember = (employeeId, patch) => update({ ...roster, members: roster.members.map(m => (m.employeeId === employeeId ? { ...m, ...patch } : m)) })
  const setDemand = (kind, shift, value) => update({ ...roster, demand: { ...roster.demand, [kind]: { ...roster.demand[kind], [shift]: Math.max(0, Math.min(20, Number(value) || 0)) } } })

  function autoGenerate() {
    const result = generateRoster({ days, employees: engineEmployees, demand: roster.demand, rules, seed: Date.now() % 100000 })
    update({ ...roster, assignments: result.assignments })
    notify(result.violations.length ? tx(`Δημιουργήθηκε με ${result.violations.length} θέματα που χρειάζονται προσοχή.`, `Made with ${result.violations.length} issues to look at.`) : tx('Το πρόγραμμα δημιουργήθηκε· όλοι οι κανόνες τηρούνται.', 'The roster was made; every rule is kept.'), result.violations.length ? 'warning' : 'success')
  }
  // A cell: a shift or a day off is the roster; a leave is fixed (the next «automatic» keeps it); «wish» asks a day off.
  function setCode(employeeId, date, code) {
    const member = roster.members.find(m => m.employeeId === employeeId)
    const fixed = { ...(member.fixed || {}) }
    const wishes = { ...(member.wishes || {}) }
    if (code === 'wish') {
      if (wishes[date]) delete wishes[date]
      else wishes[date] = 'R'
    } else if (LEAVES.includes(code)) fixed[date] = code
    else delete fixed[date]
    const assignments = { ...roster.assignments, [employeeId]: { ...(roster.assignments[employeeId] || {}) } }
    if (code !== 'wish') {
      if (code) assignments[employeeId][date] = code
      else delete assignments[employeeId][date]
    }
    update({ ...roster, assignments, members: roster.members.map(m => (m.employeeId === employeeId ? { ...m, fixed, wishes } : m)) })
    setCell(null)
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
  function exportExcel() {
    const headers = [tx('Ονοματεπώνυμο', 'Name'), tx('Ειδικότητα', 'Profession'), ...days.map(d => d.date.slice(8, 10)), tx('Βάρδιες', 'Shifts')]
    const rows = roster.members.filter(m => m.active !== false).map(m => {
      const codes = days.map(d => roster.assignments[m.employeeId]?.[d.date] || '')
      return [m.name, m.profession, ...codes.map(c => (c ? CODES[c]?.short || c : '')), codes.filter(c => SHIFTS.includes(c)).length]
    })
    downloadXlsx(`Programma_${(department?.name || '').replace(/\s+/g, '_')}_${period.start}.xlsx`, [{ name: department?.name || 'Roster', headers, rows }])
  }

  const active = (roster?.members || []).filter(m => m.active !== false)
  const totalOf = id => days.filter(d => SHIFTS.includes(roster.assignments[id]?.[d.date])).length
  // The intermediate shift shows in the coverage row only when the department uses it.
  const usesI = Boolean(roster && (Number(roster.demand?.weekday?.I) || Number(roster.demand?.weekend?.I) || Object.values(roster.assignments || {}).some(row => Object.values(row).includes('I'))))
  const shown = usesI ? SHIFTS : ['M', 'A', 'N']
  const coverage = date => shown.map(s => active.filter(m => roster.assignments[m.employeeId]?.[date] === s).length).join('/')
  const fmtDay = iso => iso.split('-').reverse().slice(0, 2).join('/')
  const weekdays = en ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['Κ', 'Δ', 'Τ', 'Τ', 'Π', 'Π', 'Σ']
  const hasRoster = roster && Object.keys(roster.assignments || {}).length > 0

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
            <Button variant={dirty ? 'secondary' : 'primary'} onClick={autoGenerate} disabled={!active.length}>
              <Wand2 size={15} aria-hidden="true" />
              {tx('Αυτόματη δημιουργία', 'Make automatically')}
            </Button>
          )}
          {hasRoster && <ExportMenu onPrint={() => window.print()} onExcel={exportExcel} />}
          {canEdit && roster?.id && (
            <OverflowMenu
              label={tx('Ενέργειες', 'Actions')}
              items={[{ id: 'delete', label: tx('Διαγραφή προγράμματος', 'Delete roster'), icon: Trash2, tone: 'danger', onClick: remove }]}
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
          <Button variant="secondary" onClick={() => setOffset(v => v - 1)} aria-label={tx('Προηγούμενη περίοδος', 'Previous period')}><ChevronLeft size={16} /></Button>
          <strong>{fmtDay(period.start)} – {fmtDay(period.end)}</strong>
          <Button variant="secondary" onClick={() => setOffset(v => v + 1)} aria-label={tx('Επόμενη περίοδος', 'Next period')}><ChevronRight size={16} /></Button>
        </div>
      </div>
      {loading || !roster ? (
        <div className="inline-empty">{departments.length ? tx('Φόρτωση…', 'Loading…') : tx('Δεν υπάρχουν τμήματα.', 'No departments.')}</div>
      ) : (
        <div className="roster-layout">
          <aside className="roster-side">
            <section className="roster-card">
              <h3>{tx('Εργαζόμενοι', 'Employees')}</h3>
              {roster.members.length === 0 && <p className="roster-muted">{tx('Το τμήμα δεν έχει εργαζόμενους στο μητρώο.', 'The department has no employees in the register.')}</p>}
              {roster.members.map(m => (
                <label key={m.employeeId} className={`roster-member${m.active === false ? ' is-off' : ''}`}>
                  <input type="checkbox" checked={m.active !== false} disabled={!canEdit} onChange={event => setMember(m.employeeId, { active: event.target.checked })} />
                  <span>{m.name}</span>
                  <small>{Object.values(m.fixed || {}).some(c => LEAVES.includes(c)) ? tx('άδεια', 'leave') : Object.keys(m.wishes || {}).length ? tx('επιθυμία', 'wish') : m.profession}</small>
                </label>
              ))}
            </section>
            <section className="roster-card">
              <h3>{tx('Άτομα ανά βάρδια', 'People per shift')}</h3>
              <div className="roster-demand">
                <span />
                <b>{tx('Καθημ.', 'Weekday')}</b>
                <b>{tx('Σ/Κ', 'Weekend')}</b>
                {SHIFTS.map(s => (
                  <div key={s} className="roster-demand-row">
                    <span>{CODES[s].label}</span>
                    {['weekday', 'weekend'].map(kind => (
                      <input key={kind} type="number" min="0" max="20" aria-label={`${CODES[s].label} ${kind}`} value={roster.demand?.[kind]?.[s] ?? 0} disabled={!canEdit} onChange={event => setDemand(kind, s, event.target.value)} />
                    ))}
                  </div>
                ))}
              </div>
              <h3>{tx('Κανόνες', 'Rules')}</h3>
              <ul className="roster-rules">
                <li>{tx('Τουλάχιστον ένα ρεπό Σαββατοκύριακου', 'At least one weekend off')}</li>
                <li>{tx('Έως 5 συνεχόμενες βάρδιες', 'At most 5 shifts in a row')}</li>
                <li>{tx('Όχι νύχτα → πρωί/ενδιάμεση, ούτε πρωί/ενδιάμεση → νύχτα', 'No night → morning/intermediate, nor morning/intermediate → night')}</li>
                <li>{tx('Ίσες βάρδιες, λιγότερες όσοι έχουν άδεια', 'Equal shifts, fewer for those on leave')}</li>
              </ul>
            </section>
          </aside>
          <section className="roster-card roster-grid-card">
            {!hasRoster ? (
              <p className="roster-empty">{canEdit ? tx('Δεν υπάρχει ακόμη πρόγραμμα για την περίοδο. Ορίστε άτομα ανά βάρδια και πατήστε «Αυτόματη δημιουργία».', 'No roster for the period yet. Set the people per shift and press «Make automatically».') : tx('Δεν υπάρχει ακόμη πρόγραμμα για την περίοδο.', 'No roster for the period yet.')}</p>
            ) : (
              <>
                <div className="roster-grid-wrap">
                  <table className="roster-grid">
                    <thead>
                      <tr>
                        <th className="roster-name-col" />
                        {days.map(d => (
                          <th key={d.date} className={d.weekend ? 'is-weekend' : ''}>
                            {weekdays[d.weekday]}
                            <br />
                            {d.date.slice(8, 10)}
                          </th>
                        ))}
                        <th>{tx('Σύνολο', 'Total')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {active.map(m => (
                        <tr key={m.employeeId}>
                          <td className="roster-name-col">{m.name}</td>
                          {days.map(d => {
                            const code = roster.assignments[m.employeeId]?.[d.date] || ''
                            const wish = m.wishes?.[d.date]
                            const bad = violations.some(v => v.employeeId === m.employeeId && v.date === d.date)
                            return (
                              <td key={d.date}>
                                <button
                                  type="button"
                                  className={`roster-cell code-${LEAVES.includes(code) ? 'leave' : code || 'none'}${wish ? ' has-wish' : ''}${bad ? ' is-bad' : ''}`}
                                  disabled={!canEdit}
                                  title={[CODES[code]?.label, wish && tx('επιθυμία ρεπό', 'wishes a day off')].filter(Boolean).join(' · ')}
                                  onClick={event => {
                                    const rect = event.currentTarget.getBoundingClientRect()
                                    setCell({ employeeId: m.employeeId, date: d.date, top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 220) })
                                  }}
                                >
                                  {code ? CODES[code]?.short || code : ''}
                                </button>
                              </td>
                            )
                          })}
                          <td className="roster-total">{totalOf(m.employeeId)}</td>
                        </tr>
                      ))}
                      <tr className="roster-coverage">
                        <td className="roster-name-col">{shown.map(c => CODES[c].short).join(' / ')}</td>
                        {days.map(d => <td key={d.date}>{coverage(d.date)}</td>)}
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="roster-legend">
                  {[...shown, 'R'].map(c => <span key={c}><i className={`code-${c}`} />{CODES[c].short} {CODES[c].label}</span>)}
                  <span><i className="code-leave" />{tx('άδεια / αργία', 'leave / holiday')}</span>
                </div>
                {violations.length === 0 ? (
                  <p className="roster-ok">✓ {tx('Όλοι οι κανόνες τηρούνται. Πάτημα σε κελί για αλλαγή με το χέρι.', 'Every rule is kept. Click a cell to change it by hand.')}</p>
                ) : (
                  <ul className="roster-violations">
                    {/* One line per rule: how many times, the first days and the people (cells with a problem are framed red). */}
                    {Object.entries(Object.groupBy ? Object.groupBy(violations, v => v.rule) : violations.reduce((acc, v) => ({ ...acc, [v.rule]: [...(acc[v.rule] || []), v] }), {})).map(([rule, list]) => {
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
                )}
              </>
            )}
          </section>
        </div>
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
    </Page>
  )
}
