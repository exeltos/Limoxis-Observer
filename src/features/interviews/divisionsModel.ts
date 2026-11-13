import type { Candidate } from './interviewsTypes'

// Συνεντεύξεις › διευθύνσεις: a division is made of categories from the fixed list of professional categories
// (PROFESSIONAL_CATEGORIES); its director sees the candidates of those categories, professional data and CV only.

// The fields of a candidate that a Division Director reads (the server sends no more).
export const DIVISION_CANDIDATE_FIELDS: (keyof Candidate)[] = ['id', 'code', 'fullName', 'requestedPosition', 'professionalCategory', 'employmentType', 'educationLevel', 'education', 'itSkills', 'whyUs', 'status', 'appliedOn', 'decision', 'languages', 'employers', 'interviews']
