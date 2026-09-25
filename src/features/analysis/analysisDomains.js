// Section indicators for the Analysis page. Production reads them from the
// analysis_domain_metrics RPC; demo computes the very same shape from the demo
// fixtures, so every section shows rates and breakdowns instead of raw counts.
import { clinicalCases } from '../surveillance/clinicalDemoData'
import { loadHandHygieneLocal, loadWasteLocal, loadBundlesLocal } from '../prevention/preventionStore'
import { loadQualityLocal } from '../quality/qualityStore'
import { loadControlExecutionsLocal, loadControlAssignmentsLocal } from '../controls/controlStore'
import { loadTrainingState } from '../training/trainingData'
import { loadDocuments } from '../documents/documentStore'
import { loadCommittees } from '../committees/committeeData'
import { employeeRows, employeeVaccinations } from '../employees/employeeDemoData'
import { loadOccupationalVisits } from '../employees/employeeRecordsService'

const day = value => String(value || '').slice(0, 10)
const month = value => String(value || '').slice(0, 7)
const inRange = (value, range) => { const d = day(value); if (!d) return true; return (!range?.from || d >= range.from) && (!range?.to || d <= range.to) }
function tally(rows, keyFn) { const out = new Map(); for (const row of rows) { const key = keyFn(row); if (key == null || key === '') continue; out.set(key, (out.get(key) || 0) + 1) } return [...out.entries()].sort((a, b) => b[1] - a[1]) }
function sums(rows, keyFn, valueFns) { const out = new Map(); for (const row of rows) { const key = keyFn(row); if (!key) continue; const current = out.get(key) || valueFns.map(() => 0); valueFns.forEach((fn, index) => { current[index] += Number(fn(row)) || 0 }); out.set(key, current) } return [...out.entries()].map(([key, values]) => [key, ...values]) }
const CLOSED_QUALITY = new Set(['closed', 'resolved', 'completed', 'verified'])

