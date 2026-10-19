// The questionnaires every hospital starts with: one per chosen standard, by
// clause or chapter. The platform library holds them (the database seed in
// 20261124100000_quality_audit_programme.sql is generated from these files);
// a hospital copies one to edit it. The questions are our own audit questions
// with the clause reference, never the text of a standard.
import iso9001 from './iso9001.js'
import iso15224 from './iso15224.js'
import haccp from './haccp.js'
import iso15189 from './iso15189.js'
import temos from './temos.js'
import jci from './jci.js'

export const QUESTIONNAIRE_SEEDS = [iso9001, iso15224, haccp, iso15189, temos, jci]

export const seedDescription = title => `Βοήθημα επιθεώρησης για το ${title}: ερωτήσεις διατυπωμένες με δικά μας λόγια, με αναφορά στο άρθρο ή το κεφάλαιο. Δεν αποτελεί το κείμενο του προτύπου, που παραμένει η πηγή αναφοράς. Επεξεργάσιμο: δημιουργήστε αντίγραφο για το νοσοκομείο σας και προσαρμόστε το.`

// A seed as a template with its questions in order.
export function templateFromSeed(seed) {
  let position = 0
  const questions = seed.chapters.flatMap(chapter => chapter.questions.map(([clauseRef, question, evidence, guidance, options]) => {
    position += 1
    return {
      id: `${seed.key}-${position}`,
      position,
      chapterRef: chapter.ref,
      chapterTitle: chapter.title,
      clauseRef,
      question,
      evidence: evidence || '',
      guidance: guidance || '',
      weight: options?.w || 1,
      critical: Boolean(options?.c),
      areas: options?.a || [],
    }
  }))
  return {
    id: `system-${seed.key}`,
    key: seed.key,
    standard: seed.standard,
    standardVersion: seed.version,
    title: seed.title,
    description: seedDescription(seed.title),
    scope: seed.scope,
    departmentTypes: seed.departmentTypes || [],
    active: true,
    isSystem: true,
    basedOn: null,
    version: 1,
    source: 'seed',
    questions,
  }
}

export const SYSTEM_TEMPLATES = QUESTIONNAIRE_SEEDS.map(templateFromSeed)
