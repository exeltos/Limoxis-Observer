// The audit report on the shared layout (core/export/reportDocument.js): scope,
// team, meetings, the result per chapter, the answers that were not
// «Συμμορφώνεται», the findings, the conclusion and the signatures of the lead
// auditor and the auditee; and the answers as an Excel (.csv) file. Pure.
import { AUDIT_KINDS, TEAM_ROLES, findingClassLabel, resultLabel, riskMonths, standardLabel, standardShort } from './auditStandards'
import { auditScore } from './auditModel'

const day = value => {
  if (!value) return '—'
  const [y, m, d] = String(value).slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
const month = (value, language) => (value ? new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'el-GR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${String(value).slice(0, 7)}-15T12:00:00Z`)) : '—')
const pct = value => (value == null ? '—' : `${value}%`)
const label = (list, value, en) => list.find(item => item.value === value)?.label[en ? 1 : 0] || value || ''

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const RESULT_COLOR = { yes: '#18794e', partial: '#b5720b', no: '#b42318', na: '#667085' }
// A thin stacked bar of the four results: width follows the number of answers.
const resultBar = (o, en) => {
  const total = o.yes + o.partial + o.no + o.na
  if (!total) return ''
  const names = { yes: en ? 'Conforms' : 'Συμμορφώνεται', partial: en ? 'Partial' : 'Μερική', no: en ? 'Nonconformity' : 'Μη συμμόρφωση', na: en ? 'N/A' : 'Δ.Ε.' }
  const segs = ['yes', 'partial', 'no', 'na'].filter(key => o[key] > 0).map(key => `<span style="display:block;float:left;height:12px;width:${(o[key] * 100 / total).toFixed(2)}%;background:${RESULT_COLOR[key]}"></span>`).join('')
  const legend = ['yes', 'partial', 'no', 'na'].map(key => `<span style="margin-right:14px;white-space:nowrap"><b style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${RESULT_COLOR[key]};margin-right:4px"></b>${esc(names[key])} <b>${o[key]}</b></span>`).join('')
  return `<div style="overflow:hidden;border-radius:6px;background:#eef1f4;height:12px">${segs}</div><p style="margin:6px 0 0;font-size:11px;color:#475467">${legend}</p>`
}
const rateBar = rate => (rate == null ? '' : `<span style="display:inline-block;width:90px;height:8px;border-radius:4px;background:#eef1f4;vertical-align:middle"><span style="display:block;height:8px;border-radius:4px;width:${Math.max(0, Math.min(100, rate))}%;background:${rate >= 90 ? '#18794e' : rate >= 75 ? '#b5720b' : '#b42318'}"></span></span>`)
const resultCell = (answer, language) => ({ html: `<b style="color:${RESULT_COLOR[answer] || '#667085'}">${esc(resultLabel(answer, language) || '—')}</b>` })

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
    subtitle: [[audit.standard, ...(audit.standards || []).filter(value => value !== audit.standard)].map(value => standardLabel(value, language)).filter(Boolean).join(' + '), audit.templateTitle && `${audit.templateTitle}${audit.templateVersion ? ` · ${L('έκδοση', 'version')} ${audit.templateVersion}` : ''}`].filter(Boolean).join(' · '),
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
      {
        title: L('Σύνοψη', 'Summary'),
        text: summaryText(audit, score, own, notMet, en),
        html: resultBar(score.overall, en),
        keepTogether: true,
      },
      { title: L('Πεδίο και κριτήρια', 'Scope and criteria'), text: [en ? audit.scopeEn || audit.scope : audit.scope, audit.clausesScope?.length ? `${L('Κεφάλαια / άρθρα', 'Chapters / clauses')}: ${audit.clausesScope.join(', ')}` : L('Όλο το ερωτηματολόγιο για την περιοχή του τμήματος.', 'The whole questionnaire for the department’s area.'), L('Τα ερωτήματα είναι βοήθημα επιθεώρησης με αναφορά στο άρθρο· δεν αποτελούν το κείμενο του προτύπου.', 'The questions are an audit aid with the clause reference; not the text of the standard.')].filter(Boolean).join('\n') },
      {
        title: L('Ομάδα επιθεώρησης', 'Audit team'),
        table: { columns: [L('Όνομα', 'Name'), L('Ρόλος', 'Role'), L('Ιδιότητα', 'Capacity')], rows: team.map(member => [member.name, label(TEAM_ROLES, member.role, en), member.external ? [L('Εξωτερικός', 'External'), member.affiliation].filter(Boolean).join(' · ') : member.department || L('Εργαζόμενος', 'Employee')]), empty: lead ? `${lead} (${L('επικεφαλής', 'lead')})` : L('Δεν ορίστηκε ομάδα.', 'No team set.') },
      },
      {
        title: L('Συσκέψεις', 'Meetings'),
        table: { columns: [L('Σύσκεψη', 'Meeting'), L('Ημερομηνία', 'Date'), L('Παρόντες', 'Attendees')], rows: [[L('Εναρκτήρια', 'Opening'), day(audit.openingMeeting?.date), audit.openingMeeting?.attendees || '—'], [L('Καταληκτική', 'Closing'), day(audit.closingMeeting?.date), audit.closingMeeting?.attendees || '—']] },
      },
      ...(score.standards.length > 1 ? [{
        title: L('Αποτελέσματα ανά πρότυπο', 'Results by standard'),
        table: { columns: [L('Πρότυπο', 'Standard'), { text: L('Ερωτήσεις', 'Questions'), align: 'right' }, { text: L('Μη συμμ.', 'Noncon.'), align: 'right' }, { text: L('Συμμόρφωση', 'Compliance'), align: 'right' }], rows: score.standards.map(item => [standardLabel(item.standard, language) || '—', { text: String(item.total), align: 'right' }, { text: String(item.no), align: 'right' }, { text: pct(item.rate), align: 'right' }]) },
      }] : []),
      {
        title: L('Αποτελέσματα ανά κεφάλαιο', 'Results by chapter'),
        table: {
          columns: [L('Κεφάλαιο', 'Chapter'), { text: L('Ερωτήσεις', 'Questions'), align: 'right' }, { text: L('Συμμ.', 'Conf.'), align: 'right' }, { text: L('Μερική', 'Partial'), align: 'right' }, { text: L('Μη συμμ.', 'Noncon.'), align: 'right' }, { text: L('Δ/Ε', 'N/A'), align: 'right' }, { text: L('Συμμόρφωση', 'Compliance'), align: 'right' }],
          rows: score.chapters.map(chapter => [[score.standards.length > 1 && chapter.standard ? standardShort(chapter.standard) : '', chapter.ref, chapter.title].filter(Boolean).join(' · ') || '—', { text: String(chapter.total), align: 'right' }, { text: String(chapter.yes), align: 'right' }, { text: String(chapter.partial), align: 'right' }, { text: String(chapter.no), align: 'right' }, { text: String(chapter.na), align: 'right' }, { html: `${rateBar(chapter.rate)} <b>${esc(pct(chapter.rate))}</b>`, align: 'right' }]),
          foot: [L('Σύνολο (σταθμισμένο)', 'Total (weighted)'), { text: String(score.overall.total), align: 'right' }, { text: String(score.overall.yes), align: 'right' }, { text: String(score.overall.partial), align: 'right' }, { text: String(score.overall.no), align: 'right' }, { text: String(score.overall.na), align: 'right' }, { text: pct(score.overall.rate), align: 'right' }],
          empty: L('Δεν υπάρχουν απαντήσεις.', 'No answers.'),
        },
        note: L('Συμμόρφωση = Σ(βάρος × τιμή) / Σ βάρος, με Συμμορφώνεται = 1, Μερική = ½, Μη συμμόρφωση = 0· οι «Δεν εφαρμόζεται» εξαιρούνται.', 'Compliance = Σ(weight × value) / Σ weight, with Conforms = 1, Partial = ½, Nonconformity = 0; «Not applicable» is left out.'),
      },
      {
        title: L('Δυνατά σημεία και σημεία βελτίωσης', 'Strengths and areas to improve'),
        tables: [
          { columns: [L('Δυνατά σημεία (κεφάλαια χωρίς απόκλιση)', 'Strengths (chapters without a deviation)')], rows: strengths(score, en).map(line => [line]), empty: L('Κανένα κεφάλαιο χωρίς απόκλιση.', 'No chapter without a deviation.') },
          { columns: [L('Σημεία βελτίωσης (κεφάλαια με αποκλίσεις)', 'Areas to improve (chapters with deviations)')], rows: weaknesses(score, en).map(line => [line]), empty: L('Δεν εντοπίστηκαν αποκλίσεις.', 'No deviation found.') },
        ],
      },
      {
        title: L('Διαπιστώσεις', 'Observations and nonconformities'),
        table: { columns: [L('Άρθρο', 'Clause'), L('Ερώτηση', 'Question'), L('Αποτέλεσμα', 'Result'), L('Κατάταξη', 'Class'), L('Διαπίστωση / τεκμήρια', 'Found / evidence')], rows: notMet.map(row => [row.clauseRef || '—', row.item, resultLabel(row.answer, language), findingClassLabel(row.findingClass, language) || '—', [row.note, row.evidence].filter(Boolean).join(' — ') || '—']), empty: L('Όλες οι απαντήσεις συμμορφώνονται.', 'Every answer conforms.') },
      },
      {
        title: L('Ευρήματα και διορθωτικές ενέργειες', 'Findings and corrective actions'),
        table: { columns: [L('Κωδικός', 'Code'), L('Κατάταξη', 'Class'), L('Εύρημα', 'Finding'), L('Υπεύθυνος', 'Owner'), L('Προθεσμία', 'Due'), L('Κατάσταση', 'Status')], rows: own.map(finding => [finding.displayId || finding.id, findingClassLabel(finding.findingClass, language) || '—', en ? finding.titleEn || finding.title : finding.title, (finding.owners || []).join(', ') || finding.owner || '—', day(finding.dueDate), finding.status === 'closed' ? L('Κλειστό', 'Closed') : L('Ανοιχτό', 'Open')]), empty: L('Δεν καταγράφηκαν ευρήματα.', 'No findings.') },
      },
      {
        title: L('Προτεινόμενες ενέργειες', 'Recommended actions'),
        list: notMet.filter(row => row.answer === 'no' || row.answer === 'partial').map(row => `${row.clauseRef ? `${row.clauseRef} — ` : ''}${row.item}${row.note ? ` (${row.note})` : ''}`),
        note: L('Κάθε διαπίστωση καταχωρείται ως εύρημα με υπεύθυνο και προθεσμία, και ακολουθεί η παρακολούθηση μέχρι το κλείσιμο.', 'Each deviation is raised as a finding with an owner and a due date, and followed until it is closed.'),
      },
      { title: L('Συμπέρασμα', 'Conclusion'), text: audit.conclusion || '—' },
      {
        title: L('Παράρτημα: πλήρες ερωτηματολόγιο', 'Appendix: the full questionnaire'),
        table: {
          columns: [L('Άρθρο', 'Clause'), L('Ερώτηση', 'Question'), L('Αποτέλεσμα', 'Result'), L('Σχόλιο', 'Comment')],
          rows: rows.map(row => [row.clauseRef || '—', row.item, resultCell(row.answer, language), [row.note, row.evidence].filter(Boolean).join(' — ') || '']),
          empty: L('Δεν υπάρχουν απαντήσεις.', 'No answers.'),
        },
      },
    ],
    signatures: [{ role: L('Επικεφαλής επιθεωρητής', 'Lead auditor'), name: lead }, { role: L('Εκπρόσωπος επιθεωρούμενου', 'Auditee'), name: audit.auditeeRepresentative || '' }],
    filename: `${audit.displayId || audit.id}_${en ? 'audit-report' : 'ekthesi-epitheorisis'}`,
  }
}