export function collectDemoDomainMetrics(range = {}, en = false) {
  const today = new Date().toISOString().slice(0, 10)
  const cases = Object.values(clinicalCases).filter(item => item.lifecycleStatus !== 'voided' && item.status !== 'cancelled' && inRange(item.startedAt, range))
  const dept = item => (en ? item.departmentEn : item.department) || item.department || '—'
  const hai = cases.filter(item => item.haiClassification)
  const devices = cases.flatMap(item => (item.devices || []).filter(device => !device.removedAt && (device.status || 'active') === 'active'))
  const therapies = cases.flatMap(item => item.therapy || [])
  const hh = loadHandHygieneLocal().filter(row => row.lifecycleStatus !== 'voided' && inRange(row.date, range))
  const hhItems = hh.flatMap(row => row.whoObservations || [])
  const weight = item => Math.max(1, Number(item.professionalsCount) || 1)
  const bundles = loadBundlesLocal().filter(row => row.lifecycleStatus !== 'voided' && inRange(row.date, range))
  const scored = bundles.filter(row => row.score != null)
  const waste = loadWasteLocal().filter(row => row.lifecycleStatus !== 'voided' && inRange(row.periodEnd || row.date, range))
  const executions = loadControlExecutionsLocal().filter(row => !row.cancelled_at && inRange(row.performed_at, range))
  const assignments = loadControlAssignmentsLocal()
  const incidents = loadQualityLocal('incidents').filter(row => row.lifecycleStatus !== 'voided' && inRange(row.date, range))
  const capas = loadQualityLocal('capas').filter(row => row.lifecycleStatus !== 'voided')
  const avg = rows => rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(row.score || 0), 0) / rows.length * 10) / 10 : null
  const byBundle = [...new Set(bundles.map(row => row.bundle))].map(key => { const rows = bundles.filter(row => row.bundle === key); return [key, rows.length, avg(rows.filter(row => row.score != null))] })
  const byBundleDepartment = [...new Set(bundles.map(row => (en ? row.departmentEn : row.departmentEl)))].map(key => { const rows = bundles.filter(row => (en ? row.departmentEn : row.departmentEl) === key); return [key, rows.length, avg(rows.filter(row => row.score != null))] })
  return {
    surveillance: {
      total: cases.length,
      active: cases.filter(item => item.status === 'active').length,
      closed: cases.filter(item => ['completed', 'closed'].includes(item.status)).length,
      haiConfirmed: hai.filter(item => item.haiClassification.status === 'confirmed').length,
      haiProbable: hai.filter(item => ['probable', 'suspected'].includes(item.haiClassification.status)).length,
      byHaiType: tally(hai, item => item.haiClassification.type || '—'),
      byCaseStatus: tally(hai, item => item.haiClassification.status || '—'),
      byDepartment: tally(cases, dept),
      monthly: tally(cases, item => month(item.startedAt)).sort((a, b) => a[0].localeCompare(b[0])),
      outcomes: tally(cases.filter(item => item.outcome), item => item.outcome.status || '—'),
      isolationActive: cases.filter(item => item.status === 'active' && item.isolation?.status === 'active').length,
      isolationReviewOverdue: cases.filter(item => item.status === 'active' && item.isolation?.status === 'active' && item.reviewDue && day(item.reviewDue) < today).length,
      devicesActive: devices.length,
      byDevice: tally(devices, device => (en ? device.nameEn : device.name) || device.name || device.type || '—'),
    },
    handHygiene: {
      sessions: hh.length,
      observations: hh.reduce((sum, row) => sum + (Number(row.observations) || 0), 0),
      compliant: hh.reduce((sum, row) => sum + (Number(row.compliant) || 0), 0),
      byDepartment: sums(hh, row => (en ? row.departmentEn : row.departmentEl), [row => row.observations, row => row.compliant]),
      byCategory: sums(hhItems, item => item.professionalCategory || '—', [weight, item => (['HR', 'HW'].includes(item.action) ? weight(item) : 0)]),
      monthly: sums(hh, row => month(row.date), [row => row.observations, row => row.compliant]).sort((a, b) => a[0].localeCompare(b[0])),
    },
    bundles: { assessments: bundles.length, averageScore: avg(scored), byBundle, byDepartment: byBundleDepartment },
    waste: {
      records: waste.length,
      totalKg: Math.round(waste.reduce((sum, row) => sum + (Number(row.weight) || 0), 0) * 10) / 10,
      patientDays: waste.reduce((sum, row) => sum + (Number(row.patientDays) || 0), 0),
      byDepartment: sums(waste, row => (en ? row.departmentEn : row.departmentEl), [row => row.weight]).map(([key, kg]) => [key, Math.round(kg * 10) / 10]),
    },
    controls: {
      executions: executions.length,
      completed: executions.filter(row => row.status === 'completed').length,
      withFinding: executions.filter(row => row.has_finding).length,
      overdueAssignments: assignments.filter(row => (row.status || 'active') === 'active' && row.next_due_at && row.next_due_at < new Date().toISOString()).length,
      byDepartment: sums(executions, row => row.department_id || '—', [() => 1, row => (row.has_finding ? 1 : 0)]),
    },
    quality: {
      incidents: incidents.length,
      openIncidents: incidents.filter(row => !CLOSED_QUALITY.has(row.status)).length,
      harm: incidents.filter(row => row.harmOccurred || row.harm_occurred).length,
      bySeverity: tally(incidents, row => row.severity || '—'),
      byStatus: tally(incidents, row => row.status || '—'),
      capaOpen: capas.filter(row => !CLOSED_QUALITY.has(row.status)).length,
      capaOverdue: capas.filter(row => !CLOSED_QUALITY.has(row.status) && row.dueDate && row.dueDate < today).length,
    },
    workforce: (() => {
      const active = employeeRows.filter(row => (row.employmentStatus || 'active') === 'active')
      const ids = new Set(active.map(row => row.id))
      const valid = employeeVaccinations.filter(row => ids.has(row.employeeId) && (!row.validUntil || row.validUntil >= today))
      const visits = loadOccupationalVisits().filter(row => ids.has(row.employeeId) && inRange(row.date, range))
      const byVaccine = new Map(); for (const row of valid) { const set = byVaccine.get(row.vaccine) || new Set(); set.add(row.employeeId); byVaccine.set(row.vaccine, set) }
      return {
        activeEmployees: active.length,
        vaccinatedEmployees: new Set(valid.map(row => row.employeeId)).size,
        byVaccine: [...byVaccine.entries()].map(([key, set]) => [key, set.size]).sort((a, b) => b[1] - a[1]),
        visits: visits.length,
        byVisitType: tally(visits, row => row.type || '—'),
        followUpsDue: loadOccupationalVisits().filter(row => ids.has(row.employeeId) && row.followUpDate && row.followUpDate < today && row.status !== 'cancelled').length,
        byDepartment: tally(active, row => (en ? row.departmentEn : row.department) || '—'),
      }
    })(),
    training: (() => {
      const rows = (loadTrainingState().assignments || []).filter(row => inRange(row.assignedDate, range))
      const status = row => row.computedStatus || row.status
      const scored = rows.filter(row => row.score != null && row.score !== '')
      return {
        assignments: rows.length,
        completed: rows.filter(row => status(row) === 'completed').length,
        overdue: rows.filter(row => !['completed', 'cancelled'].includes(status(row)) && row.dueDate && row.dueDate < today).length,
        averageScore: scored.length ? Math.round(scored.reduce((sum, row) => sum + Number(row.score), 0) / scored.length * 10) / 10 : null,
        byDepartment: sums(rows, row => row.department || '—', [() => 1, row => (status(row) === 'completed' ? 1 : 0)]),
      }
    })(),
    governance: (() => {
      const docs = loadDocuments().filter(row => !['archived', 'superseded'].includes(row.status))
      const committees = loadCommittees()
      const meetings = committees.flatMap(row => row.meetings || []).filter(row => inRange(row.date, range) && row.status !== 'cancelled')
      return {
        documents: docs.length,
        published: docs.filter(row => ['published', 'approved'].includes(row.status)).length,
        reviewOverdue: docs.filter(row => ['published', 'approved'].includes(row.status) && row.reviewDate && row.reviewDate < today).length,
        byType: tally(docs, row => row.type || '—'),
        byStatus: tally(docs, row => row.status || '—'),
        committees: committees.filter(row => (row.status || 'active') === 'active').length,
        meetings: meetings.length,
        minutesFinalized: meetings.filter(row => row.status === 'finalized').length,
        minutesPending: meetings.filter(row => row.status !== 'finalized' && row.date && row.date < today).length,
      }
    })(),
    antimicrobial: {
      total: therapies.length,
      active: therapies.filter(row => (row.status || 'active') === 'active' && !row.endedAt).length,
      pending: therapies.filter(row => row.approvalStatus === 'pending' || row.approved === false).length,
      byAgent: tally(therapies, row => row.antimicrobial || '—').slice(0, 10),
      byApproval: tally(therapies, row => row.approvalStatus || (row.approved === true ? 'approved' : row.approved === false ? 'pending' : 'not_required')),
    },
  }
}

