// The antimicrobial therapy dialog: empty rows, and which antibiotics are
// restricted (advanced) and must go to stewardship approval.

export function newTherapyRow(today = new Date()) {
  return { antimicrobial: '', dose: '', route: 'IV', indication: '', startedAt: today.toISOString().slice(0, 10), plannedEndAt: '', approvalStatus: 'not_required' }
}

// Library rows are [greekName, englishName, meta]; a restricted antibiotic is
// recognised by either name, since the dialog stores the name shown to the user.
export function advancedAntibioticNames(libraryRows = []) {
  return new Set(libraryRows.flatMap(row => [row[0], row[1]]))
}

// The rows to save: those with an antibiotic chosen, each flagged for
// stewardship when the antibiotic is restricted.
export function therapiesToSave(rows = [], advancedNames = new Set()) {
  return rows
    .filter(row => row.antimicrobial)
    .map(row => {
      const advanced = advancedNames.has(row.antimicrobial)
      return { ...row, isAdvancedAntibiotic: advanced, stewardshipLinked: advanced }
    })
}