// The summary in words: what was audited, how it came out, where the deviations are.
function summaryText(audit, score, own, notMet, en) {
  const L = (el, english) => (en ? english : el)
  const o = score.overall
  const dept = (en ? audit.departmentEn : audit.department) || L('ο οργανισμός', 'the organization')
  const lines = [
    L(`Η επιθεώρηση του τμήματος «${dept}» ${audit.completedDate ? `ολοκληρώθηκε στις ${day(audit.completedDate)}` : `είναι προγραμματισμένη για ${day(audit.plannedDate)}`} και κάλυψε ${o.total} ερωτήσεις.`, `The audit of «${dept}» ${audit.completedDate ? `was completed on ${day(audit.completedDate)}` : `is planned for ${day(audit.plannedDate)}`} and covered ${o.total} questions.`),
    o.rate == null ? L('Δεν υπάρχουν ακόμη απαντήσεις.', 'There are no answers yet.') : L(`Η συνολική συμμόρφωση είναι ${o.rate}%: ${o.yes} συμμορφώνονται, ${o.partial} με μερική συμμόρφωση, ${o.no} μη συμμορφώσεις και ${o.na} δεν εφαρμόζονται.`, `Overall compliance is ${o.rate}%: ${o.yes} conform, ${o.partial} partially, ${o.no} nonconformities and ${o.na} not applicable.`),
  ]
  if (score.criticalFailed > 0) lines.push(L(`Προσοχή: ${score.criticalFailed} κρίσιμες ερωτήσεις δεν συμμορφώνονται.`, `Attention: ${score.criticalFailed} critical questions do not conform.`))
  const low = score.chapters.filter(chapter => chapter.rate != null && chapter.rate < 100)
  if (low.length) lines.push(L(`Οι αποκλίσεις βρίσκονται σε ${low.length} από ${score.chapters.length} κεφάλαια: ${low.slice(0, 4).map(chapter => chapter.ref || chapter.title).join(', ')}${low.length > 4 ? '…' : ''}.`, `Deviations are in ${low.length} of ${score.chapters.length} chapters: ${low.slice(0, 4).map(chapter => chapter.ref || chapter.title).join(', ')}${low.length > 4 ? '…' : ''}.`))
  else if (o.total) lines.push(L('Δεν εντοπίστηκε απόκλιση σε κανένα κεφάλαιο.', 'No deviation was found in any chapter.'))
  if (own.length) lines.push(L(`Καταγράφηκαν ${own.length} ευρήματα (${own.filter(finding => finding.status === 'closed').length} κλειστά).`, `${own.length} findings were raised (${own.filter(finding => finding.status === 'closed').length} closed).`))
  else if (notMet.length) lines.push(L(`Υπάρχουν ${notMet.length} διαπιστώσεις προς καταχώρηση ως ευρήματα.`, `${notMet.length} deviations are to be raised as findings.`))
  return lines.join('\n')
}
const chapterName = chapter => [chapter.ref, chapter.title].filter(Boolean).join(' · ') || '—'
const strengths = (score, en) => score.chapters.filter(chapter => chapter.rate === 100).map(chapter => `${chapterName(chapter)} — 100% (${chapter.total} ${en ? 'questions' : 'ερωτήσεις'})`)
const weaknesses = (score, en) => score.chapters.filter(chapter => chapter.rate != null && chapter.rate < 100).sort((a, b) => a.rate - b.rate).map(chapter => `${chapterName(chapter)} — ${chapter.rate}% (${chapter.partial} ${en ? 'partial' : 'μερική'}, ${chapter.no} ${en ? 'nonconformity' : 'μη συμμόρφωση'})`)

