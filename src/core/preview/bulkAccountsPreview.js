// Platform Owner preview (?helpPreview=1&helpOwner=1) of «Εργαζόμενοι χωρίς
// λογαριασμό»: sample employees of the first sample hospital, and a simulated run
// (nothing leaves the browser), so the screens can be documented and checked.
const ORG = '11111111-0000-4000-8000-000000000001'
const at = (offsetDays, hour = 10) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  d.setHours(hour, 30, 0, 0)
  return d.toISOString()
}
const DEPARTMENTS = ['ΜΕΘ', 'ΤΕΠ', 'Β΄ Χειρουργική', 'Καρδιολογική', 'Α΄ Παθολογική', 'Μαιευτική', 'Μικροβιολογικό Εργαστήριο', 'Φαρμακείο', 'Γραφείο Λοιμώξεων', 'Ορθοπαιδική', 'Υγιεινή & Ασφάλεια', 'Νεφρολογική', 'Γραφείο Προσωπικού', 'Αναισθησιολογικό', 'Ουρολογική'].map((name, index) => ({ id: `dep-${String(index + 1).padStart(2, '0')}`, name }))
const dep = name => DEPARTMENTS.find(d => d.name === name)?.id || null

// name, profession, department, e-mail
const PEOPLE = [
  ['Ιωάννα Παππά', 'Νοσηλεύτρια ΤΕ', 'ΜΕΘ', 'i.pappa@papanikolaou.example.org'],
  ['Μιχάλης Τσιρίγος', 'Νοσηλευτής ΤΕ', 'ΤΕΠ', 'm.tsirigos@papanikolaou.example.org'],
  ['Βασίλειος Ζερβός', 'Τραυματιοφορέας', 'ΤΕΠ', ''],
  ['Κωνσταντίνα Ρίζου', 'Προϊσταμένη Νοσηλευτικού Τμήματος', 'Β΄ Χειρουργική', 'k.rizou@papanikolaou.example.org'],
  ['Σοφία Δημάκη', 'Νοσηλεύτρια ΔΕ', 'Καρδιολογική', 's.dimaki@papanikolaou.example.org'],
  ['Θεόδωρος Μαυρίδης', 'Επιμελητής Β΄ Παθολογίας', 'Α΄ Παθολογική', 'th.mavridis@papanikolaou.example.org'],
  ['Δέσποινα Αργυρίου', 'Μαία', 'Μαιευτική', 'd.argyriou@papanikolaou.example.org'],
  ['Αθανάσιος Γκίκας', 'Ιατρός Βιοπαθολόγος', 'Μικροβιολογικό Εργαστήριο', 'a.gkikas@papanikolaou.example.org'],
  ['Ευδοκία Σταμάτη', 'Φαρμακοποιός', 'Φαρμακείο', 'e.stamati@papanikolaou.example.org'],
  ['Παρασκευή Λιάπη', 'Νοσηλεύτρια Επιτήρησης Λοιμώξεων', 'Γραφείο Λοιμώξεων', 'p.liapi@papanikolaou.example.org'],
  ['Ολυμπία Κανελλοπούλου', 'Νοσηλεύτρια ΔΕ', 'Ορθοπαιδική', ''],
  ['Γεράσιμος Κουτσός', 'Ιατρός Εργασίας', 'Υγιεινή & Ασφάλεια', 'g.koutsos@papanikolaou.example.org'],
  ['Νεκταρία Φωτίου', 'Νοσηλεύτρια ΤΕ', 'Νεφρολογική', 'n.fotiou@papanikolaou.example.org'],
  ['Ηλίας Μπαλτάς', 'Διοικητικός υπάλληλος', 'Γραφείο Προσωπικού', 'i.baltas@papanikolaou.example.org'],
  ['Στέφανος Αλεξανδρόπουλος', 'Επιμελητής Α΄ Αναισθησιολογίας', 'Αναισθησιολογικό', 's.alexandropoulos@papanikolaou.example.org'],
]

const base = (index, [name, profession, department, email]) => ({
  employee_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  full_name: name,
  profession_name: profession,
  department_id: dep(department),
  department_name: department,
  email: email || null,
  user_id: null,
  username: null,
  member_role: null,
  account_state: 'none',
  blocked_reason: email ? null : 'missing_email',
  existing_user_id: null,
  send_count: 0,
})

let rows = null
function initial() {
  const list = PEOPLE.map((person, index) => base(index, person))
  const stamati = list.find(row => row.full_name === 'Ευδοκία Σταμάτη')
  Object.assign(stamati, { existing_user_id: 'u-2-9', existing_name: 'Ευδοκία Σταμάτη', existing_is_demo: false, existing_organizations: ['Γ.Ν. Κομοτηνής «Σισμανόγλειο»'] })
  // One person invited earlier (single «Νέος χρήστης»), whose link expired.
  list.push({ ...base(PEOPLE.length, ['Στέλλα Καραμανλή', 'Νοσηλεύτρια ΤΕ', 'Ουρολογική', 's.karamanli@papanikolaou.example.org']), user_id: 'u-1-90', username: 'SK29007', member_role: 'department_user', account_state: 'invited', blocked_reason: null, invitation_created_at: at(-18), invitation_expires_at: at(-11), item_status: null })
  return list
}
const state = () => (rows ||= initial())

