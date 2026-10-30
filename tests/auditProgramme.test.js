import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { QUESTIONNAIRE_SEEDS, SYSTEM_TEMPLATES } from '../src/features/quality/audits/seed/index.js'
import { adHocRow, auditDashboard, auditReviewSummary, auditScore, awaitingFinding, capaDraftFromFinding, classesFor, clauseCoverage, competenceWarnings, findingDraftFromAnswer, fmQuestionClause, fmQuestionText, fmResult, inScope, independenceBlocks, independenceIssues, nextAuditDate, questionsForAudit, unclassified } from '../src/features/quality/audits/auditModel'
import { departmentArea } from '../src/features/quality/audits/auditStandards'
import { auditAnswersExport, auditReportDocument } from '../src/features/quality/audits/auditReport'
import { checklistFromRows, checklistRows, teamRows } from '../src/features/quality/qualityRelations'
import { programmeAudits, programmeFindings } from '../src/features/quality/audits/auditDemoData'
import { auditCompliance, pendingFindings } from '../src/features/quality/qualityAudit'
import { sectionFacts } from '../src/features/quality/review/reviewTemplate'

const migration = fs.readFileSync('supabase/migrations/20261124100000_quality_audit_programme.sql', 'utf8')
const wardMigration = fs.readFileSync('supabase/migrations/20261214110000_quality_audit_ward_checklist_seed.sql', 'utf8') + fs.readFileSync('supabase/migrations/20261230100000_quality_audit_core_questionnaire_seed.sql', 'utf8')
const demoMigration = fs.readFileSync('supabase/migrations/20261124100100_quality_audit_programme_demo.sql', 'utf8')
const template = key => SYSTEM_TEMPLATES.find(item => item.key === key)
const row = (answer, extra = {}) => ({ id: `r-${Math.random()}`, item: 'Q', chapterRef: '7', clauseRef: '7.1', weight: 1, answer, ...extra })

describe('questionnaire library', () => {
  it('seeds one questionnaire per chosen standard with good coverage', () => {
    const counts = Object.fromEntries(SYSTEM_TEMPLATES.map(item => [item.standard, item.questions.length]))
    expect(Object.keys(counts).sort()).toEqual(['haccp', 'iso15189', 'iso15224', 'iso9001', 'jci', 'other', 'temos'])
    for (const [standard, count] of Object.entries(counts)) expect(count, standard).toBeGreaterThanOrEqual(30)
    expect(counts.iso9001).toBeGreaterThan(70)
    expect(counts.jci).toBeGreaterThanOrEqual(90)
  })

  it('covers the clauses and chapters each standard is audited by', () => {
    const chapters = key => [...new Set(template(key).questions.map(item => item.chapterRef))]
    expect(chapters('iso9001')).toEqual(['4', '5', '6', '7', '8', '9', '10'])
    expect(chapters('iso15224').filter(ref => ref.startsWith('ΧΠ-'))).toHaveLength(11)
    expect(chapters('jci')).toEqual(expect.arrayContaining(['IPSG', 'ACC', 'PCC', 'AOP', 'MMU', 'PFE', 'QPS', 'PCI', 'GLD', 'FMS', 'SQE', 'MOI']))
    expect(chapters('iso15189')).toEqual(expect.arrayContaining(['7.2', '7.3', '7.4']))
    expect(template('haccp').questions.filter(item => item.chapterRef === 'HACCP').map(item => item.clauseRef)).toEqual(expect.arrayContaining(['Αρχή 1', 'Αρχή 2', 'Αρχή 3', 'Αρχή 4', 'Αρχή 5', 'Αρχή 6', 'Αρχή 7']))
    expect(chapters('temos')).toHaveLength(8)
  })

  it('writes audit questions with a clause reference and says it is not the standard text', () => {
    for (const item of SYSTEM_TEMPLATES) {
      if (item.key !== 'ward') expect(item.description).toContain('Δεν αποτελεί το κείμενο του προτύπου')
      expect(item.isSystem).toBe(true)
      for (const question of item.questions) {
        expect(question.clauseRef, question.question).toBeTruthy()
        expect(question.question.trim().endsWith(';'), question.question).toBe(true)
      }
    }
  })

  it('seeds the database library from the same files', () => {
    for (const seed of QUESTIONNAIRE_SEEDS) {
      const match = (migration + wardMigration).match(new RegExp(`'(\\{"k":"${seed.key}".*?\\})'::jsonb j\\)`, 's'))
      expect(match, seed.key).toBeTruthy()
      const stored = JSON.parse(match[1].replace(/''/g, "'"))
      expect(stored.ch.flatMap(chapter => chapter.q.map(question => question[1]))).toEqual(seed.chapters.flatMap(chapter => chapter.questions.map(question => question[1])))
      expect(stored.t).toBe(seed.title)
    }
    expect(migration).toContain('constraint quality_audit_templates_system_scope check ((is_system and organization_id is null) or (not is_system and organization_id is not null))')
    expect(migration).not.toMatch(/\bdrop\s+(table|constraint|policy|trigger|column)\b/i)
  })
})