// The detailed reports of many audits in one document: an overview table, then for
// each completed audit its summary, chapters, strengths and weaknesses, deviations,
// findings and recommended actions, each audit starting on a new page.
export function auditDetailedBatchDocument(audits = [], findings = [], { language = 'el' } = {}) {
  const en = language === 'en'
  const L = (el, english) => (en ? english : el)
  const list = audits.filter(audit => audit.status === 'completed' && (audit.checklist || []).length)
    .sort((a, b) => String((en ? a.departmentEn : a.department) || a.department || '').localeCompare(String((en ? b.departmentEn : b.department) || b.department || ''), 'el') || String(a.completedDate).localeCompare(String(b.completedDate)))
  const scored = list.map(audit => ({ audit, score: auditScore(audit.checklist || []) }))
  const rated = scored.filter(item => item.score.overall.rate != null)
  const average = rated.length ? Math.round(rated.reduce((sum, item) => sum + item.score.overall.rate, 0) / rated.length) : null
  const dates = list.map(audit => String(audit.completedDate || audit.plannedDate).slice(0, 10)).sort()
  const keep = [L('Σύνοψη', 'Summary'), L('Αποτελέσματα ανά κεφάλαιο', 'Results by chapter'), L('Δυνατά σημεία και σημεία βελτίωσης', 'Strengths and areas to improve'), L('Διαπιστώσεις', 'Observations and nonconformities'), L('Ευρήματα και διορθωτικές ενέργειες', 'Findings and corrective actions'), L('Προτεινόμενες ενέργειες', 'Recommended actions'), L('Συμπέρασμα', 'Conclusion')]
  const sections = [{
    title: L('Συνολική εικόνα', 'Overview'),
    table: {
      columns: [L('Τμήμα', 'Department'), L('Ημερομηνία', 'Date'), L('Κωδικός', 'Code'), { text: L('Μερικές', 'Partial'), align: 'right' }, { text: L('Μη συμμ.', 'Noncon.'), align: 'right' }, { text: L('Ευρήματα', 'Findings'), align: 'right' }, { text: L('Συμμόρφωση', 'Compliance'), align: 'right' }],
      rows: scored.map(({ audit, score }) => [(en ? audit.departmentEn : audit.department) || audit.department || '—', day(audit.completedDate), audit.displayId || audit.id, { text: String(score.overall.partial), align: 'right' }, { text: String(score.overall.no), align: 'right' }, { text: String(findings.filter(finding => finding.sourceId === audit.id).length), align: 'right' }, { html: `${rateBar(score.overall.rate)} <b>${esc(pct(score.overall.rate))}</b>`, align: 'right' }]),
      foot: [L('Μέσος όρος', 'Average'), '', '', { text: String(scored.reduce((sum, item) => sum + item.score.overall.partial, 0)), align: 'right' }, { text: String(scored.reduce((sum, item) => sum + item.score.overall.no, 0)), align: 'right' }, { text: String(scored.reduce((sum, item) => sum + findings.filter(finding => finding.sourceId === item.audit.id).length, 0)), align: 'right' }, { text: pct(average), align: 'right' }],
      empty: L('Δεν υπάρχουν ολοκληρωμένες επιθεωρήσεις με απαντήσεις.', 'No completed audit with answers.'),
    },
  }]
  for (const { audit } of scored) {
    const doc = auditReportDocument(audit, findings, { language })
    sections.push({ html: '<div style="page-break-before:always;height:0"></div>' })
    sections.push({ title: `${(en ? audit.departmentEn : audit.department) || audit.department || L('Όλος ο οργανισμός', 'Whole organization')} · ${audit.displayId || audit.id} · ${day(audit.completedDate)}`, text: '' })
    doc.sections.filter(section => keep.includes(section.title)).forEach(section => sections.push({ ...section, title: `${section.title}` }))
  }
  return {
    language,
    numbered: false,
    kind: L('Αναλυτικές εκθέσεις επιθεώρησης', 'Detailed audit reports'),
    title: L('Αναλυτικές εκθέσεις επιθεωρήσεων', 'Detailed audit reports'),
    code: dates.length ? `${day(dates[0])} – ${day(dates.at(-1))}` : '',
    meta: [[L('Επιθεωρήσεις', 'Audits'), String(list.length)], [L('Μέση συμμόρφωση', 'Average compliance'), pct(average)], [L('Περίοδος', 'Period'), dates.length ? `${day(dates[0])} – ${day(dates.at(-1))}` : '—'], [L('Με ευρήματα', 'With findings'), String(scored.filter(({ audit }) => findings.some(finding => finding.sourceId === audit.id)).length)]],
    sections,
    signatures: [{ role: L('Υπεύθυνος Ποιότητας', 'Quality manager'), name: '' }],
    filename: en ? 'detailed-audit-reports' : 'analytikes-ekthesis-epitheoriseon',
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

// One report with a section per department: each of its audits (date, compliance) and their findings.
// For a single department when the list is filtered to it, or for all of them at once (a mass print).
export function auditDepartmentsReportDocument(audits = [], findings = [], { language = 'el' } = {}) {
  const en = language === 'en'
  const L = (el, english) => (en ? english : el)
  const live = audits.filter(audit => audit.status !== 'cancelled' && audit.lifecycleStatus !== 'voided')
  const names = [...new Set(live.map(audit => (en ? audit.departmentEn : audit.department) || audit.department || ''))].sort((a, b) => a.localeCompare(b, 'el'))
  const status = audit => (audit.status === 'completed' ? L('Ολοκληρώθηκε', 'Completed') : audit.status === 'planned' ? L('Προγραμματισμένη', 'Planned') : L('Σε εξέλιξη', 'In progress'))
  const when = audit => (audit.plannedMonthOnly ? month(audit.plannedDate, language) : day(audit.completedDate || audit.plannedDate))
  const ids = new Set(live.map(audit => audit.id))
  const own = findings.filter(finding => ids.has(finding.sourceId))
  return {
    language,
    kind: L('Έκθεση επιθεωρήσεων ανά τμήμα', 'Audit report by department'),
    title: names.length === 1 ? names[0] || L('Όλος ο οργανισμός', 'Whole organization') : L('Όλα τα τμήματα', 'All departments'),
    code: '',
    subtitle: L('Εσωτερικές επιθεωρήσεις και ευρήματα', 'Internal audits and findings'),
    meta: [
      [L('Τμήματα', 'Departments'), String(names.length)],
      [L('Επιθεωρήσεις', 'Audits'), String(live.length)],
      [L('Ευρήματα', 'Findings'), String(own.length)],
      [L('Ανοιχτά ευρήματα', 'Open findings'), String(own.filter(finding => finding.status !== 'closed').length)],
    ],
    sections: names.flatMap(name => {
      const list = live.filter(audit => ((en ? audit.departmentEn : audit.department) || audit.department || '') === name).sort((a, b) => String(a.completedDate || a.plannedDate).localeCompare(String(b.completedDate || b.plannedDate)))
      const found = own.filter(finding => list.some(audit => audit.id === finding.sourceId))
      return [{
        title: name || L('Όλος ο οργανισμός', 'Whole organization'),
        table: {
          columns: [L('Επιθεώρηση', 'Audit'), L('Ημερομηνία', 'Date'), L('Πρότυπο', 'Standard'), { text: L('Συμμόρφωση', 'Compliance'), align: 'right' }, L('Κατάσταση', 'Status')],
          rows: list.map(audit => [audit.displayId || audit.id, when(audit), standardLabel(audit.standard, language) || (audit.templateTitle || '—'), { text: pct(auditScore(audit.checklist || []).overall.rate), align: 'right' }, status(audit)]),
          empty: L('Καμία επιθεώρηση.', 'No audits.'),
        },
      }, {
        table: {
          columns: [L('Εύρημα', 'Finding'), L('Κατάταξη', 'Class'), L('Τίτλος', 'Title'), L('Προθεσμία', 'Due'), L('Κατάσταση', 'Status')],
          rows: found.map(finding => [finding.displayId || finding.id, findingClassLabel(finding.findingClass, language) || '—', en ? finding.titleEn || finding.title : finding.title, day(finding.dueDate), finding.status === 'closed' ? L('Κλειστό', 'Closed') : L('Ανοιχτό', 'Open')]),
          empty: L('Δεν καταγράφηκαν ευρήματα.', 'No findings.'),
        },
      }]
    }),
    signatures: [{ role: L('Υπεύθυνος Ποιότητας', 'Quality manager'), name: '' }],
    filename: `${en ? 'audits-by-department' : 'epitheoriseis-ana-tmima'}`,
  }
}

// The findings of the audits, one row per finding (Excel opens the .csv).
export function auditFindingsExport(audits = [], findings = [], language = 'el') {
  const en = language === 'en'
  const byId = new Map(audits.map(audit => [audit.id, audit]))
  return {
    name: en ? 'audit-findings' : 'efimata-epitheoriseon',
    headers: en ? ['Audit', 'Department', 'Date', 'Finding', 'Class', 'Title', 'Owner', 'Due', 'Status'] : ['Επιθεώρηση', 'Τμήμα', 'Ημερομηνία', 'Εύρημα', 'Κατάταξη', 'Τίτλος', 'Υπεύθυνος', 'Προθεσμία', 'Κατάσταση'],
    rows: findings.filter(finding => byId.has(finding.sourceId)).map(finding => {
      const audit = byId.get(finding.sourceId)
      return [audit.displayId || audit.id, (en ? audit.departmentEn : audit.department) || audit.department || '', day(audit.completedDate || audit.plannedDate), finding.displayId || finding.id, findingClassLabel(finding.findingClass, language) || '', en ? finding.titleEn || finding.title : finding.title, (finding.owners || []).join(', ') || finding.owner || '', day(finding.dueDate), finding.status === 'closed' ? (en ? 'Closed' : 'Κλειστό') : (en ? 'Open' : 'Ανοιχτό')]
    }),
  }
}
