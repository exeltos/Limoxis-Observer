// The visit of the occupational physician: planned (date, type) or recorded as done, with the fitness outcome and
// the date of the next check.
export const EMPTY_OCCUPATIONAL_VISIT = { employeeId: '', date: '', type: 'periodic', status: 'scheduled', fitStatus: 'pending', followUpDate: '', clinicalNotes: '' }
// [value, Greek, English]
type Choice = [string, string, string]
export const VISIT_TYPES: Choice[] = [['periodic', 'Περιοδική εξέταση', 'Periodic examination'], ['followUp', 'Επανέλεγχος', 'Follow-up'], ['vaccinationReview', 'Έλεγχος εμβολιασμού', 'Vaccination review']]
export const VISIT_STATUSES: Choice[] = [['scheduled', 'Προγραμματισμένη', 'Scheduled'], ['completed', 'Ολοκληρώθηκε', 'Completed']]
export const FITNESS: Choice[] = [['fit', 'Κατάλληλος', 'Fit'], ['fit_with_restrictions', 'Κατάλληλος με περιορισμούς', 'Fit with restrictions'], ['unfit', 'Μη κατάλληλος', 'Unfit'], ['pending', 'Εκκρεμεί', 'Pending']]
const pick = (list: Choice[], value: string | null | undefined, language: string) => { const row = list.find(([key]) => key === value); return row ? row[language === 'en' ? 2 : 1] : (value || '—') }
export const visitTypeLabel = (value: string | null | undefined, language = 'el') => pick(VISIT_TYPES, value, language)
export const visitStatusLabel = (value: string | null | undefined, language = 'el') => pick(VISIT_STATUSES, value, language)
export const fitnessLabel = (value: string | null | undefined, language = 'el') => pick(FITNESS, value, language)
export const visitSavedMessage = (language: string) => (language === 'en' ? 'Visit saved.' : 'Η επίσκεψη αποθηκεύτηκε.')

export function visitProblems(draft: Partial<typeof EMPTY_OCCUPATIONAL_VISIT>, language = 'el') {
  const en = language === 'en', out: string[] = []
  if (!draft.employeeId) out.push(en ? 'the employee' : 'τον εργαζόμενο')
  if (!draft.date) out.push(en ? 'the date' : 'την ημερομηνία')
  if (draft.status === 'completed' && !draft.fitStatus) out.push(en ? 'the fitness' : 'την καταλληλότητα')
  return out
}