describe('questions for an audit', () => {
  it('filters by the department area and the chapters in scope', () => {
    expect(departmentArea('Μικροβιολογικό Εργαστήριο')).toBe('laboratory')
    expect(departmentArea('Κουζίνα')).toBe('kitchen')
    expect(departmentArea('ΜΕΘ')).toBe('clinical')
    const ward = questionsForAudit(template('iso9001'), { department: 'Παθολογική' })
    expect(ward.some(item => item.clauseRef === '9.3.1')).toBe(false)
    expect(questionsForAudit(template('iso9001'), {}).some(item => item.clauseRef === '9.3.1')).toBe(true)
    const jci = questionsForAudit(template('jci'), { department: 'ΜΕΘ', scope: ['IPSG', 'MMU'] })
    expect(new Set(jci.map(item => item.chapterRef))).toEqual(new Set(['IPSG', 'MMU']))
    expect(jci.every(item => item.answer === '' && item.templateQuestionId)).toBe(true)
    expect(inScope({ chapterRef: '7', clauseRef: '7.10' }, ['7.1'])).toBe(false)
    expect(inScope({ chapterRef: '7', clauseRef: '7.1.5' }, ['7.1'])).toBe(true)
  })

  it('keeps a question asked on the spot with its clause', () => {
    expect(adHocRow('Υπάρχει πρόγραμμα;', { clauseRef: '7.2', chapterRef: '7' })).toMatchObject({ item: 'Υπάρχει πρόγραμμα;', clauseRef: '7.2', chapterRef: '7', adHoc: true, templateQuestionId: null })
  })
})

describe('scoring', () => {
  it('weights conformity, counts partial as half and leaves N/A out, per chapter and overall', () => {
    const rows = [row('yes', { weight: 2 }), row('partial'), row('no'), row('na'), row('yes', { chapterRef: '8', clauseRef: '8.1' }), row('')]
    const score = auditScore(rows)
    expect(score.overall).toMatchObject({ yes: 2, partial: 1, no: 1, na: 1, unanswered: 1, applicable: 4, rate: Math.round((2 + 0.5 + 0 + 1) * 100 / 5) })
    expect(score.chapters.find(chapter => chapter.ref === '7')).toMatchObject({ rate: Math.round(2.5 * 100 / 4) })
    expect(score.chapters.find(chapter => chapter.ref === '8').rate).toBe(100)
    expect(auditScore([row('na')]).overall.rate).toBeNull()
    expect(auditScore([row('no', { critical: true })]).criticalFailed).toBe(1)
  })

  it('keeps the earlier yes / no / N/A checklist audits working', () => {
    expect(auditCompliance({ checklist: [{ answer: 'yes' }, { answer: 'no' }, { answer: 'na' }] })).toMatchObject({ rate: 50, applicable: 2, yes: 1 })
    expect(pendingFindings([{ answer: 'partial', id: 'a' }, { answer: 'no', id: 'b', findingId: 'F' }]).map(item => item.id)).toEqual(['a'])
  })
})