export function previewEmployeeAccounts(organizationId) {
  if (organizationId !== ORG) return { employees: [], departments: [] }
  return { employees: state().map(row => ({ ...row })), departments: DEPARTMENTS }
}

const usernameOf = name => {
  const parts = name.split(/\s+/)
  const latin = { Α: 'A', Β: 'V', Γ: 'G', Δ: 'D', Ε: 'E', Ζ: 'Z', Η: 'I', Θ: 'T', Ι: 'I', Κ: 'K', Λ: 'L', Μ: 'M', Ν: 'N', Ξ: 'X', Ο: 'O', Π: 'P', Ρ: 'R', Σ: 'S', Τ: 'T', Υ: 'Y', Φ: 'F', Χ: 'C', Ψ: 'P', Ω: 'O' }
  const initial = word => latin[word?.[0]?.normalize('NFD')[0]] || 'X'
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 90000
  return `${initial(parts[0])}${initial(parts[parts.length - 1])}${10000 + hash}`
}

// A simulated run: everyone becomes «Δημιουργήθηκε · στάλθηκε», the confirmed
// existing account «Συνδέθηκε», one address is rejected by the mail server, and a
// few have already activated, so that every state of the result view shows.
export function previewCreateAccounts(items, confirmExisting = []) {
  const batchId = 'preview-batch-1'
  const results = []
  for (const [index, item] of items.entries()) {
    const row = state().find(r => r.employee_id === item.employeeId)
    if (!row) continue
    Object.assign(row, { item_batch_id: batchId, item_created_at: at(0), item_role: item.role, member_role: item.role, send_count: 1, last_sent_at: at(0) })
    if (row.existing_user_id) {
      if (!confirmExisting.includes(row.employee_id)) {
        Object.assign(row, { item_status: 'failed', item_error: 'EXISTING_ACCOUNT_NEEDS_CONFIRMATION' })
        continue
      }
      Object.assign(row, { item_status: 'linked_existing', user_id: row.existing_user_id, username: 'ES18452', account_state: 'active' })
    } else if (row.full_name === 'Μιχάλης Τσιρίγος') {
      Object.assign(row, { item_status: 'created', user_id: `u-new-${index}`, username: usernameOf(row.full_name), account_state: 'invited', invitation_created_at: at(0), invitation_expires_at: at(7, 23), email_status: 'failed', email_error: '550 5.1.1 The email account that you tried to reach does not exist' })
    } else {
      const activated = ['Ιωάννα Παππά', 'Κωνσταντίνα Ρίζου', 'Παρασκευή Λιάπη', 'Νεκταρία Φωτίου'].includes(row.full_name)
      Object.assign(row, { item_status: 'created', user_id: `u-new-${index}`, username: usernameOf(row.full_name), account_state: activated ? 'active' : 'invited', invitation_created_at: at(0), invitation_expires_at: at(7, 23), invitation_accepted_at: activated ? at(0, 18) : null, invitation_opened: row.full_name === 'Αθανάσιος Γκίκας' || activated, email_status: 'sent' })
    }
    results.push({ employeeId: item.employeeId, status: row.item_status, username: row.username })
  }
  return { batchId, results }
}

export function previewResend(employeeIds) {
  for (const id of employeeIds) {
    const row = state().find(r => r.employee_id === id)
    if (row) Object.assign(row, { invitation_created_at: at(0), invitation_expires_at: at(7, 23), invitation_revoked_at: null, email_status: 'pending', send_count: (row.send_count || 0) + 1 })
  }
  return { results: employeeIds.map(employeeId => ({ employeeId, status: 'sent' })) }
}

// The confirmation's e-mail for the first recipient (subject, sender, reply-to).
export function previewEmail(name, organization) {
  return {
    to: '',
    name,
    subject: `${organization.name} · Δημιουργήθηκε λογαριασμός για εσάς στο Limoxis Observer`,
    replyTo: organization.contact_email || null,
    html: `<!doctype html><html lang="el"><body style="font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#182433"><h1 style="font-size:20px;color:#172b43">Δημιουργήθηκε λογαριασμός για εσάς</h1><p><strong>Καλώς ήρθατε, ${name}.</strong></p><p>Δημιουργήθηκε για εσάς λογαριασμός στο Limoxis Observer στο ${organization.name}.</p><p><span style="display:inline-block;padding:12px 22px;border-radius:10px;background:#256b9b;color:#fff;font-weight:700">Ορισμός κωδικού →</span></p></body></html>`,
  }
}
