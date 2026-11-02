import { useState } from 'react'
import { Clock, Eye, Link2, ShieldCheck, TriangleAlert, UserPlus } from 'lucide-react'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { CheckboxField } from '../../design-system/CheckboxField'
import { roleLabel } from '../../core/permissions/roleLabels'
import { needsDepartment, reasonText } from './bulkAccountsModel'

const day = (value, language, withWeekday = false) =>
  value
    ? new Date(value).toLocaleDateString(language === 'en' ? 'en-GB' : 'el-GR', {
        ...(withWeekday ? { weekday: 'long' } : {}),
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Europe/Athens',
      })
    : ''
const time = (value, language) =>
  value ? new Date(value).toLocaleTimeString(language === 'en' ? 'en-GB' : 'el-GR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Athens' }) : ''

// The confirmation of a bulk run (n1-3): people per role and department, the
// link's validity, e-mails that already have an account in another hospital (each
// confirmed one by one, no second account), who is skipped, that only the
// Platform Owner can do this, and the e-mail of the first recipient.
export function BulkAccountsConfirmDialog({ organization, language, items, rowsById, departments, preview, confirmedExisting, onToggleExisting, running, progress, onBack, onConfirm }) {
  const en = language === 'en'
  const tx = (el, enText) => (en ? enText : el)
  const [fullEmail, setFullEmail] = useState(false)
  const existingIds = new Set((preview?.existing || []).map(row => row.employeeId))
  const skippedIds = new Set((preview?.skipped || []).map(row => row.employeeId))
  const runItems = items.filter(item => !skippedIds.has(item.employeeId) && (!existingIds.has(item.employeeId) || confirmedExisting.has(item.employeeId)))
  const byRole = new Map()
  for (const item of runItems) {
    const row = byRole.get(item.role) || { role: item.role, count: 0, departments: [] }
    row.count++
    const name = needsDepartment(item.role) ? departmentName(item, rowsById, departments) : ''
    if (name && !row.departments.includes(name)) row.departments.push(name)
    byRole.set(item.role, row)
  }
  const roles = [...byRole.values()].sort((a, b) => b.count - a.count)
  const count = runItems.length
  const email = preview?.emailPreview
  const firstItem = email ? items.find(item => rowsById.get(item.employeeId)?.name === email.name) : null
  return (
    <>
      <ObserverDialog
        eyebrow={`${organization.name} · ${tx('Δημιουργία λογαριασμών', 'Account creation')}`}
        title={tx(`${count} λογαριασμοί από το μητρώο εργαζομένων`, `${count} accounts from the employee roster`)}
        subtitle={tx(
          'Κάθε λογαριασμός συνδέεται με την καρτέλα του εργαζομένου. Ο καθένας λαμβάνει δικό του email με όνομα χρήστη και σύνδεσμο «Ορισμός κωδικού».',
          'Each account is linked to the employee record. Everyone receives their own e-mail with a username and a «Set password» link.',
        )}
        width="wide"
        onClose={() => !running && onBack()}
        footer={
          <>
            <Button variant="secondary" disabled={running} onClick={onBack}>
              {tx('Πίσω στη λίστα', 'Back to the list')}
            </Button>
            <Button disabled={!count || running || !preview} loading={running} onClick={onConfirm}>
              <UserPlus size={16} />
              {running
                ? tx(`Δημιουργία… ${progress.done}/${progress.total}`, `Creating… ${progress.done}/${progress.total}`)
                : tx(`Δημιουργία ${count} & αποστολή`, `Create ${count} & send`)}
            </Button>
          </>
        }
      >
        {!preview ? (
          <div className="inline-empty">{tx('Έλεγχος της επιλογής…', 'Checking the selection…')}</div>
        ) : (
          <div className="bulk-accounts-dialog-grid">
            <div className="bulk-accounts-dialog-column">
              <table className="bulk-accounts-dialog-table">
                <thead>
                  <tr>
                    <th>{tx('Ρόλος', 'Role')}</th>
                    <th className="num">{tx('Άτομα', 'People')}</th>
                    <th>{tx('Εμβέλεια', 'Scope')}</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map(row => (
                    <tr key={row.role}>
                      <td>
                        <strong>{roleLabel(row.role, language)}</strong>
                      </td>
                      <td className="num">
                        <strong>{row.count}</strong>
                      </td>
                      <td className="bulk-accounts-muted">{row.departments.length ? row.departments.join(', ') : tx('όλο το νοσοκομείο', 'whole hospital')}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <strong>{tx('Σύνολο', 'Total')}</strong>
                    </td>
                    <td className="num">
                      <strong>{count}</strong>
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
              <div className="bulk-accounts-callout">
                <Clock size={16} />
                <div>
                  <strong>{tx('Ισχύς συνδέσμου: 7 ημέρες', 'Link validity: 7 days')}</strong>
                  <br />
                  {tx(
                    `Έως ${day(preview.expiresAt, language, true)}, ${time(preview.expiresAt, language)}. Μετά τη λήξη, «Ξαναστείλε» από τη λίστα.`,
                    `Until ${day(preview.expiresAt, language, true)}, ${time(preview.expiresAt, language)}. After that, «Resend» from the list.`,
                  )}
                </div>
              </div>
              {preview.existing?.length > 0 && (
                <div className="bulk-accounts-callout is-warning">
                  <Link2 size={16} />
                  <div>
                    <strong>
                      {preview.existing.length === 1
                        ? tx('1 email υπάρχει ήδη σε άλλο νοσοκομείο', '1 e-mail already exists in another hospital')
                        : tx(`${preview.existing.length} email υπάρχουν ήδη σε άλλο νοσοκομείο`, `${preview.existing.length} e-mails already exist in another hospital`)}
                    </strong>
                    <br />
                    {tx(
                      'Δεν φτιάχνεται δεύτερος λογαριασμός: ο ίδιος λογαριασμός αποκτά τον ρόλο και εδώ και λαμβάνει email ενημέρωσης χωρίς νέο κωδικό. Επιβεβαιώστε κάθε άτομο:',
                      'No second account is made: the same account gets the role here too and an e-mail notice, without a new password. Confirm each person:',
                    )}
                    {preview.existing.map(row => (
                      <CheckboxField
                        key={row.employeeId}
                        className="bulk-accounts-existing"
                        checked={confirmedExisting.has(row.employeeId)}
                        disabled={running}
                        onChange={() => onToggleExisting(row.employeeId)}
                        label={tx(
                          `${row.name} έχει λογαριασμό στο ${(row.organizations || []).join(', ') || 'άλλο νοσοκομείο'}${row.existingName && row.existingName !== row.name ? ` (ως «${row.existingName}»)` : ''}: ρόλος «${roleLabel(row.role, language)}» και εδώ`,
                          `${row.name} has an account at ${(row.organizations || []).join(', ') || 'another hospital'}${row.existingName && row.existingName !== row.name ? ` (as «${row.existingName}»)` : ''}: role «${roleLabel(row.role, language)}» here too`,
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}
              {preview.skipped?.length > 0 && (
                <div className="bulk-accounts-callout is-danger">
                  <TriangleAlert size={16} />
                  <div>
                    <strong>{tx(`Παραλείπονται ${preview.skipped.length}`, `${preview.skipped.length} skipped`)}</strong>
                    {preview.skipped.map(row => (
                      <div key={row.employeeId}>
                        {row.name || '—'}: {reasonText(row.code, language)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="bulk-accounts-callout is-success">
                <ShieldCheck size={16} />
                <div>
                  {tx(
                    'Μόνο ο Διαχειριστής του νοσοκομείου και ο Ιδιοκτήτης Πλατφόρμας δημιουργούν λογαριασμούς μαζικά. Ο έλεγχος γίνεται και στον server· η ενέργεια καταγράφεται στο Ιστορικό.',
                    'Only the hospital administrator and the Platform Owner create accounts in bulk. The server checks it too; the action is recorded in the history.',
                  )}
                </div>
              </div>
            </div>
            <div className="bulk-accounts-dialog-column">
              <div className="bulk-accounts-mail-heading">
                <span className="eyebrow">{tx('Προεπισκόπηση email', 'E-mail preview')}</span>
                {email && <span className="bulk-accounts-muted">{tx(`για: ${email.name}`, `to: ${email.name}`)}</span>}
              </div>
              {email ? (
                <div className="bulk-accounts-mail">
                  <header>
                    <b>{tx('Θέμα', 'Subject')}:</b> {email.subject}
                    <br />
                    <b>{tx('Από', 'From')}:</b> Limoxis Observer
                    {email.replyTo && (
                      <>
                        <br />
                        <b>{tx('Απάντηση σε', 'Reply to')}:</b> {email.replyTo}
                      </>
                    )}
                  </header>
                  <div className="bulk-accounts-mail-body">
                    <strong>{tx(`Καλώς ήρθατε, ${email.name}`, `Welcome, ${email.name}`)}</strong>
                    <br />
                    {tx(
                      `Το ${organization.name} δημιούργησε για εσάς λογαριασμό στο Limoxis Observer, την πλατφόρμα του νοσοκομείου για την πρόληψη λοιμώξεων και την ποιότητα.`,
                      `${organization.name} created an account for you in Limoxis Observer, the hospital's infection-prevention and quality platform.`,
                    )}
                    <p>
                      <span className="bulk-accounts-muted">{tx('Όνομα χρήστη', 'Username')}</span> <code>AB12345</code>
                      {firstItem && (
                        <>
                          {' · '}
                          <span className="bulk-accounts-muted">{tx('Ρόλος', 'Role')}</span> {roleLabel(firstItem.role, language)}
                          {needsDepartment(firstItem.role) && departmentName(firstItem, rowsById, departments) ? ` · ${departmentName(firstItem, rowsById, departments)}` : ''}
                        </>
                      )}
                    </p>
                    <span className="bulk-accounts-mail-button">{tx('Ορισμός κωδικού →', 'Set password →')}</span>
                    <p className="bulk-accounts-muted">
                      {tx(`Ο σύνδεσμος ισχύει έως ${day(preview.expiresAt, language)}. Βοήθεια: `, `The link is valid until ${day(preview.expiresAt, language)}. Help: `)}
                      {[organization.name, organization.contact_email, organization.contact_phone].filter(Boolean).join(' · ')}.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="inline-empty">{tx('Δεν υπάρχει νέος λογαριασμός για προεπισκόπηση.', 'No new account to preview.')}</div>
              )}
              {email && (
                <Button variant="secondary" className="bulk-accounts-mail-open" onClick={() => setFullEmail(true)}>
                  <Eye size={16} />
                  {tx('Ολόκληρο το email', 'Full e-mail')}
                </Button>
              )}
            </div>
          </div>
        )}
      </ObserverDialog>
      {fullEmail && email && (
        <ObserverDialog eyebrow={tx('Προεπισκόπηση email', 'E-mail preview')} title={email.subject} width="wide" onClose={() => setFullEmail(false)}>
          <iframe className="bulk-accounts-email-frame" title={email.subject} sandbox="" srcDoc={email.html} />
        </ObserverDialog>
      )}
    </>
  )
}

function departmentName(item, rowsById, departments) {
  if (!item.departmentId) return ''
  const own = rowsById.get(item.employeeId)
  if (own?.departmentId === item.departmentId) return own.departmentName
  return (departments || []).find(d => d.id === item.departmentId)?.name || [...rowsById.values()].find(row => row.departmentId === item.departmentId)?.departmentName || ''
}