describe('findings from answers', () => {
  const audit = { id: 'AUD-260924-091005', standard: 'jci', department: 'ΜΕΘ', departmentId: 'd1', completedDate: '2026-09-24' }
  it('asks for a class on every partial or nonconformity', () => {
    expect(classesFor('no')).toEqual(['major', 'minor'])
    expect(classesFor('partial')).toEqual(['major', 'minor', 'observation', 'opportunity'])
    expect(classesFor('yes')).toEqual(['observation', 'opportunity'])
    const rows = [row('no'), row('partial', { findingClass: 'minor' }), row('yes', { findingClass: 'opportunity' }), row('yes')]
    expect(unclassified(rows)).toHaveLength(1)
    expect(awaitingFinding(rows)).toHaveLength(2)
  })

  it('makes a finding linked back to the audit and the question, due by its class, and its CAPA', () => {
    const answer = { id: 'item-1', clauseRef: 'IPSG.3', item: 'Απουσιάζουν τα πυκνά ηλεκτρολυτικά;', answer: 'no', findingClass: 'major', note: 'KCl σε ανοιχτό ερμάριο', evidence: 'Θάλαμος 2' }
    const finding = findingDraftFromAnswer(audit, answer, { owner: 'Παπαδοπούλου Μαρία' })
    expect(finding).toMatchObject({ source: 'audit', sourceId: audit.id, auditItemId: 'item-1', findingClass: 'major', severity: 'high', clauseRef: 'IPSG.3', standard: 'jci', dueDate: '2026-10-24', owners: ['Παπαδοπούλου Μαρία'], departmentId: 'd1' })
    expect(finding.title).toContain('JCI IPSG.3')
    expect(finding.description).toContain('Θάλαμος 2')
    expect(findingDraftFromAnswer(audit, { ...answer, findingClass: 'observation' }).dueDate).toBe('2026-12-23')
    const capa = capaDraftFromFinding({ ...finding, id: 'FND-1' }, { owner: 'Φαρμακείο', dueDate: '2026-10-20' })
    expect(capa).toMatchObject({ source: 'finding', sourceId: 'FND-1', owner: 'Φαρμακείο', dueDate: '2026-10-20', effectivenessDue: '2026-11-19', priority: 'high', actionType: 'corrective' })
  })
})

describe('the audit team', () => {
  it('blocks a lead auditor of their own department and warns for a team member', () => {
    const department = { id: 'd-icu', name: 'ΜΕΘ' }
    const team = [{ role: 'lead', employeeId: 'e1', name: 'Α', departmentId: 'd-icu' }, { role: 'member', employeeId: 'e2', name: 'Β', department: 'ΜΕΘ' }, { role: 'member', name: 'Εξωτερικός', external: true, department: 'ΜΕΘ' }]
    expect(independenceIssues(team, department).map(issue => [issue.member.name, issue.level])).toEqual([['Α', 'block'], ['Β', 'warn']])
    expect(independenceBlocks(team, department)).toBe(true)
    expect(independenceBlocks(team.slice(1), department)).toBe(false)
    expect(independenceIssues(team, {})).toEqual([])
  })

  it('warns when an employee has no valid auditor certificate or training', () => {
    const team = [{ employeeId: 'e1', name: 'Α' }, { employeeId: 'e2', name: 'Β' }, { employeeId: 'e3', name: 'Γ' }, { name: 'Ext', external: true }]
    const competence = {
      certificates: [{ employeeId: 'e1', title: 'Εσωτερικός επιθεωρητής ISO 9001', validUntil: '2030-01-01' }, { employeeId: 'e2', title: 'Εσωτερικός επιθεωρητής', validUntil: '2020-01-01' }],
      programs: [{ id: 'p1', title: 'Εκπαίδευση επιθεωρητών ISO 19011' }],
      assignments: [{ employeeId: 'e3', programId: 'p1', status: 'completed' }],
    }
    expect(competenceWarnings(team, competence, '2026-10-19').map(member => member.name)).toEqual(['Β'])
  })

  it('stores employees and external auditors', () => {
    const rows = teamRows([{ name: 'Ext', external: true, employeeId: 'x', role: 'lead' }, { name: ' ' }])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ full_name: 'Ext', is_external: true, employee_id: null, role: 'lead' })
  })
})

