import { hospitalDate } from '../../../core/dates/hospitalDate'
import { isEmptyPreview } from '../../../core/preview/emptyPreview'

// The rounds of the Demo's self-assessments (owner, 9/11/2026: the whole of 2025 and 2026): the clinical departments
// answered the ward checklist in spring and autumn 2025 and in spring 2026 (submitted, then closed after the audit),
// and the second round of 2026 is under way (in progress, one not answered yet, one still a draft). Kept apart from
// the service, so the Demo dashboard counts the same rounds before the list has opened (no client, no questionnaire).
export const DEMO_SELF_DEPARTMENTS = ['ΜΕΘ', 'Παθολογική', 'Χειρουργική', 'Καρδιολογική', 'Ορθοπαιδική', 'Νεογνολογική / ΜΕΝΝ']
const isoDay = (days: number) => { const date = new Date(`${hospitalDate()}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10) }

// [round, title, released on, due on, departments, status of each, share answered when in progress, quality]
export type DemoSelfRound = [string, string, string, string, string[], (index: number) => string, number, number]
export function demoSelfRounds(): DemoSelfRound[] {
  const recent = isoDay(-12)
  return [
    ['2025a', 'Αυτοαξιολόγηση άνοιξης 2025', '2025-03-03', '2025-03-31', DEMO_SELF_DEPARTMENTS, () => 'closed', 1, 0.78],
    ['2025b', 'Αυτοαξιολόγηση φθινοπώρου 2025', '2025-10-01', '2025-10-31', DEMO_SELF_DEPARTMENTS.slice(0, 4), () => 'closed', 1, 0.84],
    ['2026a', 'Αυτοαξιολόγηση άνοιξης 2026', '2026-03-02', '2026-03-31', DEMO_SELF_DEPARTMENTS, index => (index < 4 ? 'closed' : 'submitted'), 1, 0.88],
    ['2026b', 'Αυτοαξιολόγηση Β΄ εξαμήνου 2026', recent, isoDay(18), DEMO_SELF_DEPARTMENTS.slice(0, 4), index => ['submitted', 'released', 'released', 'draft'][index], 0.55, 0.9],
  ]
}

// The department and status of each Demo self-assessment, as the seed makes them (none in the empty hospital).
export const demoSelfStatuses = (): { departmentName: string, status: string }[] => (isEmptyPreview() ? [] : demoSelfRounds().flatMap(([, , , , departments, statusOf]) => departments.map((departmentName, index) => ({ departmentName, status: statusOf(index) }))))
