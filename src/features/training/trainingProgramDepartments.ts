import type { TrainingProgram } from './trainingTypes'

type Person = { firstName?: string, lastName?: string, name?: string, department?: string }
// «Τμήμα» of a training programme in the list (owner, 18/11/2026): the department that organised or planned it.
// The organiser («Υπεύθυνος / διοργανωτής») is a department or service, kept as is; a person counts as their department.
export function programOrganizerMap(programs: TrainingProgram[] = [], employees: Person[] = []): Map<string, string> {
  const departmentOf = new Map<string, string>()
  for (const person of employees) {
    const department = String(person.department || '').trim()
    if (!department) continue
    for (const name of [`${person.firstName || ''} ${person.lastName || ''}`, `${person.lastName || ''} ${person.firstName || ''}`, person.name || '']) {
      const key = name.trim()
      if (key && !departmentOf.has(key)) departmentOf.set(key, department)
    }
  }
  const map = new Map<string, string>()
  for (const program of programs) {
    const owner = String(program.owner || '').trim()
    map.set(program.id, departmentOf.get(owner) || owner)
  }
  return map
}