describe('programme, coverage and dashboard', () => {
  it('shows per standard which chapters each department had audited, planned or missed', () => {
    const iso = template('iso9001')
    const audits = [
      { id: 'a1', standard: 'iso9001', department: 'ΜΕΘ', status: 'completed', plannedDate: '2026-03-01', checklist: [row('yes', { chapterRef: '7' }), row('no', { chapterRef: '8' })] },
      { id: 'a2', standard: 'iso9001', department: 'ΤΕΠ', status: 'planned', plannedDate: '2026-11-01', clausesScope: ['9'], checklist: [] },
      { id: 'a3', standard: 'jci', department: 'ΜΕΘ', status: 'completed', plannedDate: '2026-03-01', checklist: [row('yes', { chapterRef: '4' })] },
    ]
    const coverage = clauseCoverage(audits, iso, 2026, [{ name: 'ΜΕΘ' }, { name: 'ΤΕΠ' }, { name: 'Καρδιολογική' }])
    expect(coverage.rows.map(item => item.department)).toEqual(['ΜΕΘ', 'ΤΕΠ'])
    const icu = coverage.rows[0].cells
    expect(icu.find(cell => cell.ref === '7')).toMatchObject({ state: 'audited', rate: 100 })
    expect(icu.find(cell => cell.ref === '8')).toMatchObject({ state: 'audited', rate: 0 })
    expect(icu.find(cell => cell.ref === '4').state).toBe('gap')
    expect(coverage.rows[1].cells.find(cell => cell.ref === '9').state).toBe('planned')
    expect(coverage.uncovered).toEqual(['4', '5', '6', '9', '10'])
  })

  it('sums compliance by standard, department and chapter and open findings by class', () => {
    const data = auditDashboard(programmeAudits, programmeFindings, { year: 2026, standard: 'jci' })
    expect(data.byStandard.map(item => item.key)).toEqual(expect.arrayContaining(['iso9001', 'iso15224', 'temos', 'jci']))
    expect(data.byChapter.map(item => item.ref)).toEqual(['IPSG', 'COP', 'MMU', 'PCI'])
    expect(data.openByClass.major).toBe(1)
    expect(data.trend).toHaveLength(12)
    expect(nextAuditDate('2026-09-24', 'high')).toBe('2027-03-24')
  })

  it('gives the management review the results per standard and the findings by class', () => {
    const summary = auditReviewSummary(programmeAudits, programmeFindings, day => String(day).startsWith('2026'))
    expect(summary.standards.find(item => item.standard === 'jci')).toMatchObject({ completed: 1 })
    expect(summary.findings.major).toBe(1)
    const lines = sectionFacts('audits', { audits: programmeAudits, findings: programmeFindings }, { from: '2026-01-01', to: '2026-12-31' })
    expect(lines.join('\n')).toContain('JCI')
    expect(lines.join('\n')).toContain('μείζονα')
  })
})

