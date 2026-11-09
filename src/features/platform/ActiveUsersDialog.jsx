import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, KeyRound, Upload } from 'lucide-react'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { ExportMenu } from '../../design-system/ExportMenu'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { roleLabel } from '../../core/permissions/roleLabels'
import { readSpreadsheet } from '../../core/import/spreadsheetImport'
import { downloadXlsx } from '../../core/export/xlsxExport'
import { ROLES } from './platformOrganizationShared'
import { checkPerson, errorText, mergeVerdicts, needsDepartment, planFile, previewCounts, resultsSheet, templateSheet } from './activeUsersModel'
import { createActiveUsers, previewActiveUsers } from './activeUsersService'
import './activeUsers.css'

const EMPTY = { fullName: '', email: '', username: '', role: 'department_user', departmentId: '', employeeCode: '' }

// «Νέος ενεργός χρήστης» (mode single) and «Εισαγωγή χρηστών από αρχείο» (mode file),
// Platform Owner only, in the hospital's record › «Χρήστες & Ρόλοι». The accounts are
// created active with a temporary password, shown once here and in the Excel of the
// results; the user changes it at the first sign-in. The welcome e-mail never carries it.
export function ActiveUsersDialog({ mode = 'single', organization, departments = [], language = 'el', onClose, onCreated }) {
  const en = language === 'en'
  const tx = (el, enText) => (en ? enText : el)
  const { confirm, notifyError } = useFeedback()
  const [draft, setDraft] = useState(EMPTY)
  const [fileName, setFileName] = useState('')
  const [readError, setReadError] = useState('')
  const [plan, setPlan] = useState(null)
  const [people, setPeople] = useState(null)
  const [checking, setChecking] = useState(false)
  const [progress, setProgress] = useState(null)
  const [results, setResults] = useState(null)
  const [downloaded, setDownloaded] = useState(false)
  const [singleError, setSingleError] = useState('')

  const counts = useMemo(() => (people ? previewCounts(people) : { ok: 0, error: 0 }), [people])
  const ready = people ? people.filter(person => person.status === 'ok') : []
  const created = results ? results.filter(row => row.status === 'created') : []
  const busy = checking || Boolean(progress)

  async function verify(list) {
    setChecking(true)
    try {
      const clean = list.filter(person => !person.errors.length)
      const verdicts = clean.length ? await previewActiveUsers(organization.id, clean) : []
      const merged = mergeVerdicts(list, verdicts)
      setPeople(merged)
      return merged
    } catch (error) {
      notifyError(error, 'load', { operation: 'platform_active_users_preview' })
      return null
    } finally {
      setChecking(false)
    }
  }

  async function pick(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setReadError('')
    setPeople(null)
    setPlan(null)
    setFileName(file.name)
    try {
      const next = planFile(await readSpreadsheet(file), departments, en)
      setPlan(next)
      if (!next.missingColumns.length && next.people.length) await verify(next.people)
    } catch (error) {
      setReadError(error?.message === 'SPREADSHEET_UNSUPPORTED_TYPE' ? tx('Επιλέξτε αρχείο .xlsx ή .csv.', 'Choose an .xlsx or .csv file.') : tx('Δεν ήταν δυνατή η ανάγνωση του αρχείου.', 'The file could not be read.'))
    }
  }

  async function run(list) {
    setProgress({ done: 0, total: list.length })
    try {
      const rows = await createActiveUsers(organization.id, list, { onProgress: (done, total) => setProgress({ done, total }) })
      setResults(rows)
      if (rows.some(row => row.status === 'created')) onCreated?.()
    } catch (error) {
      notifyError(error, 'save', { operation: 'platform_active_users_create' })
    } finally {
      setProgress(null)
    }
  }

  async function createSingle() {
    setSingleError('')
    const person = checkPerson({ ...draft, line: 1, department: '' }, departments)
    if (person.errors.length) {
      setSingleError(errorText(person.errors[0], en))
      return
    }
    const merged = await verify([person])
    const verdict = merged?.[0]
    if (!verdict) return
    if (verdict.status !== 'ok') {
      setSingleError(errorText(verdict.code, en))
      return
    }
    await run([verdict])
  }

  function download() {
    downloadXlsx(`${organization.code || 'organization'}-${tx('energoi-xristes', 'active-users')}.xlsx`, [resultsSheet(results, en)])
    setDownloaded(true)
  }

  async function close() {
    if (busy) return
    if (created.length && !downloaded) {
      const ok = await confirm({
        title: tx('Κλείσιμο χωρίς λήψη;', 'Close without downloading?'),
        message: tx('Οι προσωρινοί κωδικοί δεν θα εμφανιστούν ξανά. Αν κλείσετε τώρα χωρίς να τους κατεβάσετε ή να τους σημειώσετε, θα χρειαστεί νέα επαναφορά κωδικού για κάθε χρήστη.', 'The temporary passwords will not be shown again. If you close now without downloading or noting them, each user will need a new password reset.'),
        confirmLabel: tx('Κλείσιμο', 'Close'),
        danger: true,
      })
      if (!ok) return
    }
    onClose()
  }

  const footer = results ? (
    <DialogActions>
      <ExportMenu items={[{ id: 'accounts', kind: 'excel', label: tx('Excel: λογαριασμοί και προσωρινοί κωδικοί', 'Excel: accounts and temporary passwords'), disabled: !created.length, onClick: download }]} />
    </DialogActions>
  ) : mode === 'single' ? (
    <DialogActions
      onSave={() => void createSingle()}
      disabled={busy || !draft.fullName.trim() || (!draft.email.trim() && !draft.username.trim())}
      saveLabel={busy ? tx('Δημιουργία…', 'Creating…') : tx('Δημιουργία ενεργού χρήστη', 'Create active user')}
    />
  ) : (
    <DialogActions
      onSave={() => void run(ready)}
      disabled={busy || !ready.length}
      saveLabel={progress ? tx(`Δημιουργία ${progress.done}/${progress.total}…`, `Creating ${progress.done}/${progress.total}…`) : (ready.length === 1 ? tx('Δημιουργία 1 χρήστη', 'Create 1 user') : tx(`Δημιουργία ${ready.length} χρηστών`, `Create ${ready.length} users`))}
    />
  )

  return (
    <ObserverDialog
      eyebrow={tx('ΧΡΗΣΤΕΣ & ΡΟΛΟΙ', 'USERS & ROLES')}
      title={mode === 'single' ? tx('Νέος ενεργός χρήστης', 'New active user') : tx('Εισαγωγή χρηστών από αρχείο', 'Import users from a file')}
      subtitle={tx(
        `${organization.name}: ο λογαριασμός ενεργοποιείται αμέσως με προσωρινό κωδικό, που αλλάζει υποχρεωτικά στην πρώτη σύνδεση.`,
        `${organization.name}: the account is active at once with a temporary password, which must be changed at the first sign-in.`,
      )}
      onClose={busy ? undefined : () => void close()}
      width={mode === 'single' && !results ? 'compact' : 'wide'}
      footer={footer}
    >
      <div className="active-users">
        {results ? (
          <>
            <p className={`active-users-banner ${created.length === results.length ? 'ok' : 'partial'}`} role="status">
              {created.length === results.length ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              {tx(
                `Δημιουργήθηκαν ${created.length} ενεργοί λογαριασμοί${results.length > created.length ? `, απέτυχαν ${results.length - created.length}` : ''}.`,
                `${created.length} active accounts created${results.length > created.length ? `, ${results.length - created.length} failed` : ''}.`,
              )}
            </p>
            {created.length > 0 && (
              <p className="active-users-warning" role="alert">
                <KeyRound size={16} />
                {tx(
                  'Οι προσωρινοί κωδικοί εμφανίζονται μόνο τώρα και δεν αποθηκεύονται πουθενά. Κατεβάστε το Excel (Εξαγωγή ▾) και δώστε τον κωδικό σε κάθε χρήστη προσωπικά· στην πρώτη σύνδεση θα ορίσει δικό του.',
                  'The temporary passwords are shown only now and are not stored anywhere. Download the Excel (Export ▾) and give each user their password in person; at the first sign-in they set their own.',
                )}
              </p>
            )}
            <div className="scroll-table active-users-table">
              <table className="data-table sticky-table">
                <thead>
                  <tr>
                    <th>{tx('Χρήστης', 'User')}</th>
                    <th>{tx('Όνομα χρήστη', 'Username')}</th>
                    <th>{tx('Προσωρινός κωδικός', 'Temporary password')}</th>
                    <th>{tx('Αποτέλεσμα', 'Result')}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(row => (
                    <tr key={row.line} className={row.status === 'created' ? '' : 'active-users-row-error'}>
                      <td>
                        <strong>{row.fullName}</strong>
                        <small>{[roleLabel(row.role, language), row.departmentName].filter(Boolean).join(' · ')}</small>
                      </td>
                      <td className="active-users-code">{row.username || '—'}</td>
                      <td className="active-users-code">{row.temporaryPassword || '—'}</td>
                      <td>
                        {row.status === 'created' ? (
                          <span className="status-badge active">{row.welcomeEmail ? tx('Ενεργός · στάλθηκε email', 'Active · e-mail sent') : tx('Ενεργός · χωρίς email', 'Active · no e-mail')}</span>
                        ) : (
                          <span className="status-badge danger">{errorText(row.code, en)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : mode === 'single' ? (
          <div className="platform-form-grid">
            <label className="field field-wide">
              <span>{tx('Ονοματεπώνυμο', 'Full name')} *</span>
              <input autoFocus value={draft.fullName} onChange={e => setDraft(x => ({ ...x, fullName: e.target.value }))} />
            </label>
            <label className="field">
              <span>Email</span>
              <input type="email" value={draft.email} onChange={e => setDraft(x => ({ ...x, email: e.target.value }))} />
            </label>
            <label className="field">
              <span>{tx('Όνομα χρήστη', 'Username')}</span>
              <input value={draft.username} placeholder={tx('Αυτόματα, αν μείνει κενό', 'Automatic when left empty')} onChange={e => setDraft(x => ({ ...x, username: e.target.value }))} />
            </label>
            <label className="field field-wide">
              <span>{tx('Ρόλος', 'Role')} *</span>
              <select value={draft.role} onChange={e => setDraft(x => ({ ...x, role: e.target.value }))}>
                {ROLES.map(role => (
                  <option key={role} value={role}>
                    {roleLabel(role, language)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>
                {tx('Τμήμα', 'Department')}
                {needsDepartment(draft.role) ? ' *' : ''}
              </span>
              <select value={draft.departmentId} onChange={e => setDraft(x => ({ ...x, departmentId: e.target.value }))}>
                <option value="">—</option>
                {departments.map(department => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{tx('Κωδικός εργαζομένου', 'Employee code')}</span>
              <input value={draft.employeeCode} onChange={e => setDraft(x => ({ ...x, employeeCode: e.target.value }))} />
            </label>
            <p className="active-users-note field-wide">
              {tx(
                'Χωρίς email ο χρήστης συνδέεται με το όνομα χρήστη και δεν λαμβάνει email. Με email λαμβάνει μήνυμα καλωσορίσματος χωρίς τον κωδικό.',
                'Without e-mail the user signs in with the username and receives no e-mail. With e-mail they get a welcome message without the password.',
              )}
            </p>
            {singleError && (
              <p className="active-users-error field-wide" role="alert">
                <AlertTriangle size={15} />
                {singleError}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="active-users-file">
              <label className="active-users-pick">
                <Upload size={16} />
                <span>{fileName || tx('Επιλογή αρχείου (.xlsx ή .csv)', 'Choose file (.xlsx or .csv)')}</span>
                <input type="file" accept=".xlsx,.csv" onChange={event => void pick(event)} disabled={busy} />
              </label>
              <Button variant="secondary" onClick={() => downloadXlsx(tx('protypo-energon-xriston.xlsx', 'active-users-template.xlsx'), [templateSheet(en)])}>
                <FileSpreadsheet size={15} />
                {tx('Πρότυπο Excel', 'Excel template')}
              </Button>
            </div>
            {readError && (
              <p className="active-users-error" role="alert">
                <AlertTriangle size={15} />
                {readError}
              </p>
            )}
            {!plan && !readError && (
              <p className="active-users-note">
                {tx(
                  'Στήλες: Ονοματεπώνυμο, Email ή Όνομα χρήστη, Ρόλος (όνομα ή κωδικός), Τμήμα (υποχρεωτικό για ρόλους τμήματος), Κωδικός εργαζομένου (προαιρετικά, συνδέει τον εργαζόμενο). Κατεβάστε το πρότυπο για να ξεκινήσετε.',
                  'Columns: Full name, Email or Username, Role (name or code), Department (required for department roles), Employee code (optional, links the employee). Download the template to start.',
                )}
              </p>
            )}
            {plan?.missingColumns.length > 0 && (
              <p className="active-users-error" role="alert">
                <AlertTriangle size={15} />
                {tx(`Λείπουν στήλες: ${plan.missingColumns.join(', ')}`, `Missing columns: ${plan.missingColumns.join(', ')}`)}
              </p>
            )}
            {plan?.tooMany && (
              <p className="active-users-error" role="alert">
                <AlertTriangle size={15} />
                {tx('Το αρχείο έχει πάνω από 500 γραμμές· διαβάστηκαν οι πρώτες 500.', 'The file has more than 500 rows; the first 500 were read.')}
              </p>
            )}
            {checking && <p className="active-users-note">{tx('Έλεγχος γραμμών…', 'Checking rows…')}</p>}
            {people && (
              <>
                <div className="active-users-summary">
                  <span className="ok">
                    <strong>{counts.ok}</strong>
                    {tx('έτοιμοι', 'ready')}
                  </span>
                  <span className="error">
                    <strong>{counts.error}</strong>
                    {tx('με σφάλματα (δεν δημιουργούνται)', 'with errors (not created)')}
                  </span>
                </div>
                <div className="scroll-table active-users-table">
                  <table className="data-table sticky-table">
                    <thead>
                      <tr>
                        <th>{tx('Γραμμή', 'Row')}</th>
                        <th>{tx('Χρήστης', 'User')}</th>
                        <th>{tx('Email / όνομα χρήστη', 'Email / username')}</th>
                        <th>{tx('Ρόλος · Τμήμα', 'Role · Department')}</th>
                        <th>{tx('Έλεγχος', 'Check')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {people.map(person => (
                        <tr key={person.line} className={person.status === 'ok' ? '' : 'active-users-row-error'}>
                          <td>{person.line}</td>
                          <td>{person.fullName || '—'}</td>
                          <td>{[person.email, person.username].filter(Boolean).join(' · ') || '—'}</td>
                          <td>{[person.role ? roleLabel(person.role, language) : person.roleText, person.departmentName].filter(Boolean).join(' · ') || '—'}</td>
                          <td>{person.status === 'ok' ? <span className="status-badge active">{tx('Έτοιμος', 'Ready')}</span> : <span className="status-badge danger">{errorText(person.code, en)}</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </ObserverDialog>
  )
}
