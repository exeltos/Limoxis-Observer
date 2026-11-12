// The sample Demo's departments for a role preview, by the name its records
// carry (the label key names them in the interface language). A department-
// scoped role without a chosen department is in the ICU, as the database
// places a Demo evaluator (demo_switch_my_role).
export const SAMPLE_PREVIEW_DEPARTMENTS = Object.freeze([['', 'previewAllHospital'], ['ΜΕΘ', 'previewIcu'], ['Χειρουργική', 'previewSurgery'], ['Παθολογική', 'previewInternalMedicine']])
export const SAMPLE_DEFAULT_DEPARTMENT = 'ΜΕΘ'
// The sample Demo's divisions (the interviews' sample divisions) and the departments
// each covers, by name: a previewed Division Director oversees these. Without a
// chosen division the preview is in the first one.
export const SAMPLE_DIVISION_DEPARTMENTS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'demo-div-1': Object.freeze(['ΜΕΘ', 'Παθολογική', 'Χειρουργική', 'Καρδιολογική', 'Ορθοπαιδική', 'Παιδιατρική', 'ΜΕΝΝ', 'Νεφρολογική']),
  'demo-div-2': Object.freeze(['Κουζίνα', 'Αποστείρωση', 'Τεχνική Υπηρεσία']),
})
export const SAMPLE_DEFAULT_DIVISION = 'demo-div-1'
