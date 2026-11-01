// Συνεντεύξεις › γνώμη ανά ρόλο: the opinions of the Γραφείο Προσωπικού and of the competent
// division on a candidate, how they compare, and the divisions of a hospital.
export const STANCES = [
  ['propose', 'Προτείνω', 'Propose', 'success'],
  ['approve', 'Εγκρίνω', 'Approve', 'success'],
  ['reserve', 'Επιφύλαξη', 'Reserve', 'warning'],
  ['reject', 'Απορρίπτω', 'Reject', 'danger'],
]
export const stanceLabel = (stance, language = 'el') => { const row = STANCES.find(([key]) => key === stance); return row ? row[language === 'en' ? 2 : 1] : '—' }
export const stanceTone = stance => STANCES.find(([key]) => key === stance)?.[3] || 'neutral'

// «For» (propose / approve), «reserve» and «against» (reject): two submitted opinions in
// different groups are a disagreement, which the final decision must explain.
const stanceGroup = stance => (stance === 'propose' || stance === 'approve' ? 'for' : stance === 'reserve' ? 'reserve' : 'against')
export function hasDisagreement(opinions = []) {
  return new Set(opinions.filter(item => item.stance && item.submittedAt).map(item => stanceGroup(item.stance))).size > 1
}

export function opinionProblems(draft, language = 'el') {
  const en = language === 'en'
  return draft.stance ? [] : [en ? 'Choose your opinion.' : 'Επιλέξτε τη γνώμη σας.']
}

export const roleKindLabel = (kind, division, language = 'el') => {
  if (kind === 'division') return division || (language === 'en' ? 'Division' : 'Διεύθυνση')
  return language === 'en' ? 'HR Office' : 'Γραφείο Προσωπικού'
}

// The fields of a candidate that a Division Director reads (the server sends no more).
export const DIVISION_CANDIDATE_FIELDS = ['id', 'code', 'fullName', 'requestedPosition', 'professionalCategory', 'employmentType', 'educationLevel', 'education', 'itSkills', 'whyUs', 'status', 'appliedOn', 'decision', 'languages', 'employers', 'interviews']

// The professional categories offered in the application: those already mapped to a
// division and those already used by an application.
export function categoriesOf(candidates = [], divisions = []) {
  const set = new Set()
  for (const division of divisions) for (const category of division.categories || []) set.add(category)
  for (const item of candidates) if (item.professionalCategory) set.add(item.professionalCategory)
  return [...set].sort((a, b) => a.localeCompare(b, 'el'))
}
// The division a category belongs to (null when none).
export const divisionOfCategory = (category, divisions = []) => divisions.find(item => (item.categories || []).includes(category)) || null
