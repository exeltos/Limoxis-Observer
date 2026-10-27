// The audit report on the shared layout (core/export/reportDocument.js): scope,
// team, meetings, the result per chapter, the answers that were not
// «Συμμορφώνεται», the findings, the conclusion and the signatures of the lead
// auditor and the auditee; and the answers as an Excel (.csv) file. Pure.
import { AUDIT_KINDS, TEAM_ROLES, findingClassLabel, resultLabel, riskMonths, standardLabel } from './auditStandards'
import { auditScore } from './auditModel'

const day = value => {
  if (!value) return '—'
  const [y, m, d] = String(value).slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
const month = (value, language) => (value ? new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'el-GR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${String(value).slice(0, 7)}-15T12:00:00Z`)) : '—')
const pct = value => (value == null ? '—' : `${value}%`)
const label = (list, value, en) => list.find(item => item.value === value)?.label[en ? 1 : 0] || value || ''

export function auditReportDocument(audit, findings = [], { language = 'el' } = {}) {
  const en = language === 'en'
  const L = (el, english) => (en ? english : el)
  const rows = audit.checklist || []
  const score = auditScore(rows)
  const team = audit.team || []
  const lead = team.find(member => member.role === 'lead')?.name || audit.leadAuditor || ''
  const own = findings.filter(finding => finding.sourceId === audit.id)
  const notMet = rows.filter(row => (row.answer === 'partial' || row.answer === 'no') || Boolean(row.findingClass))
  return {
    language,
    kind: L('Έκθεση επιθεώρησης', 'Audit report'),
    title: en ? audit.titleEn || audit.title : audit.title,
    code: audit.displayId || audit.id,
    subtitle: [standardLabel(audit.standard, language), audit.templateTitle && `${audit.templateTitle}${audit.templateVersion ? ` · ${L('έκδοση', 'version')} ${audit.templateVersion}` : ''}`].filter(Boolean).join(' · '),
    meta: [
      [L('Τμήμα', 'Department'), (en ? audit.departmentEn : audit.department) || L('Όλος ο οργανισμός', 'Whole organization')],
      [L('Είδος', 'Kind'), label(AUDIT_KINDS, audit.auditType || 'internal', en)],
      [L('Προγραμματισμός', 'Planned'), audit.plannedMonthOnly ? month(audit.plannedDate, language) : day(audit.plannedDate)],
      [L('Ολοκλήρωση', 'Completed'), day(audit.completedDate)],
      [L('Επικεφαλής επιθεωρητής', 'Lead auditor'), lead || '—'],
      [L('Εκπρόσωπος τμήματος', 'Auditee representative'), audit.auditeeRepresentative || '—'],
      [L('Κίνδυνος / συχνότητα', 'Risk / frequency'), audit.riskLevel ? L(`κάθε ${riskMonths(audit.riskLevel)} μήνες`, `every ${riskMonths(audit.riskLevel)} months`) : '—'],
      [L('Συμμόρφωση', 'Compliance'), `${pct(score.overall.rate)} (${score.overall.yes} ${L('συμμ.', 'conf.')}, ${score.overall.partial} ${L('μερ.', 'part.')}, ${score.overall.no} ${L('μη συμμ.', 'noncon.')}, ${score.overall.na} ${L('Δ/Ε', 'N/A')})`],
    ],
    sections: [
      { title: L('Πεδίο και κριτήρια', 'Scope and criteria'), text: [en ? audit.scopeEn || audit.scope : audit.scope, audit.clausesScope?.length ? `${L('Κεφάλαια / άρθρα', 'Chapters / clauses')}: ${audit.clausesScope.join(', ')}` : L('Όλο το ερωτηματολόγιο για την περιοχή του τμήματος.', 'The whole questionnaire for the department’s area.'), L('Τα ερωτήματα είναι βοήθημα επιθεώρησης με αναφορά στο άρθρο· δεν αποτελούν το κείμενο του προτύπου.', 'The questions are an audit aid with the clause reference; not the text of the standard.')].filter(Boolean).join('\n') },
      {
        title: L('Ομάδα επιθεώρησης', 'Audit team'),
        table: { columns: [L('Όνομα', 'Name'), L('Ρόλος', 'Role'), L('Ιδιότητα', 'Capacity')], rows: team.map(member => [member.name, label(TEAM_ROLES, member.role, en), member.external ? [L('Εξωτερικός', 'External'), member.affiliation].filter(Boolean).join(' · ') : member.department || L('Εργαζόμενος', 'Employee')]), empty: lead ? `${lead} (${L('επικεφαλής', 'lead')})` : L('Δεν ορίστηκε ομάδα.', 'No team set.') },
      },
      {
        title: L('Συσκέψεις', 'Meetings'),
        table: { columns: [L('Σύσκεψη', 'Meeting'), L('Ημερομηνία', 'Date'), L('Παρόντες', 'Attendees')], rows: [[L('Εναρκτήρια', 'Opening'), day(audit.openingMeeting?.date), audit.openingMeeting?.attendees || '—'], [L('Καταληκτική', 'Closing'), day(audit.closingMeeting?.date), audit.closingMeeting?.attendees || '—']] },
      },
      {
        title: L('Αποτελέσματα ανά κεφάλαιο', 'Results by chapter'),
        table: {
          columns: [L('Κεφάλαιο', 'Chapter'), { text: L('Ερωτήσεις', 'Questions'), align: 'right' }, { text: L('Συμμ.', 'Conf.'), align: 'right' }, { text: L('Μερική', 'Partial'), align: 'right' }, { text: L('Μη συμμ.', 'Noncon.'), align: 'right' }, { text: L('Δ/Ε', 'N/A'), align: 'right' }, { text: L('Συμμόρφωση', 'Compliance'), align: 'right' }],
          rows: score.chapters.map(chapter => [[chapter.ref, chapter.title].filter(Boolean).join(' · ') || '—', { text: String(chapter.total), align: 'right' }, { text: String(chapter.yes), align: 'right' }, { text: String(chapter.partial), align: 'right' }, { text: String(chapter.no), align: 'right' }, { text: String(chapter.na), align: 'right' }, { text: pct(chapter.rate), align: 'right' }]),
          foot: [L('Σύνολο (σταθμισμένο)', 'Total (weighted)'), { text: String(score.overall.total), align: 'right' }, { text: String(score.overall.yes), align: 'right' }, { text: String(score.overall.partial), align: 'right' }, { text: String(score.overall.no), align: 'right' }, { text: String(score.overall.na), align: 'right' }, { text: pct(score.overall.rate), align: 'right' }],
          empty: L('Δεν υπάρχουν απαντήσεις.', 'No answers.'),
        },
        note: L('Συμμόρφωση = Σ(βάρος × τιμή) / Σ βάρος, με Συμμορφώνεται = 1, Μερική = ½, Μη συμμόρφωση = 0· οι «Δεν εφαρμόζεται» εξαιρούνται.', 'Compliance = Σ(weight × value) / Σ weight, with Conforms = 1, Partial = ½, Nonconformity = 0; «Not applicable» is left out.'),
      },
      {
        title: L('Διαπιστώσεις', 'Observations and nonconformities'),
        table: { columns: [L('Άρθρο', 'Clause'), L('Ερώτηση', 'Question'), L('Αποτέλεσμα', 'Result'), L('Κατάταξη', 'Class'), L('Διαπίστωση / τεκμήρια', 'Found / evidence')], rows: notMet.map(row => [row.clauseRef || '—', row.item, resultLabel(row.answer, language), findingClassLabel(row.findingClass, language) || '—', [row.note, row.evidence].filter(Boolean).join(' — ') || '—']), empty: L('Όλες οι απαντήσεις συμμορφώνονται.', 'Every answer conforms.') },
      },
      {
        title: L('Ευρήματα και διορθωτικές ενέργειες', 'Findings and corrective actions'),
        table: { columns: [L('Κωδικός', 'Code'), L('Κατάταξη', 'Class'), L('Εύρημα', 'Finding'), L('Υπεύθυνος', 'Owner'), L('Προθεσμία', 'Due'), L('Κατάσταση', 'Status')], rows: own.map(finding => [finding.displayId || finding.id, findingClassLabel(finding.findingClass, language) || '—', en ? finding.titleEn || finding.title : finding.title, (finding.owners || []).join(', ') || finding.owner || '—', day(finding.dueDate), finding.status === 'closed' ? L('Κλειστό', 'Closed') : L('Ανοιχτό', 'Open')]), empty: L('Δεν καταγράφηκαν ευρήματα.', 'No findings.') },
      },
      { title: L('Συμπέρασμα', 'Conclusion'), text: audit.conclusion || '—' },
    ],
    signatures: [{ role: L('Επικεφαλής επιθεωρητής', 'Lead auditor'), name: lead }, { role: L('Εκπρόσωπος επιθεωρούμενου', 'Auditee'), name: audit.auditeeRepresentative || '' }],
    filename: `${audit.displayId || audit.id}_${en ? 'audit-report' : 'ekthesi-epitheorisis'}`,
  }
}

// The answers, one row per question (Excel opens the .csv).
export function auditAnswersExport(audit, language = 'el') {
  const en = language === 'en'
  return {
    name: `${audit.displayId || audit.id}_${en ? 'answers' : 'apantiseis'}`,
    headers: en ? ['#', 'Chapter', 'Clause', 'Question', 'Weight', 'Critical', 'Result', 'Class', 'Comment', 'Evidence examined', 'Finding'] : ['#', 'Κεφάλαιο', 'Άρθρο', 'Ερώτηση', 'Βάρος', 'Κρίσιμη', 'Αποτέλεσμα', 'Κατάταξη', 'Σχόλιο', 'Τεκμήρια που εξετάστηκαν', 'Εύρημα'],
    rows: (audit.checklist || []).map((row, index) => [index + 1, [row.chapterRef, row.chapterTitle].filter(Boolean).join(' · '), row.clauseRef || '', row.item, row.weight || 1, row.critical ? (en ? 'Yes' : 'Ναι') : '', resultLabel(row.answer, language), findingClassLabel(row.findingClass, language), row.note || '', row.evidence || '', row.findingId || '']),
  }
}

// The report of an audit round: every department audited in the period, day by
// day, with its compliance and findings, and the totals. For the Quality
// manager to hand over after the round; each department's own report is on its audit.
export function auditRoundReportDocument(audits = [], findings = [], { language = 'el', from = '', to = '' } = {}) {
  const en = language === 'en'
  const L = (el, english) => (en ? english : el)
  const inRound = audits.filter(audit => audit.status !== 'cancelled' && audit.lifecycleStatus !== 'voided' && !audit.plannedMonthOnly && (!from || String(audit.completedDate || audit.plannedDate) >= from) && (!to || String(audit.completedDate || audit.plannedDate) <= to))
  const dayOf = audit => String(audit.completedDate || audit.plannedDate || '').slice(0, 10)
  const days = [...new Set(inRound.map(dayOf))].sort()
  const scored = inRound.map(audit => ({ audit, score: auditScore(audit.checklist || []) }))
  const rates = scored.map(item => item.score.overall.rate).filter(rate => rate != null)
  const average = rates.length ? Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length) : null
  const ids = new Set(inRound.map(audit => audit.id))
  const own = findings.filter(finding => ids.has(finding.sourceId))
  const byClass = ['major', 'minor', 'observation', 'opportunity'].map(value => [findingClassLabel(value, language), own.filter(finding => finding.findingClass === value).length])
  return {
    language,
    kind: L('Έκθεση κύκλου επιθεώρησης', 'Audit round report'),
    title: `${day(from || days[0])} – ${day(to || days[days.length - 1])}`,
    code: '',
    subtitle: L('Εσωτερικές επιθεωρήσεις τμημάτων', 'Internal department audits'),
    meta: [
      [L('Επιθεωρήσεις', 'Audits'), String(inRound.length)],
      [L('Ολοκληρωμένες', 'Completed'), String(inRound.filter(audit => audit.status === 'completed').length)],
      [L('Μέση συμμόρφωση', 'Average compliance'), pct(average)],
      [L('Ευρήματα', 'Findings'), String(own.length)],
    ],
    sections: [
      { title: L('Ευρήματα ανά κατάταξη', 'Findings by class'), table: { columns: [L('Κατάταξη', 'Class'), { text: L('Πλήθος', 'Count'), align: 'right' }], rows: byClass.map(([name, count]) => [name, { text: String(count), align: 'right' }]) } },
      ...days.map(date => ({
        title: day(date),
        table: {
          columns: [L('Τμήμα', 'Department'), L('Πρότυπο', 'Standard'), { text: L('Συμμόρφωση', 'Compliance'), align: 'right' }, { text: L('Ευρήματα', 'Findings'), align: 'right' }, L('Επικεφαλής', 'Lead auditor'), L('Κατάσταση', 'Status')],
          rows: scored.filter(item => dayOf(item.audit) === date).map(({ audit, score }) => [
            (en ? audit.departmentEn : audit.department) || '—', standardLabel(audit.standard, language) || '—', { text: pct(score.overall.rate), align: 'right' },
            { text: String(own.filter(finding => finding.sourceId === audit.id).length), align: 'right' }, audit.leadAuditor || '—', audit.status === 'completed' ? L('Ολοκληρώθηκε', 'Completed') : L('Προγραμματισμένη', 'Planned'),
          ]),
          empty: L('Καμία επιθεώρηση.', 'No audits.'),
        },
      })),
    ],
    signatures: [{ role: L('Υπεύθυνος Ποιότητας', 'Quality manager'), name: '' }],
    filename: `${en ? 'audit-round-report' : 'ekthesi-kyklou-epitheorisis'}_${from || days[0] || ''}`,
  }
}
