// Interview documents on the shared report layout (core/export/reportDocument.js) and the
// Excel file of the list. Pure: each returns a document description or the rows.
import { exportRegistry } from '../../core/export/registryExports'
import { CRITERIA, SCORES, ageOn, decisionLabel, employmentLabel, fmtDay, fmtMoney, fmtRating, fmtStamp, interviewStatusLabel, interviewerRoleLabel, languageSkillsText, latestEvaluation, nextInterview, outcomeLabel, overallRating, statusLabel, yesNo } from './interviewsModel'

const scoreText = (value, en) => { const found = SCORES.find(([score]) => score === Number(value)); return found ? `${found[0]} · ${found[en ? 2 : 1]}` : '—' }

// The interview evaluation sheet: the candidate, the panel, the score per criterion,
// the overall rating, the recommendation and the signatures of the evaluators.
export function evaluationDocument(candidate, interview, { language = 'el' } = {}) {
  const en = language === 'en'
  const L = (el, enText) => (en ? enText : el)
  const rating = interview.overallRating ?? overallRating(interview.scores)
  const panel = (interview.interviewers || []).filter(item => item.name)
  return {
    language,
    kind: L('Φύλλο αξιολόγησης συνέντευξης', 'Interview evaluation sheet'),
    title: candidate.fullName,
    code: candidate.code,
    meta: [
      [L('Θέση', 'Position'), candidate.requestedPosition || '—'],
      [L('Απασχόληση', 'Employment'), employmentLabel(candidate.employmentType, language) || '—'],
      [L('Συνέντευξη', 'Interview'), interview.scheduledAt ? fmtStamp(interview.scheduledAt, language) : '—'],
      [L('Κατάσταση', 'Status'), interviewStatusLabel(interview.status, language)],
    ],
    sections: [
      { title: L('Υποψήφιος', 'Candidate'), facts: [
        [L('Ονοματεπώνυμο', 'Full name'), candidate.fullName], [L('Ηλικία', 'Age'), ageOn(candidate.birthDate) ?? '—'], [L('Τηλέφωνο', 'Phone'), candidate.phoneMobile || candidate.phoneLandline || '—'], [L('Email', 'Email'), candidate.email || '—'],
        [L('Εκπαίδευση', 'Education'), [candidate.educationLevel, ...(candidate.education || []).map(row => [row.level, row.school, row.year].filter(Boolean).join(' · '))].filter(Boolean).join('\n') || '—'],
        [L('Γλώσσες (ομιλία · ανάγνωση · γραφή)', 'Languages (speaking · reading · writing)'), (candidate.languages || []).map(row => languageSkillsText(row, language)).join('\n') || '—'],
        [L('Προϋπηρεσία', 'Experience'), (candidate.employers || []).map(row => `${row.employer}${row.jobTitle ? ` (${row.jobTitle})` : ''}`).join(' · ') || '—']] },
      { title: L('Επιτροπή συνέντευξης', 'Interview panel'), table: { columns: [L('Ονοματεπώνυμο', 'Name'), L('Ρόλος', 'Role')], rows: panel.map(item => [item.name, interviewerRoleLabel(item.role, language)]), empty: L('Χωρίς αξιολογητές.', 'No evaluators.') } },
      { title: L('Βαθμολογία ανά κριτήριο (1–5)', 'Score per criterion (1–5)'), table: { columns: [L('Κριτήριο', 'Criterion'), { text: L('Βαθμός', 'Score'), align: 'right' }],
        rows: CRITERIA.map(([key, el, enText]) => [en ? enText : el, { text: scoreText(interview.scores?.[key], en), align: 'right' }]),
        foot: [L('Συνολική βαθμολογία', 'Overall rating'), { text: fmtRating(rating, language), align: 'right' }] } },
      { title: L('Πρόταση', 'Recommendation'), facts: [
        [L('Πρόταση αξιολογητών', 'Panel recommendation'), outcomeLabel(interview.outcome, language) || '—'], [L('Πρόταση συνεργασίας', 'Proposal'), interview.recommendation || '—'],
        [L('Δυνατά σημεία', 'Strengths'), interview.strengths || '—'], [L('Σημεία προς βελτίωση', 'Areas to improve'), interview.weaknesses || '—'],
        [L('Μισθός που ζητήθηκε', 'Salary asked'), fmtMoney(interview.salaryExpectation, language)], [L('Μισθός που προτείνεται', 'Salary offered'), fmtMoney(interview.offeredSalary, language)],
        [L('Παροχές', 'Benefits'), interview.benefits || '—'], [L('Διαθέσιμος από', 'Available from'), fmtDay(interview.availableFrom)]] },
      { title: L('Σημειώσεις', 'Notes'), text: interview.notes || '—' },
    ],
    signatures: panel.length ? panel.map(item => ({ role: interviewerRoleLabel(item.role, language), name: item.name })) : [L('Αξιολογητής', 'Evaluator')],
    filename: `${en ? 'interview' : 'synentefxi'}_${candidate.code}`,
  }
}

// The candidates list as Excel, as the list shows it.
export function exportCandidates(rows, language = 'el') {
  const en = language === 'en'
  const L = (el, enText) => (en ? enText : el)
  exportRegistry({
    name: en ? 'candidates' : 'ypopsifioi',
    headers: [L('Κωδικός', 'Code'), L('Ονοματεπώνυμο', 'Full name'), L('Θέση', 'Position'), L('Απασχόληση', 'Employment'), L('Αίτηση', 'Applied'), L('Τηλέφωνο', 'Phone'), 'Email', L('Επόμενη συνέντευξη', 'Next interview'), L('Βαθμολογία', 'Rating'), L('Κατάσταση', 'Status'), L('Απόφαση', 'Decision'), L('Συναίνεση', 'Consent'), L('Πηγή', 'Source')],
    rows: rows.map(item => [item.code, item.fullName, item.requestedPosition, employmentLabel(item.employmentType, language), item.appliedOn, item.phoneMobile || item.phoneLandline, item.email, nextInterview(item)?.scheduledAt ? fmtStamp(nextInterview(item).scheduledAt, language) : '', latestEvaluation(item)?.overallRating ?? '', statusLabel(item.status, language), decisionLabel(item.decision, language), yesNo(item.consentGiven, language), item.source === 'filemaker' ? 'FileMaker' : '']),
  })
}