export { mergeDomainMetrics } from './analysisDomainMerge'

const LABELS = {
  confirmed: ['Επιβεβαιωμένη', 'Confirmed'], probable: ['Πιθανή', 'Probable'], suspected: ['Υπό διερεύνηση', 'Suspected'], notHai: ['Όχι HAI', 'Not HAI'], excluded: ['Αποκλείστηκε', 'Excluded'],
  high: ['Υψηλή', 'High'], medium: ['Μέτρια', 'Medium'], low: ['Χαμηλή', 'Low'], critical: ['Κρίσιμη', 'Critical'],
  reported: ['Αναφέρθηκε', 'Reported'], underReview: ['Υπό διερεύνηση', 'Under review'], inProgress: ['Σε εξέλιξη', 'In progress'], open: ['Ανοιχτό', 'Open'], closed: ['Κλειστό', 'Closed'], resolved: ['Επιλύθηκε', 'Resolved'],
  pending: ['Σε αναμονή', 'Pending'], approved: ['Εγκρίθηκε', 'Approved'], rejected: ['Απορρίφθηκε', 'Rejected'], not_required: ['Δεν απαιτείται έγκριση', 'No approval needed'],
  transferred: ['Μεταφορά', 'Transferred'], deceased: ['Θάνατος', 'Deceased'], discharged: ['Έξοδος', 'Discharged'], recovered: ['Ίαση', 'Recovered'],
  bloodstreamInfection: ['Λοίμωξη αιματικής ροής', 'Bloodstream infection'], urinaryTractInfection: ['Λοίμωξη ουροποιητικού', 'Urinary tract infection'], pneumonia: ['Πνευμονία', 'Pneumonia'], surgicalSiteInfection: ['Λοίμωξη χειρουργικού πεδίου', 'Surgical site infection'],
  periodic: ['Περιοδική', 'Periodic'], followUp: ['Επανέλεγχος', 'Follow-up'], preEmployment: ['Προπρόσληψης', 'Pre-employment'], exposure: ['Μετά από έκθεση', 'Post-exposure'],
  policy: ['Πολιτική', 'Policy'], instruction: ['Οδηγία', 'Instruction'], procedure: ['Διαδικασία', 'Procedure'], protocol: ['Πρωτόκολλο', 'Protocol'], form: ['Έντυπο', 'Form'],
  published: ['Δημοσιευμένο', 'Published'], draft: ['Προσχέδιο', 'Draft'], review: ['Υπό αναθεώρηση', 'In review'],
  CLABSI: ['Δέσμη CLABSI', 'CLABSI bundle'], VAE: ['Δέσμη VAE', 'VAE bundle'], CAUTI: ['Δέσμη CAUTI', 'CAUTI bundle'], SSI: ['Δέσμη SSI', 'SSI bundle'],
}
const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : null)
const fmtPct = value => (value == null ? '—' : `${String(value).replace('.', ',')}%`)

