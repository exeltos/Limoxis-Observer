// Who a person in the staff register is (employees.staff_category): an employee of the hospital, a collaborating
// physician or an external collaborator. Collaborators can be chosen in committees, meetings and the like, but
// they are not counted as hospital staff (active staff, training coverage, staff screening, vaccination).
export const STAFF_CATEGORIES = [
  { value: 'employee', el: 'Εργαζόμενος', en: 'Employee' },
  { value: 'physician', el: 'Ιατρός συνεργάτης', en: 'Collaborating physician' },
  { value: 'external', el: 'Εξωτερικός συνεργάτης', en: 'External collaborator' },
]

export const staffCategoryOf = person => (STAFF_CATEGORIES.some(item => item.value === person?.staffCategory) ? person.staffCategory : 'employee')
export const isStaffEmployee = person => staffCategoryOf(person) === 'employee'
export const staffCategoryLabel = (value, language = 'el') => {
  const item = STAFF_CATEGORIES.find(entry => entry.value === value) || STAFF_CATEGORIES[0]
  return language === 'en' ? item.en : item.el
}
