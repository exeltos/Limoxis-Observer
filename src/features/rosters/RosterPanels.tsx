import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { ManualDateField } from '../../design-system/ManualDateField'
import { Field } from '../../design-system/Field'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { TimeField } from '../../design-system/TimeField'
import { StatusBadge } from '../../design-system/StatusBadge'
import { customShifts, kindOf } from './rosterEngine'
import { IASO_SHIFT_CODES } from './iasoShiftCodes'
import { headsFirst } from './rosterService'
import { LEAVES, RULE_FIELDS, SHIFTS, isExtra, type NeedMenu, type RosterView } from './rosterPageModel'

// A member of the department’s staff: their requests and a new one (the «Τα αιτήματά μου» panel).
export function RosterMyRequests({ view }: { view: RosterView }) {
  const { tx, REQUEST_KINDS, REQUEST_STATUS, ask, setAsk, me, sendRequest, withdraw, active, nameOf, fmtDay, myRequests } = view
  return (
        <section className="roster-panel roster-requests" aria-label={tx('Τα αιτήματά μου', 'My requests')}>
          {!me ? (
            <p className="roster-muted">{tx('Ο λογαριασμός σας δεν έχει συνδεθεί με εργαζόμενο του τμήματος· ζητήστε το από τον διαχειριστή.', 'Your account is not linked to an employee of the department; ask the administrator.')}</p>
          ) : (
            <>
              <div className="roster-ask">
                <Field label={tx('Αίτημα', 'Request')}>
                  <select value={ask.kind} onChange={event => setAsk(current => ({ ...current, kind: event.target.value }))}>
                    {Object.entries(REQUEST_KINDS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
                  </select>
                </Field>
                <ManualDateField label={ask.kind === 'swap' ? tx('Ημέρα', 'Day') : tx('Από', 'From')} value={ask.from} onChange={value => setAsk(current => ({ ...current, from: value }))} />
                {ask.kind === 'swap' ? (
                  <Field label={tx('Με συνάδελφο', 'With colleague')}>
                    <select value={ask.swapEmployeeId} onChange={event => setAsk(current => ({ ...current, swapEmployeeId: event.target.value }))}>
                      <option value="">{tx('Επιλογή…', 'Choose…')}</option>
                      {active.filter(m => m.employeeId !== me.employeeId).map(m => <option key={m.employeeId} value={m.employeeId}>{m.name}</option>)}
                    </select>
                  </Field>
                ) : (
                  <ManualDateField label={tx('Έως', 'Until')} value={ask.to} onChange={value => setAsk(current => ({ ...current, to: value }))} optional />
                )}
                <Field label={tx('Σημείωση', 'Note')}>
                  <input value={ask.note} maxLength={500} onChange={event => setAsk(current => ({ ...current, note: event.target.value }))} />
                </Field>
                <Button onClick={sendRequest} disabled={!ask.from || (ask.kind === 'swap' && !ask.swapEmployeeId)}>{tx('Αποστολή', 'Send')}</Button>
              </div>
              {myRequests.map(r => (
                <div key={r.id} className="roster-request">
                  <strong>{REQUEST_KINDS[r.kind]}</strong>
                  <span>{r.kind === 'swap' ? `${fmtDay(r.from)} · ${r.employeeId === me.employeeId ? `${tx('με', 'with')} ${nameOf(r.swapEmployeeId)}` : `${tx('από', 'from')} ${nameOf(r.employeeId)}`}` : r.to && r.to !== r.from ? `${fmtDay(r.from)} – ${fmtDay(r.to)}` : fmtDay(r.from)}</span>
                  {r.note && <small>«{r.note}»</small>}
                  <StatusBadge tone={REQUEST_STATUS[r.status][1]}>{REQUEST_STATUS[r.status][0]}</StatusBadge>
                  {r.status === 'pending' && r.employeeId === me.employeeId && <Button variant="secondary" onClick={() => withdraw(r)}>{tx('Ανάκληση', 'Withdraw')}</Button>}
                </div>
              ))}
            </>
          )}
        </section>
  )
}

// People per shift, the department’s other shifts and the rules («Άτομα ανά βάρδια & κανόνες»).
export function RosterRulesDialog({ view }: { view: RosterView }) {
  const { tx, roster, codeStyle, CODES, RULE_LABELS, dirty, saving, setPanel, newShift, setNewShift, rules, update, setDemand, setRule, addOther, setOther, removeOther, save } = view
  return (
        <ObserverDialog
          title={tx('Άτομα ανά βάρδια & κανόνες', 'People per shift & rules')}
          width="wide"
          className="roster-rules-dialog"
          onClose={() => setPanel('')}
          footer={<SaveButton onClick={async () => { if (await save()) setPanel('') }} loading={saving} disabled={!dirty}>{tx('Αποθήκευση', 'Save')}</SaveButton>}
        >
        <section className="roster-panel roster-panel-rules" aria-label={tx('Άτομα ανά βάρδια & κανόνες', 'People per shift & rules')}>
          <div className="roster-col">
          <b className="roster-col-title">{tx('Άτομα ανά βάρδια', 'People per shift')}</b>
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
          </div>
          <div className="roster-others">
            <b>{tx('Άλλες βάρδιες του τμήματος', 'Other shifts of the department')}</b>
            {customShifts(roster.demand).length > 0 && (
              <div className="roster-other roster-other-head" aria-hidden="true">
                <span />
                <span />
                <b>{tx('Καθημ.', 'Weekday')}</b>
                <b>{tx('Σ/Κ', 'Weekend')}</b>
                <span />
              </div>
            )}
            {customShifts(roster.demand).map(o => (
              <div key={o.code} className="roster-other">
                <i className={`code-${kindOf(o.code)}`}>{o.code.split(':')[1]}</i>
                <span>{o.label} · {CODES[kindOf(o.code)]?.name}</span>
                {['weekday', 'weekend'].map(kind => (
                  <input key={kind} type="number" min="0" max="20" aria-label={`${o.code.split(':')[1]} ${kind === 'weekday' ? tx('καθημερινή', 'weekday') : tx('Σαββατοκύριακο', 'weekend')}`} value={o[kind] ?? 0} onChange={event => setOther(o.code, { [kind]: Math.max(0, Math.min(20, Number(event.target.value) || 0)) })} />
                ))}
                <button type="button" className="roster-other-remove" aria-label={tx(`Αφαίρεση βάρδιας ${o.code.split(':')[1]}`, `Remove shift ${o.code.split(':')[1]}`)} onClick={() => removeOther(o.code)}>×</button>
              </div>
            ))}
            {codeStyle === 'iaso' ? (
              <SearchableSelect
                label={tx('Προσθήκη από τους κωδικούς του νοσοκομείου', 'Add from the hospital’s codes')}
                placeholder={tx('Επιλέξτε κωδικό…', 'Choose a code…')}
                value=""
                onChange={value => {
                  const row = IASO_SHIFT_CODES.find(([code]) => code === value)
                  if (row) addOther(row[0], row[1], row[2])
                }}
                options={IASO_SHIFT_CODES.filter(([code]) => !['4', '12', '19', '20'].includes(code)).map(([code, from, to]) => ({ value: code, label: `${code} · ${from}–${to}` }))}
              />
            ) : (
              <div className="roster-other-new">
                <Field label={tx('Κωδικός', 'Code')}>
                  <input value={newShift.code} maxLength={6} onChange={event => setNewShift(current => ({ ...current, code: event.target.value }))} />
                </Field>
                <TimeField label={tx('Από', 'From')} value={newShift.from} onChange={value => setNewShift(current => ({ ...current, from: value }))} />
                <TimeField label={tx('Έως', 'Until')} value={newShift.to} onChange={value => setNewShift(current => ({ ...current, to: value }))} />
                <Button variant="secondary" onClick={() => addOther(newShift.code, newShift.from, newShift.to)} disabled={!newShift.code || !newShift.from || !newShift.to}>{tx('Προσθήκη', 'Add')}</Button>
              </div>
            )}
            <p className="roster-muted">{tx('Μετράει στην κατηγορία της (από την ώρα έναρξης)· με αριθμό ατόμων τη βάζει και η αυτόματη δημιουργία, με 0 μόνο με το χέρι.', 'Counts in its kind (by its start); with a number of people the automatic roster places it too, with 0 only by hand.')}</p>
          </div>
          <div className="roster-rule-list">
            <b className="roster-col-title">{tx('Κανόνες', 'Rules')}</b>
            <div className="roster-rule">
              <span>{tx('Κωδικοί βαρδιών', 'Shift codes')}</span>
              <select aria-label={tx('Κωδικοί βαρδιών', 'Shift codes')} value={codeStyle} onChange={event => update({ ...roster, rules: { ...roster.rules, codes: event.target.value } })}>
                <option value="letters">{tx('Γράμματα (Π, Α, Ν, Ρ)', 'Letters (M, A, N, R)')}</option>
                <option value="iaso">{tx('Αριθμοί μισθοδοσίας (4, 19, 20, R)', 'Payroll numbers (4, 19, 20, R)')}</option>
              </select>
            </div>
            {RULE_FIELDS.map(key => (
              <div key={key} className="roster-rule">
                <span>{RULE_LABELS[key]}</span>
                <input type="number" min="0" max="14" aria-label={RULE_LABELS[key]} value={rules[key] as number} onChange={event => setRule(key, event.target.value)} />
              </div>
            ))}
            <p className="roster-muted">{tx('Πάντα: όχι απόγευμα → πρωί (11 ώρες ανάπαυση), όχι πρωί/ενδιάμεση → νύχτα· ίσες βάρδιες, νύχτες και Σ/Κ· ρεπό κατά προτίμηση ανά δύο. Με κλικ σε όνομα: ποιες βάρδιες κάνει το άτομο.', 'Always: no afternoon → morning (11 hours of rest), no morning/intermediate → night; even shifts, nights and weekends; days off preferably in pairs. Click a name: the shifts that person works.')}</p>
          </div>
        </section>
        </ObserverDialog>
  )
}

// The small menus over the sheet: a cell’s code, a day’s number of people and a person’s limits.
export function RosterPopovers({ view }: { view: RosterView }) {
  const { tx, roster, CODES, cell, setCell, need, setNeed, limits, setLimits, update, setMember, setDayNeed, setCode, nameOf, others, shortOf, fmtDay } = view
  return (
    <>
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
            {others.map(o => (
              <button key={o.code} type="button" role="menuitem" onClick={() => setCode(cell.employeeId, cell.date, o.code)}>
                <i className={`code-${kindOf(o.code)}`}>{shortOf(o.code)}</i>
                {o.label} · {CODES[kindOf(o.code)]?.name}
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
              <input type="number" min="0" max="20" value={need.value} onChange={event => setNeed(current => ({ ...(current as NeedMenu), value: event.target.value }))} />
            </label>
            <div className="roster-need-actions">
              <button type="button" onClick={() => { setDayNeed(need.date, need.shift, null); setNeed(null) }}>{tx('Όπως οι άλλες μέρες', 'Like the other days')}</button>
              <button type="button" className="is-primary" onClick={() => { setDayNeed(need.date, need.shift, need.value); setNeed(null) }}>{tx('Ορισμός', 'Set')}</button>
            </div>
          </div>
        </>
      )}
      {limits && (
        <>
          <div className="roster-cell-backdrop" onClick={() => setLimits(null)} aria-hidden="true" />
          <div className="roster-cell-menu roster-limits-menu" role="dialog" aria-label={tx('Βάρδιες που κάνει', 'Shifts this person works')} style={{ top: limits.top, left: limits.left }}>
            <p>{nameOf(limits.employeeId)}</p>
            <label className="roster-limit roster-head-choice">
              <input
                type="checkbox"
                checked={Boolean(roster.members.find(m => m.employeeId === limits.employeeId)?.isHead)}
                onChange={event => update({ ...roster, members: headsFirst(roster.members.map(m => (m.employeeId === limits.employeeId ? { ...m, headSet: event.target.checked, isHead: event.target.checked } : m))) })}
              />
              {tx('Προϊστάμενος/η τμήματος (πρώτος στη λίστα)', 'Head of the department (first in the list)')}
            </label>
            {(() => {
              const member = roster.members.find(m => m.employeeId === limits.employeeId)
              if (!member) return null
              return (
                <>
                  <label className="roster-limit">
                    <input type="checkbox" checked={isExtra(member)} onChange={event => setMember(member.employeeId, { extra: event.target.checked })} />
                    {tx('Υπεράριθμος: δεν μετράει στις βάρδιες (μόνο αν δεν βγαίνει το πρόγραμμα)', 'Supernumerary: not counted in the shifts (only if the roster cannot be made otherwise)')}
                  </label>
                  <label className="roster-limit">
                    <input type="checkbox" checked={Boolean(member.noWeekends)} onChange={event => setMember(member.employeeId, { noWeekends: event.target.checked })} />
                    {tx('Χωρίς Σαββατοκύριακα', 'No weekends')}
                  </label>
                  <label className="roster-limit roster-limit-number">
                    <span>{tx('Νύχτες την περίοδο, έως', 'Nights in the period, at most')}</span>
                    <input type="number" min="0" max="31" placeholder="—" value={member.maxNights ?? ''} onChange={event => setMember(member.employeeId, { maxNights: event.target.value === '' ? undefined : Math.max(0, Math.min(31, Number(event.target.value) || 0)) })} />
                  </label>
                  <label className="roster-limit roster-limit-number">
                    <span>{tx('Απασχόληση %', 'Working time %')}</span>
                    <input type="number" min="10" max="100" step="5" placeholder="100" value={member.percent ?? ''} onChange={event => setMember(member.employeeId, { percent: event.target.value === '' ? undefined : Math.max(10, Math.min(100, Number(event.target.value) || 100)) })} />
                  </label>
                </>
              )
            })()}
            <p className="roster-limits-title">{tx('Βάρδιες που κάνει', 'Shifts worked')}</p>
            {SHIFTS.map(code => {
              const member = roster.members.find(m => m.employeeId === limits.employeeId)
              const allowed = Array.isArray(member?.allowed) && member.allowed.length ? member.allowed : SHIFTS
              const on = allowed.includes(code)
              return (
                <label key={code} className="roster-limit">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => {
                      const next = on ? allowed.filter(c => c !== code) : [...allowed, code]
                      if (!next.length) return
                      setMember(limits.employeeId, { allowed: next.length === SHIFTS.length ? undefined : SHIFTS.filter(c => next.includes(c)) })
                    }}
                  />
                  <i className={`code-${code}`}>{CODES[code].short}</i>
                  {CODES[code].label}
                </label>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}