// What each Analysis section shows: KPI tiles and charts built from the metrics.
export function buildSectionModel(tab, snapshot, tx, t) {
  const en = tx('el', 'en') === 'en'
  const label = key => { const pair = LABELS[key]; if (pair) return en ? pair[1] : pair[0]; const translated = typeof t === 'function' ? t(key) : key; return translated || key }
  const named = rows => (rows || []).map(([key, ...values]) => [label(key), ...values])
  const d = snapshot?.domains || {}, s = d.surveillance || {}, hh = d.handHygiene || {}, b = d.bundles || {}, w = d.waste || {}, c = d.controls || {}, q = d.quality || {}, a = d.antimicrobial || {}
  const micro = snapshot?.microbiology || {}
  const hhRate = pct(hh.compliant, hh.observations)
  const rateRows = rows => (rows || []).map(([key, total, part]) => [label(key), pct(part, total) ?? 0]).filter(([, value]) => value != null)
  const mdro = (micro.resistance || []).filter(([key]) => ['MDR', 'XDR', 'PDR'].includes(key)).reduce((sum, [, value]) => sum + (Number(value) || 0), 0)
  if (!snapshot?.domains) return null
  switch (tab) {
    case 'overview': return {
      kpis: [
        [tx('Ενεργές επιτηρήσεις', 'Active surveillance'), s.active ?? 0, tx(`${s.total ?? 0} στην περίοδο`, `${s.total ?? 0} in period`)],
        [tx('Επιβεβαιωμένες HAI', 'Confirmed HAI'), s.haiConfirmed ?? 0, tx(`${s.haiProbable ?? 0} πιθανές / υπό διερεύνηση`, `${s.haiProbable ?? 0} probable / suspected`), (s.haiConfirmed ? 'warning' : '')],
        [tx('Θετικές καλλιέργειες', 'Positive cultures'), micro.totalPositive ?? 0, tx(`${mdro} MDR/XDR/PDR`, `${mdro} MDR/XDR/PDR`), (mdro ? 'danger' : '')],
        [tx('Συμμόρφωση υγιεινής χεριών', 'Hand hygiene compliance'), fmtPct(hhRate), tx(`${hh.observations ?? 0} ευκαιρίες`, `${hh.observations ?? 0} opportunities`), hhRate != null && hhRate < 80 ? 'warning' : 'good'],
        [tx('Συμμόρφωση δεσμών μέτρων', 'Bundle compliance'), fmtPct(b.averageScore), tx(`${b.assessments ?? 0} αξιολογήσεις`, `${b.assessments ?? 0} assessments`), b.averageScore != null && b.averageScore < 90 ? 'warning' : 'good'],
        [tx('Εκπρόθεσμα CAPA', 'Overdue CAPA'), q.capaOverdue ?? 0, tx(`${q.capaOpen ?? 0} ανοιχτά`, `${q.capaOpen ?? 0} open`), q.capaOverdue ? 'danger' : ''],
      ],
      charts: [
        { type: 'trend', wide: true, title: tx('Θετικές καλλιέργειες ανά μήνα', 'Positive cultures by month'), subtitle: tx('Επικυρωμένα θετικά αποτελέσματα · περάστε το ποντίκι για τιμές.', 'Validated positive results · hover for values.'), points: micro.monthly || [] },
        { type: 'bars', title: tx('Επιτηρήσεις ανά τμήμα', 'Surveillance by department'), subtitle: tx('Επεισόδια της περιόδου (χωρίς ακυρωμένα).', 'Episodes in the period (cancelled excluded).'), rows: s.byDepartment },
        { type: 'donut', title: tx('Ταξινόμηση HAI', 'HAI classification'), subtitle: tx('Τελευταία ταξινόμηση κάθε επεισοδίου.', 'Latest classification per episode.'), rows: named(s.byCaseStatus), center: tx('επεισόδια', 'episodes') },
      ],
    }
    case 'surveillance': return {
      kpis: [
        [tx('Επεισόδια περιόδου', 'Episodes in period'), s.total ?? 0, tx(`${s.active ?? 0} ενεργά · ${s.closed ?? 0} ολοκληρωμένα`, `${s.active ?? 0} active · ${s.closed ?? 0} completed`)],
        [tx('Επιβεβαιωμένες HAI', 'Confirmed HAI'), s.haiConfirmed ?? 0, tx(`${s.haiProbable ?? 0} πιθανές / υπό διερεύνηση`, `${s.haiProbable ?? 0} probable / suspected`), s.haiConfirmed ? 'warning' : ''],
        [tx('Ενεργές απομονώσεις', 'Active isolations'), s.isolationActive ?? 0, s.isolationReviewOverdue ? tx(`${s.isolationReviewOverdue} με εκπρόθεσμη επανεκτίμηση`, `${s.isolationReviewOverdue} with overdue review`) : tx('Χωρίς εκπρόθεσμες επανεκτιμήσεις', 'No overdue reviews'), s.isolationReviewOverdue ? 'danger' : ''],
        [tx('Ενεργές επεμβατικές συσκευές', 'Active invasive devices'), s.devicesActive ?? 0, tx('σε ενεργές επιτηρήσεις', 'in surveillance episodes')],
      ],
      charts: [
        { type: 'trend', wide: true, title: tx('Νέα επεισόδια ανά μήνα', 'New episodes by month'), subtitle: tx('Έναρξη επιτήρησης ανά μήνα.', 'Surveillance starts per month.'), points: s.monthly || [] },
        { type: 'bars', title: tx('Τύπος λοίμωξης (HAI)', 'Infection type (HAI)'), subtitle: tx('Από την ταξινόμηση HAI κάθε επεισοδίου.', 'From each episode’s HAI classification.'), rows: named(s.byHaiType) },
        { type: 'donut', title: tx('Κατάσταση ταξινόμησης', 'Classification status'), subtitle: tx('Επιβεβαιωμένες, πιθανές, υπό διερεύνηση.', 'Confirmed, probable, suspected.'), rows: named(s.byCaseStatus), center: tx('επεισόδια', 'episodes') },
        { type: 'bars', title: tx('Ανά τμήμα', 'By department'), subtitle: tx('Επεισόδια επιτήρησης της περιόδου.', 'Surveillance episodes in the period.'), rows: s.byDepartment },
        { type: 'bars', title: tx('Επεμβατικές συσκευές', 'Invasive devices'), subtitle: tx('Ενεργές συσκευές ανά τύπο.', 'Active devices by type.'), rows: s.byDevice },
        { type: 'donut', title: tx('Έκβαση', 'Outcome'), subtitle: tx('Επεισόδια με καταγεγραμμένη έκβαση.', 'Episodes with a recorded outcome.'), rows: named(s.outcomes), center: tx('εκβάσεις', 'outcomes') },
      ],
    }
    case 'laboratory': return {
      kpis: [
        [tx('Θετικές καλλιέργειες', 'Positive cultures'), micro.totalPositive ?? 0, tx('επικυρωμένα αποτελέσματα', 'validated results')],
        [tx('MDR / XDR / PDR', 'MDR / XDR / PDR'), mdro, tx(`${pct(mdro, micro.totalPositive) ?? 0}% των θετικών`, `${pct(mdro, micro.totalPositive) ?? 0}% of positives`), mdro ? 'danger' : ''],
        [tx('Κρίσιμα αποτελέσματα', 'Critical results'), micro.totalCritical ?? 0, tx('απαιτούν άμεση επικοινωνία', 'require immediate communication'), micro.totalCritical ? 'warning' : ''],
        [tx('Τμήματα με εύρημα', 'Departments with findings'), (micro.byDepartment || []).length, tx(`από ${micro.departmentCount ?? '—'} τμήματα`, `of ${micro.departmentCount ?? '—'} departments`)],
      ],
      charts: null,
    }
    case 'antimicrobials': return {
      kpis: [
        [tx('Αντιμικροβιακές αγωγές', 'Antimicrobial therapies'), a.total ?? 0, tx(`${a.active ?? 0} ενεργές`, `${a.active ?? 0} active`)],
        [tx('Σε αναμονή έγκρισης', 'Pending approval'), a.pending ?? 0, tx('αντιβιοτικά περιορισμένης χρήσης', 'restricted antibiotics'), a.pending ? 'warning' : ''],
        [tx('Διαφορετικές ουσίες', 'Distinct agents'), (a.byAgent || []).length, tx('στην περίοδο', 'in the period')],
      ],
      charts: [
        { type: 'bars', title: tx('Συχνότερες ουσίες', 'Most used agents'), subtitle: tx('Αγωγές ανά αντιμικροβιακό.', 'Therapies per antimicrobial.'), rows: a.byAgent },
        { type: 'donut', title: tx('Κατάσταση έγκρισης', 'Approval status'), subtitle: tx('Έγκριση ανά αγωγή.', 'Approval per therapy.'), rows: named(a.byApproval), center: tx('αγωγές', 'therapies') },
      ],
    }
    case 'prevention': return {
      kpis: [
        [tx('Συμμόρφωση δεσμών μέτρων', 'Bundle compliance'), fmtPct(b.averageScore), tx(`${b.assessments ?? 0} αξιολογήσεις`, `${b.assessments ?? 0} assessments`), b.averageScore != null && b.averageScore < 90 ? 'warning' : 'good'],
        [tx('Συμμόρφωση υγιεινής χεριών', 'Hand hygiene compliance'), fmtPct(hhRate), tx(`${hh.sessions ?? 0} συνεδρίες παρατήρησης`, `${hh.sessions ?? 0} observation sessions`), hhRate != null && hhRate < 80 ? 'warning' : 'good'],
        [tx('Ιατρικά απόβλητα', 'Healthcare waste'), `${String(w.totalKg ?? 0).replace('.', ',')} kg`, w.patientDays ? tx(`${(w.totalKg / w.patientDays * 1000).toFixed(1).replace('.', ',')} kg / 1.000 ημέρες νοσηλείας`, `${(w.totalKg / w.patientDays * 1000).toFixed(1)} kg / 1,000 patient-days`) : tx(`${w.records ?? 0} καταγραφές`, `${w.records ?? 0} records`)],
      ],
      charts: [
        { type: 'rate', title: tx('Συμμόρφωση ανά δέσμη', 'Compliance by bundle'), subtitle: tx('Μέσο ποσοστό κριτηρίων που τηρήθηκαν.', 'Average share of criteria met.'), rows: (b.byBundle || []).filter(([, , score]) => score != null).map(([key, , score]) => [label(key), score]) },
        { type: 'rate', title: tx('Συμμόρφωση δεσμών ανά τμήμα', 'Bundle compliance by department'), subtitle: tx('Μέσο ποσοστό ανά τμήμα.', 'Average per department.'), rows: (b.byDepartment || []).filter(([, , score]) => score != null).map(([key, , score]) => [key, score]) },
        { type: 'bars', title: tx('Απόβλητα ανά τμήμα (kg)', 'Waste by department (kg)'), subtitle: tx('Βάρος στην περίοδο.', 'Weight in the period.'), rows: w.byDepartment },
      ],
    }
    case 'hand': return {
      kpis: [
        [tx('Συμμόρφωση', 'Compliance'), fmtPct(hhRate), tx('στόχος ≥ 80% (ΠΟΥ)', 'target ≥ 80% (WHO)'), hhRate != null && hhRate < 80 ? 'warning' : 'good'],
        [tx('Ευκαιρίες', 'Opportunities'), hh.observations ?? 0, tx('παρατηρήσεις 5 στιγμών', '5 moments observations')],
        [tx('Συμμορφώσεις', 'Compliant actions'), hh.compliant ?? 0, tx('τρίψιμο ή πλύσιμο χεριών', 'hand rub or hand wash')],
        [tx('Συνεδρίες', 'Sessions'), hh.sessions ?? 0, tx('παρατήρησης στην περίοδο', 'observation sessions in the period')],
      ],
      charts: [
        { type: 'trend', wide: true, title: tx('Συμμόρφωση ανά μήνα (%)', 'Compliance by month (%)'), subtitle: tx('Ποσοστό ευκαιριών με σωστή υγιεινή χεριών.', 'Share of opportunities with correct hand hygiene.'), points: (hh.monthly || []).map(([key, total, part]) => [key, pct(part, total) ?? 0]) },
        { type: 'rate', title: tx('Ανά τμήμα', 'By department'), subtitle: tx('Ποσοστό συμμόρφωσης.', 'Compliance rate.'), rows: rateRows(hh.byDepartment) },
        { type: 'rate', title: tx('Ανά επαγγελματική κατηγορία', 'By professional category'), subtitle: tx('Ποσοστό συμμόρφωσης.', 'Compliance rate.'), rows: rateRows(hh.byCategory) },
      ],
    }
    case 'controls': return {
      kpis: [
        [tx('Εκτελέσεις ελέγχων', 'Control executions'), c.executions ?? 0, tx(`${pct(c.completed, c.executions) ?? 0}% ολοκληρωμένες`, `${pct(c.completed, c.executions) ?? 0}% completed`)],
        [tx('Με εύρημα', 'With findings'), c.withFinding ?? 0, tx(`${pct(c.withFinding, c.executions) ?? 0}% των εκτελέσεων`, `${pct(c.withFinding, c.executions) ?? 0}% of executions`), c.withFinding ? 'warning' : ''],
        [tx('Εκπρόθεσμοι έλεγχοι', 'Overdue controls'), c.overdueAssignments ?? 0, tx('αναθέσεις με παρελθούσα προθεσμία', 'assignments past due'), c.overdueAssignments ? 'danger' : ''],
      ],
      charts: [
        { type: 'bars', title: tx('Εκτελέσεις ανά τμήμα', 'Executions by department'), subtitle: tx('Ολοκληρωμένοι έλεγχοι στην περίοδο.', 'Controls performed in the period.'), rows: (c.byDepartment || []).map(([key, n]) => [key, n]) },
        { type: 'bars', title: tx('Ευρήματα ανά τμήμα', 'Findings by department'), subtitle: tx('Εκτελέσεις με εύρημα.', 'Executions with a finding.'), rows: (c.byDepartment || []).map(([key, , f]) => [key, f]).filter(([, f]) => f > 0) },
      ],
    }
    case 'quality': return {
      kpis: [
        [tx('Συμβάντα', 'Incidents'), q.incidents ?? 0, tx(`${q.openIncidents ?? 0} ανοιχτά`, `${q.openIncidents ?? 0} open`)],
        [tx('Με βλάβη', 'With harm'), q.harm ?? 0, tx('συμβάντα με βλάβη ασθενούς', 'incidents with patient harm'), q.harm ? 'danger' : ''],
        [tx('Ανοιχτά CAPA', 'Open CAPA'), q.capaOpen ?? 0, tx('διορθωτικές / προληπτικές ενέργειες', 'corrective / preventive actions')],
        [tx('Εκπρόθεσμα CAPA', 'Overdue CAPA'), q.capaOverdue ?? 0, tx('πέρασε η προθεσμία', 'past due date'), q.capaOverdue ? 'danger' : ''],
      ],
      charts: [
        { type: 'donut', title: tx('Σοβαρότητα συμβάντων', 'Incident severity'), subtitle: tx('Συμβάντα της περιόδου.', 'Incidents in the period.'), rows: named(q.bySeverity), center: tx('συμβάντα', 'incidents') },
        { type: 'bars', title: tx('Κατάσταση συμβάντων', 'Incident status'), subtitle: tx('Πού βρίσκεται η διερεύνηση.', 'Where investigation stands.'), rows: named(q.byStatus) },
      ],
    }
    case 'occupational': { const wf = d.workforce || {}; const coverage = pct(wf.vaccinatedEmployees, wf.activeEmployees); return {
      kpis: [
        [tx('Ενεργοί εργαζόμενοι', 'Active employees'), wf.activeEmployees ?? 0, tx(`${(wf.byDepartment || []).length} τμήματα`, `${(wf.byDepartment || []).length} departments`)],
        [tx('Εμβολιαστική κάλυψη', 'Vaccination coverage'), wf.vaccinatedEmployees == null ? '—' : fmtPct(coverage), wf.vaccinatedEmployees == null ? tx('Απαιτείται δικαίωμα Ιατρού Εργασίας', 'Occupational health permission required') : tx(`${wf.vaccinatedEmployees} εργαζόμενοι με ισχύον εμβόλιο`, `${wf.vaccinatedEmployees} employees with a valid vaccine`), coverage != null && coverage < 80 ? 'warning' : ''],
        [tx('Επισκέψεις Ιατρού Εργασίας', 'Occupational health visits'), wf.visits ?? '—', tx('στην περίοδο', 'in the period')],
        [tx('Εκπρόθεσμοι επανέλεγχοι', 'Overdue follow-ups'), wf.followUpsDue ?? '—', tx('επισκέψεις με παρελθούσα ημερομηνία', 'visits past their follow-up date'), wf.followUpsDue ? 'warning' : ''],
      ],
      charts: [
        { type: 'bars', title: tx('Κάλυψη ανά εμβόλιο', 'Coverage by vaccine'), subtitle: tx('Εργαζόμενοι με ισχύον εμβόλιο.', 'Employees with a valid vaccine.'), rows: wf.byVaccine || [] },
        { type: 'donut', title: tx('Τύπος επίσκεψης', 'Visit type'), subtitle: tx('Επισκέψεις της περιόδου.', 'Visits in the period.'), rows: named(wf.byVisitType || []), center: tx('επισκέψεις', 'visits') },
        { type: 'bars', title: tx('Εργαζόμενοι ανά τμήμα', 'Employees by department'), subtitle: tx('Ενεργό προσωπικό.', 'Active staff.'), rows: wf.byDepartment || [] },
      ],
    } }
    case 'training': { const tr = d.training || {}; const rate = pct(tr.completed, tr.assignments); return {
      kpis: [
        [tx('Ολοκλήρωση εκπαιδεύσεων', 'Training completion'), fmtPct(rate), tx(`${tr.completed ?? 0} από ${tr.assignments ?? 0} αναθέσεις`, `${tr.completed ?? 0} of ${tr.assignments ?? 0} assignments`), rate != null && rate < 80 ? 'warning' : 'good'],
        [tx('Εκπρόθεσμες', 'Overdue'), tr.overdue ?? 0, tx('πέρασε η προθεσμία ολοκλήρωσης', 'past the completion due date'), tr.overdue ? 'danger' : ''],
        [tx('Μέση βαθμολογία', 'Average score'), tr.averageScore == null ? '—' : fmtPct(tr.averageScore), tx('στις αξιολογήσεις', 'in assessments')],
      ],
      charts: [
        { type: 'rate', title: tx('Ολοκλήρωση ανά τμήμα', 'Completion by department'), subtitle: tx('Ποσοστό ολοκληρωμένων αναθέσεων.', 'Share of completed assignments.'), rows: rateRows(tr.byDepartment) },
        { type: 'bars', title: tx('Αναθέσεις ανά τμήμα', 'Assignments by department'), subtitle: tx('Πλήθος αναθέσεων στην περίοδο.', 'Assignments in the period.'), rows: (tr.byDepartment || []).map(([key, n]) => [key, n]) },
      ],
    } }
    case 'governance': { const g = d.governance || {}; return {
      kpis: [
        [tx('Ελεγχόμενα έγγραφα', 'Controlled documents'), g.documents ?? 0, tx(`${g.published ?? 0} σε ισχύ`, `${g.published ?? 0} in force`)],
        [tx('Προς αναθεώρηση', 'Review overdue'), g.reviewOverdue ?? 0, tx('πέρασε η ημερομηνία επανεξέτασης', 'past the review date'), g.reviewOverdue ? 'warning' : ''],
        [tx('Συνεδριάσεις επιτροπών', 'Committee meetings'), g.meetings ?? 0, tx(`${g.committees ?? '—'} ενεργές επιτροπές`, `${g.committees ?? '—'} active committees`)],
        [tx('Εκκρεμή πρακτικά', 'Pending minutes'), g.minutesPending ?? 0, tx(`${g.minutesFinalized ?? 0} οριστικοποιημένα`, `${g.minutesFinalized ?? 0} finalized`), g.minutesPending ? 'warning' : ''],
      ],
      charts: [
        { type: 'donut', title: tx('Έγγραφα ανά τύπο', 'Documents by type'), subtitle: tx('Ελεγχόμενα έγγραφα σε χρήση.', 'Controlled documents in use.'), rows: named(g.byType), center: tx('έγγραφα', 'documents') },
        { type: 'bars', title: tx('Κατάσταση εγγράφων', 'Document status'), subtitle: tx('Κύκλος ζωής ελεγχόμενων εγγράφων.', 'Controlled document lifecycle.'), rows: named(g.byStatus) },
      ],
    } }
    default: return null
  }
}
