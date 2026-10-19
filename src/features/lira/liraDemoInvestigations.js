// The Demo hospital's outbreak investigations, as the Analysis "LIRA & AI" tab
// counts them (production reads lira_outbreak_investigations). Written in the
// Demo's authored frame and shifted to today like the other Demo fixtures.
import { emptyInPreview } from '../../core/preview/emptyPreview'
import { shiftDemoDatesInPlace } from '../../core/data/demoClock'

const rows = [
  ['LIRA-INV-01', 'Klebsiella pneumoniae (KPC)', 'active', '2026-08-18T09:20:00Z', null],
  ['LIRA-INV-02', 'Acinetobacter baumannii', 'closed', '2026-06-30T10:05:00Z', '2026-07-21T15:40:00Z'],
  ['LIRA-INV-03', 'Clostridioides difficile', 'closed', '2026-05-12T08:45:00Z', '2026-05-29T12:10:00Z'],
  ['LIRA-INV-04', 'Pseudomonas aeruginosa', 'closed', '2026-03-03T11:30:00Z', '2026-03-24T09:00:00Z'],
  ['LIRA-INV-05', 'MRSA', 'closed', '2026-01-19T13:15:00Z', '2026-02-06T10:30:00Z'],
  ['LIRA-INV-06', 'Norovirus', 'closed', '2025-12-08T07:50:00Z', '2025-12-19T16:20:00Z'],
  ['LIRA-INV-07', 'Enterococcus faecium (VRE)', 'closed', '2025-10-27T09:40:00Z', '2025-11-20T14:00:00Z'],
  ['LIRA-INV-08', 'Klebsiella pneumoniae (KPC)', 'draft', '2026-08-26T16:10:00Z', null],
]

export const liraDemoInvestigations = shiftDemoDatesInPlace(
  rows.map(([id, organism, status, created_at, closed_at]) => ({ id, organism, status, created_at, closed_at })),
)
// Empty-hospital preview (?helpEmpty=1): no sample records.
emptyInPreview(liraDemoInvestigations)
