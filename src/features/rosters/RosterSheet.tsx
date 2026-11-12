import { GripVertical } from 'lucide-react'
import { demandFor, isShift, kindOf } from './rosterEngine'
import { HOURS, isExtra, type RosterView } from './rosterPageModel'
import type { RosterViolation } from './rosterRules'

// The roster sheet: a row per person with their totals, the people on each shift under each day, the legend and the rules not kept.
export function RosterSheet({ view }: { view: RosterView }) {
  const { tx, canEdit, roster, CODES, RULE_TEXT, days, history, setCell, setNeed, setLimits, dragId, setDragId, dropId, setDropId, rules, violations, targets, me, setMember, dropOn, active, inactive, nameOf, codeAt, countOf, shown, others, shortOf, labelOf, cellClass, fmtDay, weekdays, hasShifts, historyDays, limitTag } = view
  return (
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
                  <th className="roster-sum roster-total-col">{tx('Ώρες', 'Hours')}</th>
                </tr>
              </thead>
              <tbody>
                {active.length === 0 && (
                  <tr>
                    <td className="roster-empty" colSpan={days.length + historyDays.length + shown.length + 4}>{tx('Το τμήμα δεν έχει εργαζόμενους στο μητρώο.', 'The department has no employees in the register.')}</td>
                  </tr>
                )}
                {active.map(m => {
                  const shifts = countOf(m.employeeId, isShift)
                  const target = targets[m.employeeId] ?? 0
                  const tag = limitTag(m)
                  return (
                    <tr
                      key={m.employeeId}
                      className={`${dragId === m.employeeId ? 'is-dragging' : ''}${dropId === m.employeeId && dragId && dragId !== m.employeeId ? ' is-drop-target' : ''}${m.isHead ? ' is-head' : ''}${me?.employeeId === m.employeeId ? ' is-me' : ''}`}
                      onDragOver={event => {
                        if (!dragId || m.isHead) return
                        event.preventDefault()
                        if (dropId !== m.employeeId) setDropId(m.employeeId)
                      }}
                      onDrop={() => dropOn(m.employeeId)}
                    >
                      <td className="roster-name-col">
                        <span className="roster-name">
                          {canEdit && !m.isHead ? (
                            <span className="roster-grip" draggable onDragStart={() => setDragId(m.employeeId)} onDragEnd={() => { setDragId(null); setDropId(null) }} title={tx('Σύρετε για αλλαγή σειράς', 'Drag to reorder')} aria-hidden="true">
                              <GripVertical size={14} />
                            </span>
                          ) : (
                            <span className="roster-grip is-fixed" aria-hidden="true" />
                          )}
                          {canEdit && <input type="checkbox" checked aria-label={tx(`${m.name}: ενεργός στο πρόγραμμα`, `${m.name}: in the roster`)} onChange={() => setMember(m.employeeId, { active: false })} />}
                          {canEdit ? (
                            <button
                              type="button"
                              className="roster-name-text"
                              title={tx('Ποιες βάρδιες κάνει', 'Which shifts this person works')}
                              onClick={event => {
                                const rect = event.currentTarget.getBoundingClientRect()
                                setCell(null)
                                setNeed(null)
                                setLimits({ employeeId: m.employeeId, top: Math.min(rect.bottom + 4, window.innerHeight - 220), left: rect.left })
                              }}
                            >
                              {m.name}
                            </button>
                          ) : (
                            <span className="roster-name-text">{m.name}</span>
                          )}
                          {m.isHead && <small className="roster-head-tag">{tx('Προϊστ.', 'Head')}</small>}
                          {tag && <small className="roster-limit-tag">{tag}</small>}
                        </span>
                      </td>
                      {historyDays.map(d => {
                        const code = history.history[m.employeeId]?.[history.dates.indexOf(d.date)] || ''
                        return <td key={d.date} className="roster-history"><span className={`roster-cell is-past code-${cellClass(code)}`}>{shortOf(code)}</span></td>
                      })}
                      {days.map(d => {
                        const code = codeAt(m.employeeId, d.date)
                        const wish = m.wishes?.[d.date]
                        const manual = Boolean(m.fixed?.[d.date]) && isShift(code)
                        const bad = canEdit && violations.some(v => v.employeeId === m.employeeId && v.date === d.date)
                        return (
                          <td key={d.date} className={d.weekend ? 'is-weekend' : ''}>
                            <button
                              type="button"
                              className={`roster-cell code-${cellClass(code)}${wish ? ' has-wish' : ''}${bad ? ' is-bad' : ''}${manual && canEdit ? ' is-manual' : ''}`}
                              disabled={!canEdit}
                              aria-label={`${m.name} ${fmtDay(d.date)}: ${[labelOf(code) || tx('κενό', 'empty'), wish && tx('επιθυμία ρεπό', 'wishes a day off')].filter(Boolean).join(' · ')}`}
                              title={[labelOf(code), wish && tx('επιθυμία ρεπό', 'wishes a day off'), manual && tx('ορίστηκε με το χέρι', 'set by hand')].filter(Boolean).join(' · ')}
                              onClick={event => {
                                const rect = event.currentTarget.getBoundingClientRect()
                                setNeed(null)
                                setLimits(null)
                                setCell({ employeeId: m.employeeId, date: d.date, top: Math.min(rect.bottom + 4, window.innerHeight - 380), left: Math.min(rect.left, window.innerWidth - 230) })
                              }}
                            >
                              {code ? shortOf(code) : wish ? '★' : ''}
                            </button>
                          </td>
                        )
                      })}
                      {shown.map(s => <td key={s} className="roster-sum">{countOf(m.employeeId, c => kindOf(c) === s)}</td>)}
                      <td className="roster-sum">{countOf(m.employeeId, c => c === 'R')}</td>
                      <td className={`roster-sum roster-total-col${hasShifts && Math.abs(shifts - target) > rules.balanceTolerance ? ' is-off-target' : ''}`}>
                        {shifts} / {target}
                      </td>
                      <td className="roster-sum roster-total-col">{shifts * HOURS} / {target * HOURS}</td>
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
                      const have = active.filter(m => !isExtra(m) && kindOf(codeAt(m.employeeId, d.date)) === s).length
                      const extra = active.filter(m => isExtra(m) && kindOf(codeAt(m.employeeId, d.date)) === s).length
                      const needed = demandFor(roster.demand, d)[s]
                      const own = roster.demand.overrides?.[d.date]?.[s] !== undefined
                      return (
                        <td key={d.date} className={d.weekend ? 'is-weekend' : ''}>
                          <button
                            type="button"
                            className={`roster-need${hasShifts && s !== 'I' && have + extra < needed ? ' is-short' : ''}${own ? ' is-own' : ''}`}
                            title={extra ? tx('Μαζί με τον προϊστάμενο', 'Head of the department included') : undefined}
                            disabled={!canEdit}
                            aria-label={`${CODES[s].name} ${fmtDay(d.date)}: ${have} ${tx('από', 'of')} ${needed}`}
                            onClick={event => {
                              const rect = event.currentTarget.getBoundingClientRect()
                              setCell(null)
                              setLimits(null)
                              setNeed({ date: d.date, shift: s, value: String(needed), top: Math.max(8, rect.top - 124), left: Math.min(rect.left, window.innerWidth - 230) })
                            }}
                          >
                            {/* The head counts on the shift like everyone else (owner, 9/11/2026). */}
                            {have + extra}/{needed}
                          </button>
                        </td>
                      )
                    })}
                    <td className="roster-sum" colSpan={shown.length + 3} />
                  </tr>
                ))}
              </tfoot>
            </table>
          </div>
          {canEdit && inactive.length > 0 && (
            <p className="roster-inactive">
              {tx('Εκτός προγράμματος:', 'Out of the roster:')}{' '}
              {inactive.map(m => (
                <label key={m.employeeId}>
                  <input type="checkbox" checked={false} onChange={() => setMember(m.employeeId, { active: true })} />
                  {m.name}
                </label>
              ))}
            </p>
          )}
          <div className="roster-legend">
            {shown.map(c => <span key={c}><i className={`code-${c}`}>{CODES[c].short}</i>{CODES[c].label}</span>)}
            {others.map(o => <span key={o.code}><i className={`code-${kindOf(o.code)}`}>{shortOf(o.code)}</i>{o.label}</span>)}
            <span><i className="code-R">{CODES.R.short}</i>{CODES.R.label}</span>
            <span><i className="code-leave">{CODES.L.short}</i>{tx('Άδεια / αργία', 'Leave / holiday')}</span>
            <span><i className="code-wish">★</i>{tx('Επιθυμία ρεπό', 'Wishes a day off')}</span>
            {canEdit && <span><i className="code-none is-manual-key" />{tx('Ορίστηκε με το χέρι', 'Set by hand')}</span>}
          </div>
          {canEdit &&
            hasShifts &&
            (violations.length === 0 ? (
              <p className="roster-ok">✓ {tx('Όλοι οι κανόνες τηρούνται.', 'Every rule is kept.')}</p>
            ) : (
              <ul className="roster-violations">
                {/* One line per rule: the first days and the people (their cells are framed red). */}
                {Object.entries(violations.reduce((acc: Record<string, RosterViolation[]>, v) => ({ ...acc, [v.rule]: [...(acc[v.rule] || []), v] }), {})).map(([rule, list]) => {
                  const dates = [...new Set(list.map(v => v.date).filter(Boolean))] as string[]
                  const people = [...new Set(list.map(v => nameOf(v.employeeId as string)).filter(name => name !== '—'))]
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
  )
}
