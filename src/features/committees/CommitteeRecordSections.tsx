import { InactiveEmployeeBadge } from '../../design-system/InactiveEmployeeBadge'
import { useState, type ReactNode } from 'react'
import {
  CheckCircle2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react'
import { ActionButton } from '../../design-system/ActionButton'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { DetailFields } from '../../design-system/DetailList'
import {
  todayIso,
  fmtDate,
  termText,
  statusLabel,
  workflowStatusLabel,
  workflowStatusClass,
  frequencyLabel,
  quorumLabel,
} from './committeeRecordFormat'
import { CheckboxField } from '../../design-system/CheckboxField'
import { memberBadgeRoles, memberRoleLabel, sortMembersByRole } from './committeeMemberRoles'
import type { AnyRecord } from '../../types/featureTypes'

// The rows of a tab and what its buttons do.
interface ListProps {
  rows: AnyRecord[]
  canManage?: boolean
  onAdd: () => void
  onEdit: (row: AnyRecord) => void
  en: boolean
}

// Tab sections of the committee record page (CommitteeRecordPage.jsx).
// The mandate is often one long text with «•» between its points: one line per point.
export function mandateList(text: string) {
  const points = String(text || '').split(/\s*[•▪]\s*|\n+/).map(point => point.trim()).filter(Boolean)
  if (points.length < 2) return text
  return <ul className="committee-mandate-list">{points.map((point, index) => <li key={index}>{point}</li>)}</ul>
}

export function Head({ title, subtitle, action }: { title: ReactNode, subtitle?: ReactNode, action?: ReactNode }) {
  return (
    <div className="record-section-header">
      <div>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Overview({ record, members, en }: { record: AnyRecord, members: AnyRecord[], en: boolean }) {
  const meetings = record.meetings || []
  const next = [...meetings]
    .filter(x => x.date >= todayIso() && !['finalized', 'cancelled'].includes(x.status))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0]
  const checks = [
    {
      ok: members.length > 0,
      label: en ? 'Committee composition' : 'Σύνθεση επιτροπής',
      value: members.length
        ? `${members.length} ${en ? 'active members' : 'ενεργά μέλη'}`
        : en
          ? 'No members yet'
          : 'Δεν έχουν οριστεί μέλη',
    },
    {
      ok: Boolean(record.decisionNumber),
      label: en ? 'Constitution decision' : 'Πράξη σύστασης',
      value: record.decisionNumber || (en ? 'Not recorded' : 'Δεν έχει καταχωριστεί'),
    },
    {
      ok: Boolean(record.legalBasis),
      label: en ? 'Institutional basis' : 'Θεσμική βάση',
      value: record.legalBasis || (en ? 'Not recorded' : 'Δεν έχει καταχωριστεί'),
    },
    {
      ok: Boolean(next),
      label: en ? 'Next meeting' : 'Επόμενη συνεδρίαση',
      value: next
        ? `${fmtDate(next.date)} · ${next.title}`
        : en
          ? 'Not scheduled'
          : 'Δεν έχει προγραμματιστεί',
    },
  ]
  return (
    <section className="record-section committee-overview">
      <Head title={en ? 'Committee profile' : 'Στοιχεία επιτροπής'} />
      <div className="committee-overview-grid">
        <div className="committee-overview-main">
          <DetailFields
            fields={[
              { label: en ? 'Chair' : 'Πρόεδρος / Συντονιστής', value: record.chair },
              { label: en ? 'Secretary' : 'Γραμματέας', value: record.secretary },
              { label: en ? 'Term' : 'Θητεία', value: termText(record.termStart, record.termEnd, en) },
              { label: en ? 'Decision no.' : 'Αρ. απόφασης', value: record.decisionNumber },
              { label: en ? 'Meeting frequency' : 'Συχνότητα', value: frequencyLabel(record.meetingFrequency, en) },
              { label: en ? 'Quorum' : 'Απαρτία', value: quorumLabel(record.quorumRule, en) },
              { label: en ? 'Committee role' : 'Ρόλος επιτροπής', value: record.committeeRole },
              { label: en ? 'Responsibilities / mandate' : 'Αρμοδιότητες / σκοπός', value: mandateList(record.mandate), wide: true },
              { label: en ? 'Legal basis' : 'Νομική / θεσμική βάση', value: record.legalBasis, wide: true },
            ]}
          />
        </div>
        <aside className="committee-governance-watch">
          <div className="committee-watch-head">
            <ShieldCheck size={17} />
            <div>
              <strong>{en ? 'Governance readiness' : 'Ετοιμότητα διακυβέρνησης'}</strong>
              <span>{en ? 'Essential setup checks' : 'Βασικοί έλεγχοι πληρότητας'}</span>
            </div>
          </div>
          {checks.map((item, index) => (
            <div className="committee-watch-item" key={index}>
              <span className={item.ok ? 'ok' : 'attention'}>
                {item.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
              </span>
              <div>
                <small>{item.label}</small>
                <strong>{item.value}</strong>
              </div>
            </div>
          ))}
        </aside>
      </div>
    </section>
  )
}

export function Members({ inactiveCodes, rows, canManage, onAdd, onEdit, onEnd, en, teamShort = '' }: ListProps & { inactiveCodes?: Set<string>, onEnd: (row: AnyRecord) => void, teamShort?: string }) {
  // Former members stay on record (attendance history points at them) but are
  // hidden from the list unless asked for.
  const [showFormer, setShowFormer] = useState(false)
  const formerCount = rows.filter(m => m.active === false).length
  const visible = sortMembersByRole(showFormer ? rows : rows.filter(m => m.active !== false))
  // A column nobody filled in is left out.
  const hasSpecialty = visible.some(m => String(m.specialty || '').trim())
  return (
    <section className="record-section">
      <Head
        title={en ? 'Committee members' : 'Μέλη επιτροπής'}
        subtitle={
          en
            ? 'Membership is ended, not deleted, preserving history.'
            : 'Η συμμετοχή λήγει αντί να διαγράφεται, ώστε να διατηρείται ιστορικότητα.'
        }
        action={
          canManage && (
            <ActionButton
              tone="primary"
              label={en ? 'Add member' : 'Προσθήκη μέλους'}
              onClick={onAdd}
            >
              <Plus size={15} />
              <span>{en ? 'Add member' : 'Προσθήκη μέλους'}</span>
            </ActionButton>
          )
        }
      />
      {formerCount > 0 && (
        <CheckboxField
          className="committee-former-toggle"
          label={en ? `Show former members (${formerCount})` : `Εμφάνιση πρώην μελών (${formerCount})`}
          checked={showFormer}
          onChange={setShowFormer}
        />
      )}
      <div className="scroll-table">
        <table className="data-table">
          <thead>
            <tr>
              <th>{en ? 'Member' : 'Μέλος'}</th>
              <th>{en ? 'Role' : 'Ιδιότητα'}</th>
              {hasSpecialty && <th>{en ? 'Specialty' : 'Ειδικότητα'}</th>}
              <th>{en ? 'Responsibilities' : 'Αρμοδιότητες'}</th>
              <th>{en ? 'Vote' : 'Ψήφος'}</th>
              <th>{en ? 'Period' : 'Περίοδος'}</th>
              {canManage && <th />}
            </tr>
          </thead>
          <tbody>
            {visible.map(m => (
              <tr
                key={m.id}
                className={[
                  m.active === false && 'committee-member-inactive',
                  inactiveCodes?.has(String(m.employeeId || '')) && 'inactive-employee-row',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <td>
                  <strong>{m.name}</strong>
                  <InactiveEmployeeBadge inactive={inactiveCodes?.has(String(m.employeeId || ''))} />
                  {m.external && (
                    <span className="status-badge temporary">
                      {en ? 'Outside staff' : 'Εκτός προσωπικού'}
                    </span>
                  )}
                  {m.active === false && (
                    <span className="status-badge">{en ? 'Former member' : 'Πρώην μέλος'}</span>
                  )}
                  <small>{[m.profession, m.department].filter(Boolean).join(' · ') || '—'}</small>
                </td>
                <td>
                  <span className="committee-member-roles">
                    {memberBadgeRoles(m).map(role => (
                      <span key={role} className="status-badge active committee-role-badge">
                        {memberRoleLabel(role, en)}
                      </span>
                    ))}
                    {m.inControlTeam && <span className="status-badge committee-role-badge">{teamShort || (en ? 'Working team' : 'Ομάδα εργασίας')}</span>}
                  </span>
                  {m.committeeTitle && !memberBadgeRoles(m).some(role => memberRoleLabel(role, en) === m.committeeTitle) && <small>{m.committeeTitle}</small>}
                </td>
                {hasSpecialty && <td className="committee-member-text">{m.specialty || '—'}</td>}
                <td className="committee-member-text">{m.responsibilities || '—'}</td>
                <td>{m.voting ? (en ? 'Yes' : 'Ναι') : en ? 'No' : 'Όχι'}</td>
                <td>
                  {fmtDate(m.startedAt)} –{' '}
                  {m.endedAt ? fmtDate(m.endedAt) : en ? 'today' : 'σήμερα'}
                </td>
                {canManage && (
                  <td>
                    {m.active !== false && (
                      <OverflowMenu
                        label={en ? 'Member actions' : 'Ενέργειες μέλους'}
                        items={[
                          {
                            id: 'edit',
                            label: en ? 'Edit member' : 'Επεξεργασία μέλους',
                            icon: Pencil,
                            onClick: () => onEdit(m),
                          },
                          {
                            id: 'end',
                            label: en ? 'End membership' : 'Λήξη συμμετοχής',
                            icon: Trash2,
                            tone: 'danger',
                            separatorBefore: true,
                            onClick: () => onEnd(m),
                          },
                        ]}
                      />
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <div className="inline-empty">
            {en
              ? 'No members yet. Add the committee composition from here.'
              : 'Δεν υπάρχουν ακόμη μέλη. Προσθέστε τη σύνθεση της επιτροπής από εδώ.'}
          </div>
        )}
      </div>
    </section>
  )
}

export function Meetings({ rows, canCreate, canCancel, onAdd, onOpen, onCancel, en, teamName = '' }: { rows: AnyRecord[], canCreate: boolean, canCancel: boolean, onAdd: () => void, onOpen: (row: AnyRecord) => void, onCancel: (row: AnyRecord) => void, en: boolean, teamName?: string }) {
  return (
    <section className="record-section">
      <Head
        title={en ? 'Meetings & minutes' : 'Συνεδριάσεις & πρακτικά'}
        subtitle={
          en
            ? 'Attendance, quorum, agenda, minutes and governed approvals.'
            : 'Παρουσίες, απαρτία, θέματα, πρακτικά και ελεγχόμενες εγκρίσεις.'
        }
        action={
          canCreate && (
            <ActionButton
              tone="primary"
              label={en ? 'New meeting' : 'Νέα συνεδρίαση'}
              onClick={onAdd}
            >
              <Plus size={15} />
              <span>{en ? 'New meeting' : 'Νέα συνεδρίαση'}</span>
            </ActionButton>
          )
        }
      />
      <div className="scroll-table">
        <table className="data-table record-table-clickable">
          <thead>
            <tr>
              <th>{en ? 'Date' : 'Ημερομηνία'}</th>
              <th>{en ? 'Meeting' : 'Συνεδρίαση'}</th>
              <th>{en ? 'Minutes no.' : 'Αρ. πρακτικού'}</th>
              <th>{en ? 'Quorum' : 'Απαρτία'}</th>
              <th>{en ? 'Status' : 'Κατάσταση'}</th>
              {canCancel && <th />}
            </tr>
          </thead>
          <tbody>
            {[...rows].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).map(x => (
              <tr key={x.id} onClick={() => onOpen(x)}>
                <td>
                  {fmtDate(x.date)}
                  <small>{x.time || ''}</small>
                </td>
                <td>
                  <strong>{x.title}</strong>
                  <small>
                    {x.meetingType === 'extraordinary'
                      ? en
                        ? 'Extraordinary'
                        : 'Έκτακτη'
                      : en
                        ? 'Regular'
                        : 'Τακτική'}
                    {x.location ? ` · ${x.location}` : ''}
                    {x.composition === 'control_team' && teamName ? ` · ${teamName}` : ''}
                  </small>
                  {x.status === 'cancelled' && x.cancellationReason && (
                    <small>
                      {en ? 'Reason' : 'Αιτιολογία'}: {x.cancellationReason}
                    </small>
                  )}
                </td>
                <td>{x.minutesNo || '—'}</td>
                <td>
                  {x.quorum === true
                    ? en
                      ? 'Yes'
                      : 'Ναι'
                    : x.quorum === false
                      ? en
                        ? 'No'
                        : 'Όχι'
                      : '—'}
                </td>
                <td>
                  <span
                    className={`status-badge ${x.status === 'finalized' ? 'active' : x.status === 'approval_pending' ? 'temporary' : ''}`}
                  >
                    {statusLabel(x.status, en)}
                  </span>
                </td>
                {canCancel && (
                  <td>
                    {['draft', 'planned', 'in_progress'].includes(x.status) && (
                      <OverflowMenu
                        label={en ? 'Meeting actions' : 'Ενέργειες συνεδρίασης'}
                        items={[
                          {
                            id: 'cancel',
                            label: en ? 'Cancel meeting' : 'Ακύρωση συνεδρίασης',
                            icon: XCircle,
                            tone: 'danger',
                            onClick: () => onCancel(x),
                          },
                        ]}
                      />
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="inline-empty">
            {en ? 'No meetings yet.' : 'Δεν υπάρχουν ακόμη συνεδριάσεις.'}
          </div>
        )}
      </div>
    </section>
  )
}

export function Decisions({ rows, canManage, onAdd, onEdit, onStatus, en }: ListProps & { onStatus: (row: AnyRecord, status: string) => void }) {
  return (
    <section className="record-section committee-decisions">
      <Head
        title={en ? 'Decisions & actions' : 'Αποφάσεις & ενέργειες'}
        action={
          canManage && (
            <ActionButton
              tone="primary"
              label={en ? 'New decision' : 'Νέα απόφαση'}
              onClick={onAdd}
            >
              <Plus size={15} />
              <span>{en ? 'New decision' : 'Νέα απόφαση'}</span>
            </ActionButton>
          )
        }
      />
      <div className="scroll-table">
        <table className="data-table">
          <thead>
            <tr>
              <th>{en ? 'Decision' : 'Απόφαση'}</th>
              <th>{en ? 'Owner' : 'Υπεύθυνος'}</th>
              <th>{en ? 'Due' : 'Προθεσμία'}</th>
              <th>{en ? 'Status' : 'Κατάσταση'}</th>
              {canManage && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map(x => (
              // A decision row opens the decision (for those who manage decisions).
              <tr
                key={x.id}
                className={canManage ? 'clickable-row' : undefined}
                tabIndex={canManage ? 0 : undefined}
                onClick={canManage ? () => onEdit(x) : undefined}
                onKeyDown={
                  canManage
                    ? event => {
                        if (
                          event.target === event.currentTarget &&
                          (event.key === 'Enter' || event.key === ' ')
                        ) {
                          event.preventDefault()
                          onEdit(x)
                        }
                      }
                    : undefined
                }
              >
                <td>
                  <strong>{x.title}</strong>
                  <small>{x.action || '—'}</small>
                </td>
                <td>{x.owner || '—'}</td>
                <td>{fmtDate(x.dueDate)}</td>
                <td>
                  <span className={`status-badge ${workflowStatusClass(x.status)}`}>
                    {workflowStatusLabel(x.status, en)}
                  </span>
                </td>
                {canManage && (
                  <td
                    onClick={event => event.stopPropagation()}
                    onKeyDown={event => event.stopPropagation()}
                  >
                    <OverflowMenu
                      label={en ? 'Decision actions' : 'Ενέργειες απόφασης'}
                      items={[
                        {
                          id: 'edit',
                          label: en ? 'Edit decision' : 'Επεξεργασία απόφασης',
                          icon: Pencil,
                          onClick: () => onEdit(x),
                        },
                        x.status !== 'completed' && {
                          id: 'complete',
                          label: en ? 'Mark completed' : 'Σήμανση ως ολοκληρωμένη',
                          icon: CheckCircle2,
                          onClick: () => onStatus(x, 'completed'),
                        },
                      ].filter(Boolean)}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="inline-empty">
            {en ? 'No decisions or actions yet.' : 'Δεν υπάρχουν ακόμη αποφάσεις ή ενέργειες.'}
          </div>
        )}
      </div>
    </section>
  )
}

export function Plan({ rows, canManage, onAdd, onEdit, onDelete, en }: ListProps & { onDelete: (row: AnyRecord) => void }) {
  return (
    <section className="record-section">
      <Head
        title={en ? 'Annual action plan' : 'Ετήσιο σχέδιο δράσης'}
        action={
          canManage && (
            <ActionButton
              tone="primary"
              label={en ? 'New objective' : 'Νέος στόχος'}
              onClick={onAdd}
            >
              <Plus size={15} />
              <span>{en ? 'New objective' : 'Νέος στόχος'}</span>
            </ActionButton>
          )
        }
      />
      <div className="scroll-table">
        <table className="data-table">
          <thead>
            <tr>
              <th>{en ? 'Objective' : 'Στόχος'}</th>
              <th>{en ? 'Indicator' : 'Δείκτης'}</th>
              <th>{en ? 'Baseline → target' : 'Αφετηρία → στόχος'}</th>
              <th>{en ? 'Owner' : 'Υπεύθυνος'}</th>
              <th>{en ? 'Due' : 'Προθεσμία'}</th>
              <th>{en ? 'Status' : 'Κατάσταση'}</th>
              {canManage && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map(x => (
              <tr key={x.id}>
                <td>
                  <strong>{x.title}</strong>
                </td>
                <td>{x.indicator || '—'}</td>
                <td>
                  {x.baseline || '—'} → {x.target || '—'}
                </td>
                <td>{x.owner || '—'}</td>
                <td>{fmtDate(x.dueDate)}</td>
                <td>
                  <span className={`status-badge ${workflowStatusClass(x.status)}`}>
                    {workflowStatusLabel(x.status, en)}
                  </span>
                </td>
                {canManage && (
                  <td>
                    <OverflowMenu
                      label={en ? 'Objective actions' : 'Ενέργειες στόχου'}
                      items={[
                        {
                          id: 'edit',
                          label: en ? 'Edit objective' : 'Επεξεργασία στόχου',
                          icon: Pencil,
                          onClick: () => onEdit(x),
                        },
                        {
                          id: 'delete',
                          label: en ? 'Delete objective' : 'Διαγραφή στόχου',
                          icon: Trash2,
                          tone: 'danger',
                          separatorBefore: true,
                          onClick: () => onDelete(x),
                        },
                      ]}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="inline-empty">
            {en ? 'No annual-plan objectives yet.' : 'Δεν υπάρχουν ακόμη στόχοι ετήσιου σχεδίου.'}
          </div>
        )}
      </div>
    </section>
  )
}

export function History({ rows, en }: { rows: AnyRecord[], en: boolean }) {
  return (
    <section className="record-section">
      <Head title={en ? 'Committee history' : 'Ιστορικό επιτροπής'} />
      <div className="scroll-table">
        <table className="data-table">
          <thead>
            <tr>
              <th>{en ? 'Date / time' : 'Ημερομηνία / ώρα'}</th>
              <th>{en ? 'Action' : 'Ενέργεια'}</th>
              <th>{en ? 'Details' : 'Στοιχεία'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x, i) => (
              <tr key={x.id || i}>
                <td>{x.at ? new Date(x.at).toLocaleString(en ? 'en-GB' : 'el-GR') : '—'}</td>
                <td>
                  <strong>{x.action}</strong>
                </td>
                <td>{x.reason || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="inline-empty">
            {en ? 'No history yet.' : 'Δεν υπάρχει ακόμη ιστορικό.'}
          </div>
        )}
      </div>
    </section>
  )
}