describe('report and storage', () => {
  it('builds the audit report on the shared layout with team, meetings, chapters, findings and signatures', () => {
    const audit = programmeAudits.find(item => item.standard === 'jci')
    const doc = auditReportDocument({ ...audit, displayId: audit.id }, programmeFindings)
    expect(doc.sections.map(section => section.title)).toEqual(['Σύνοψη', 'Πεδίο και κριτήρια', 'Ομάδα επιθεώρησης', 'Συσκέψεις', 'Αποτελέσματα ανά κεφάλαιο', 'Δυνατά σημεία και σημεία βελτίωσης', 'Διαπιστώσεις', 'Ευρήματα και διορθωτικές ενέργειες', 'Προτεινόμενες ενέργειες', 'Συμπέρασμα', 'Παράρτημα: πλήρες ερωτηματολόγιο'])
    expect(doc.signatures.map(item => item.role)).toEqual(['Επικεφαλής επιθεωρητής', 'Εκπρόσωπος επιθεωρούμενου'])
    expect(doc.sections[4].table.rows.map(cells => cells[0].split(' · ')[0])).toEqual(['IPSG', 'COP', 'MMU', 'PCI'])
    expect(doc.sections[0].text).toContain('συμμόρφωση')
    expect(doc.sections[0].html).toContain('background:#18794e')
    expect(doc.sections.at(-1).table.rows).toHaveLength(audit.checklist.length)
    expect(auditAnswersExport(audit).rows).toHaveLength(audit.checklist.length)
  })

  it('keeps the four answers in result and the three-value answer for earlier readers', () => {
    const [stored] = checklistRows([{ id: 'x', item: 'Q', answer: 'partial', findingClass: 'minor', clauseRef: '7.1', weight: 2 }])
    expect(stored).toMatchObject({ answer: null, result: 'partial', finding_class: 'minor', clause_ref: '7.1', weight: 2 })
    expect(checklistRows([{ item: 'Q', answer: 'no' }])[0]).toMatchObject({ answer: 'no', result: 'no' })
    expect(checklistFromRows([{ id: 'x', item: 'Q', answer: null, result: 'partial', position: 1 }, { id: 'y', item: 'R', answer: 'yes', result: null, position: 2 }]).map(item => item.answer)).toEqual(['partial', 'yes'])
  })

  it('seeds the database demo with the same story and leaves organizations already seeded alone', () => {
    expect(demoMigration).toContain("if exists (select 1 from public.quality_audits qa where qa.organization_id = v_org and qa.source = 'seed' and qa.standard is not null) then return; end if;")
    for (const ref of ['IPSG.3', 'T2.3', 'ΧΠ-3', '7.5.3']) expect(demoMigration).toContain(`"ref":"${ref}"`)
    expect(demoMigration).toContain('perform private.demo_seed_quality_audit_programme(p_organization_id, p_actor);')
  })
})

describe('FileMaker audits (ΙΑΣΩ)', () => {
  it('maps the FileMaker results to the four-value scale and a class', () => {
    expect(fmResult('Πλήρη Κάλυψη')).toEqual({ answer: 'yes', findingClass: '' })
    expect(fmResult('Μερική Κάλυψη - Minor ΜΗΣ')).toEqual({ answer: 'partial', findingClass: 'minor' })
    expect(fmResult('Παρατήρηση')).toEqual({ answer: 'yes', findingClass: 'observation' })
    expect(fmResult('Πρόταση Βελτίωσης')).toEqual({ answer: 'yes', findingClass: 'opportunity' })
    expect(fmResult('Major ΜΗΣ')).toEqual({ answer: 'no', findingClass: 'major' })
    expect(fmResult('')).toEqual({ answer: '', findingClass: '' })
  })

  it('keeps each FileMaker question as the audit’s own question with its ISO 9001 clause', () => {
    expect(fmQuestionClause('Διαχείριση Συμβάντων: Καταγράφονται τα συμβάντα σύφωνα με τις διαδικασίες;')).toEqual({ clauseRef: '10.2.1', chapterRef: '10' })
    expect(fmQuestionClause('Πόροι και Υποδομές: Διαθέτει το τμήμα…')).toEqual({ clauseRef: '7.1.3', chapterRef: '7' })
    expect(fmQuestionClause('Κάτι άλλο')).toEqual({ clauseRef: '', chapterRef: '' })
    expect(fmQuestionText('Αντιμετώπιση Κρίσεων: Γγνωρίζει το προσωπικό;')).toBe('Αντιμετώπιση Κρίσεων: Γνωρίζει το προσωπικό;')
    expect(template('iso9001').questions.some(item => item.clauseRef === '10.2.1')).toBe(true)
  })
})
