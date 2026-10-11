// @vitest-environment jsdom
// Behavior of the prevention antiseptic and waste editors and of the antiseptic
// cloud service. Replaces source-text assertions (antisepticHospitalScope,
// preventionWasteBlankDefaults, preventionWasteSaveAndLayout) that pinned the
// formatting of these files instead of what they do.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../src/core/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'nurse@example.org' }, profile: { id: 'user-1', fullName: 'Test Nurse', email: 'nurse@example.org' } }),
}))

let queries
let respond
function builder(table) {
  const query = { table, op: 'select', payload: null, filters: [] }
  queries.push(query)
  const chain = {
    select() { return chain },
    insert(payload) { query.op = 'insert'; query.payload = payload; return chain },
    update(payload) { query.op = 'update'; query.payload = payload; return chain },
    delete() { query.op = 'delete'; return chain },
    eq(column, value) { query.filters.push(['eq', column, value]); return chain },
    order() { return chain },
    single() { query.single = true; return chain },
    then(resolve, reject) { return Promise.resolve(respond(query)).then(resolve, reject) },
  }
  return chain
}
vi.mock('../src/core/supabase/client', () => ({
  supabase: { from: table => builder(table), auth: { getUser: async () => ({ data: { user: { id: 'actor-1' } }, error: null }) } },
}))

const { LanguageProvider, loadLanguage } = await import('../src/core/i18n/LanguageContext')
const { AntisepticEntryEditor, HOSPITAL_SCOPE } = await import('../src/features/prevention/AntisepticEntryEditor')
const { WasteEntryEditor } = await import('../src/features/prevention/WasteEntryEditor')
const service = await import('../src/features/prevention/antisepticCloudService')

const departments = [{ id: 'dep-1', el: 'Παθολογική', en: 'Internal Medicine' }, { id: 'dep-2', el: 'Χειρουργική', en: 'Surgery' }]
const products = [{ id: 'prod-1', el: 'Αλκοολούχο αντισηπτικό', en: 'Alcohol hand rub', code: 'ANT-ABHR', metadata: { is_abhr: true } }, { id: 'prod-2', el: 'Χλωρεξιδίνη', en: 'Chlorhexidine', code: 'ANT-CHX', metadata: {} }]
const wasteTypes = [{ id: 'wt-1', el: 'ΕΑΑΜ', en: 'Hazardous infectious' }, { id: 'wt-2', el: 'Αστικά', en: 'Municipal' }]

const wrap = node => <LanguageProvider>{node}</LanguageProvider>
const fieldSelect = labelText => screen.getByText(labelText).closest('label').querySelector('select')
const fieldInput = labelText => screen.getByText(labelText).closest('label').querySelector('input')
const button = name => screen.getByRole('button', { name })

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

// Rule A1: the antiseptic scope choice offers an explicit whole-hospital scope
// (HOSPITAL_SCOPE) next to departments, and choosing it saves departmentScope
// 'hospital'; choosing a department saves departmentScope 'department'.
describe('antiseptic editor: whole-hospital scope', () => {
  it('lists the whole-hospital scope alongside the departments (Greek and English)', async () => {
    expect(HOSPITAL_SCOPE).toBe('__hospital__')
    const { unmount } = render(wrap(<AntisepticEntryEditor departments={departments} products={products} onSave={vi.fn()} onCancel={vi.fn()}/>))
    const options = [...fieldSelect('Εύρος / Τμήμα *').options].map(o => [o.value, o.textContent])
    expect(options).toEqual([['', 'Επιλέξτε εύρος'], [HOSPITAL_SCOPE, 'Όλο το νοσοκομείο'], ['Παθολογική', 'Παθολογική'], ['Χειρουργική', 'Χειρουργική']])
    unmount()

    await loadLanguage('en')
    window.localStorage.setItem('limoxis.language', 'en')
    render(wrap(<AntisepticEntryEditor departments={departments} products={products} onSave={vi.fn()} onCancel={vi.fn()}/>))
    const hospital = [...fieldSelect('Scope / department *').options].find(o => o.value === HOSPITAL_SCOPE)
    expect(hospital.textContent).toBe('Whole hospital')
  })

  it('saves a whole-hospital record with departmentScope hospital', async () => {
    const onSave = vi.fn()
    render(wrap(<AntisepticEntryEditor departments={departments} products={products} onSave={onSave} onCancel={vi.fn()}/>))
    fireEvent.change(fieldSelect('Εύρος / Τμήμα *'), { target: { value: HOSPITAL_SCOPE } })
    await act(async () => { fireEvent.click(button('Αποθήκευση κατανάλωσης')) })
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toMatchObject({ departmentScope: 'hospital', departmentEl: 'Όλο το νοσοκομείο', departmentEn: 'Whole hospital' })
  })

  it('saves a department record with departmentScope department', async () => {
    const onSave = vi.fn()
    render(wrap(<AntisepticEntryEditor departments={departments} products={products} onSave={onSave} onCancel={vi.fn()}/>))
    fireEvent.change(fieldSelect('Εύρος / Τμήμα *'), { target: { value: 'Χειρουργική' } })
    await act(async () => { fireEvent.click(button('Αποθήκευση κατανάλωσης')) })
    expect(onSave.mock.calls[0][0]).toMatchObject({ departmentScope: 'department', departmentEl: 'Χειρουργική', departmentEn: 'Surgery' })
  })
})

// Rule A2: when products arrive after the first render the first product is
// selected so Save can enable; Save is not held disabled just because support
// arrays were empty; Save needs period, scope/department and product.
describe('antiseptic editor: product hydration and save readiness', () => {
  it('selects the first product once support data arrives and then enables Save', async () => {
    const onSave = vi.fn()
    const props = { departments: [], products: [], onSave, onCancel: vi.fn() }
    const { rerender } = render(wrap(<AntisepticEntryEditor {...props}/>))
    fireEvent.change(fieldSelect('Εύρος / Τμήμα *'), { target: { value: HOSPITAL_SCOPE } })
    expect(button('Αποθήκευση κατανάλωσης').disabled).toBe(true)

    rerender(wrap(<AntisepticEntryEditor {...props} products={products}/>))
    expect(fieldSelect('Προϊόν *').value).toBe('prod-1')
    // departments are still empty: the whole-hospital scope alone is enough
    expect(button('Αποθήκευση κατανάλωσης').disabled).toBe(false)
    await act(async () => { fireEvent.click(button('Αποθήκευση κατανάλωσης')) })
    expect(onSave.mock.calls[0][0]).toMatchObject({ antisepticItemId: 'prod-1', product: 'Αλκοολούχο αντισηπτικό', departmentScope: 'hospital' })
  })

  it('keeps Save disabled without a product', () => {
    render(wrap(<AntisepticEntryEditor departments={departments} products={[]} onSave={vi.fn()} onCancel={vi.fn()}/>))
    fireEvent.change(fieldSelect('Εύρος / Τμήμα *'), { target: { value: 'Παθολογική' } })
    expect(fieldSelect('Προϊόν *').value).toBe('')
    expect(button('Αποθήκευση κατανάλωσης').disabled).toBe(true)
  })

  it('enables Save only with period and department once a product is selected', () => {
    render(wrap(<AntisepticEntryEditor departments={departments} products={products} onSave={vi.fn()} onCancel={vi.fn()}/>))
    const save = button('Αποθήκευση κατανάλωσης')
    expect(save.disabled).toBe(true) // no department yet
    fireEvent.change(fieldSelect('Εύρος / Τμήμα *'), { target: { value: 'Παθολογική' } })
    expect(save.disabled).toBe(false)
    fireEvent.change(fieldSelect('Εύρος / Τμήμα *'), { target: { value: '' } })
    expect(save.disabled).toBe(true)
    fireEvent.change(fieldSelect('Εύρος / Τμήμα *'), { target: { value: 'Παθολογική' } })
    fireEvent.change(fieldSelect('Προϊόν *'), { target: { value: 'prod-2' } })
    expect(save.disabled).toBe(false)
    fireEvent.change(fieldInput('Μήνας αναφοράς *'), { target: { value: '' } })
    expect(save.disabled).toBe(true)
  })
})

// Rule B: a whole-hospital antiseptic record is stored with department_id null;
// hospital-wide patient-days use the hospital-total row (department_id null)
// and, when there is none, the sum of the department rows.
describe('antiseptic cloud service: hospital scope', () => {
  let patientDayRows
  beforeEach(() => {
    queries = []
    patientDayRows = []
    respond = query => {
      if (query.table === 'departments') return { data: [{ id: 'dep-1', name: 'Παθολογική' }], error: null }
      if (query.table === 'master_library_items') return { data: [{ id: 'prod-1', name_el: 'Αλκοολούχο', name_en: 'Hand rub', code: 'ANT-ABHR', metadata: { is_abhr: true } }], error: null }
      if (query.table === 'patient_day_periods') return { data: patientDayRows, error: null }
      if (query.op === 'insert') return { data: { id: 'ant-new', ...query.payload }, error: null }
      return { data: [], error: null }
    }
  })
  const inserts = () => queries.filter(q => q.table === 'antiseptic_consumption_periods' && q.op === 'insert')

  it('stores a whole-hospital record with a null department', async () => {
    await service.saveAntisepticRecord('org-1', { departmentScope: 'hospital', departmentEl: 'Όλο το νοσοκομείο', antisepticItemId: 'prod-1', period: '2026-08', litres: 3, method: 'pharmacy_issue' })
    const [insert] = inserts()
    expect(insert.payload).toMatchObject({ organization_id: 'org-1', department_id: null, antiseptic_item_id: 'prod-1', period_start: '2026-08-01', period_end: '2026-08-31', created_by: 'actor-1' })
  })

  it('stores a department record with its department id', async () => {
    await service.saveAntisepticRecord('org-1', { departmentScope: 'department', departmentEl: 'Παθολογική', antisepticItemId: 'prod-1', period: '2026-08', litres: 3 })
    expect(inserts()[0].payload.department_id).toBe('dep-1')
  })

  it('sums department rows when there is no hospital-total row', async () => {
    patientDayRows = [{ department_id: 'dep-1', patient_days: 300 }, { department_id: 'dep-2', patient_days: '150' }]
    await expect(service.findPatientDaysForPeriod('org-1', null, '2026-08-01', '2026-08-31')).resolves.toBe(450)
    const [query] = queries.filter(q => q.table === 'patient_day_periods')
    expect(query.filters).toEqual(expect.arrayContaining([['eq', 'organization_id', 'org-1'], ['eq', 'period_start', '2026-08-01'], ['eq', 'period_end', '2026-08-31'], ['eq', 'review_status', 'approved']]))
    expect(query.filters.some(([, column]) => column === 'department_id')).toBe(false)
  })

  it('prefers the hospital-total row when one exists', async () => {
    patientDayRows = [{ department_id: 'dep-1', patient_days: 300 }, { department_id: null, patient_days: 1000 }]
    await expect(service.findPatientDaysForPeriod('org-1', null, '2026-08-01', '2026-08-31')).resolves.toBe(1000)
  })

  it('returns null for hospital scope when no rows exist', async () => {
    await expect(service.findPatientDaysForPeriod('org-1', null, '2026-08-01', '2026-08-31')).resolves.toBeNull()
  })
})

const WASTE_SAVE = 'Αποθήκευση μέτρησης'
function fillWastePeriod(container, start = '2026-08-01', end = '2026-08-31') {
  const [startInput, endInput] = container.querySelectorAll('input.manual-date-native')
  fireEvent.change(startInput, { target: { value: start } })
  fireEvent.change(endInput, { target: { value: end } })
}

// Rule C1: a new waste record starts with blank dates and no department, and an
// empty department is not auto-filled when departments arrive later.
describe('waste editor: blank defaults for a new record', () => {
  it('does not preselect the period dates or the department', () => {
    const { container } = render(wrap(<WasteEntryEditor departments={departments} wasteTypes={wasteTypes} onSave={vi.fn()} onCancel={vi.fn()}/>))
    const select = fieldSelect('Τμήμα *')
    expect(select.value).toBe('')
    expect(select.options[0]).toMatchObject({ value: '', textContent: 'Επιλέξτε τμήμα' })
    for (const input of container.querySelectorAll('.waste-date-field input')) expect(input.value).toBe('')
  })

  it('shows the English empty department option', async () => {
    await loadLanguage('en')
    window.localStorage.setItem('limoxis.language', 'en')
    render(wrap(<WasteEntryEditor departments={departments} wasteTypes={wasteTypes} onSave={vi.fn()} onCancel={vi.fn()}/>))
    const select = fieldSelect('Department *')
    expect(select.value).toBe('')
    expect(select.options[0].textContent).toBe('Select department')
  })

  it('leaves the department empty when departments arrive after the first render', () => {
    const props = { departments: [], wasteTypes: [], onSave: vi.fn(), onCancel: vi.fn() }
    const { rerender } = render(wrap(<WasteEntryEditor {...props}/>))
    rerender(wrap(<WasteEntryEditor {...props} departments={departments} wasteTypes={wasteTypes}/>))
    expect(fieldSelect('Τμήμα *').value).toBe('')
    expect(button(WASTE_SAVE).disabled).toBe(true)
  })
})

// Rule C2: the waste type is hydrated from the first waste type when support
// data arrives after the first render.
describe('waste editor: waste type hydration', () => {
  it('selects the first waste type once support data arrives and saves it', async () => {
    const onSave = vi.fn()
    const props = { departments: [], wasteTypes: [], onSave, onCancel: vi.fn() }
    const { container, rerender } = render(wrap(<WasteEntryEditor {...props}/>))
    rerender(wrap(<WasteEntryEditor {...props} departments={departments} wasteTypes={wasteTypes}/>))
    expect(fieldSelect('Κατηγορία αποβλήτου *').value).toBe('wt-1')
    fillWastePeriod(container)
    fireEvent.change(fieldSelect('Τμήμα *'), { target: { value: 'Παθολογική' } })
    fireEvent.change(fieldInput('Συνολικό βάρος περιόδου (kg) *'), { target: { value: '12.5' } })
    fireEvent.change(fieldInput('Περιέκτες'), { target: { value: '3' } })
    await act(async () => { fireEvent.click(button(WASTE_SAVE)) })
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toMatchObject({ wasteTypeId: 'wt-1', wasteType: 'ΕΑΑΜ', type: 'ΕΑΑΜ', typeEn: 'Hazardous infectious', departmentEl: 'Παθολογική', weight: 12.5, containers: 3, periodStart: '2026-08-01', periodEnd: '2026-08-31' })
  })
})

// Rule C3: Save enables once period, department, waste type, weight > 0 and
// containers >= 0 are given, and is not blocked because support arrays were
// empty on the first render (or the department list is empty for a fixed department).
describe('waste editor: save readiness', () => {
  it('enables Save only when every required field is valid', () => {
    const { container } = render(wrap(<WasteEntryEditor departments={departments} wasteTypes={wasteTypes} onSave={vi.fn()} onCancel={vi.fn()}/>))
    const save = button(WASTE_SAVE)
    fillWastePeriod(container)
    fireEvent.change(fieldInput('Περιέκτες'), { target: { value: '0' } })
    fireEvent.change(fieldInput('Συνολικό βάρος περιόδου (kg) *'), { target: { value: '4' } })
    expect(save.disabled).toBe(true) // no department
    fireEvent.change(fieldSelect('Τμήμα *'), { target: { value: 'Χειρουργική' } })
    expect(save.disabled).toBe(false)
    fireEvent.change(fieldInput('Συνολικό βάρος περιόδου (kg) *'), { target: { value: '0' } })
    expect(save.disabled).toBe(true) // no weight
    fireEvent.change(fieldInput('Συνολικό βάρος περιόδου (kg) *'), { target: { value: '4' } })
    expect(save.disabled).toBe(false)
    fireEvent.change(fieldInput('Περιέκτες'), { target: { value: '-1' } })
    expect(save.disabled).toBe(true)
    fireEvent.change(fieldInput('Περιέκτες'), { target: { value: '2' } })
    fillWastePeriod(container, '2026-08-31', '2026-08-01')
    expect(save.disabled).toBe(true) // end before start
    fillWastePeriod(container)
    expect(save.disabled).toBe(false)
  })

  it('is not blocked by an empty department list when the department is fixed', () => {
    const props = { departments: [], wasteTypes: [], fixedDepartment: 'Παθολογική', onSave: vi.fn(), onCancel: vi.fn() }
    const { container, rerender } = render(wrap(<WasteEntryEditor {...props}/>))
    rerender(wrap(<WasteEntryEditor {...props} wasteTypes={wasteTypes}/>))
    fillWastePeriod(container)
    fireEvent.change(fieldInput('Συνολικό βάρος περιόδου (kg) *'), { target: { value: '4' } })
    fireEvent.change(fieldInput('Περιέκτες'), { target: { value: '1' } })
    expect(button(WASTE_SAVE).disabled).toBe(false)
  })
})

// Rule A2 (fixed department variant): antiseptic Save is not held disabled by
// an empty department list when the department is fixed.
describe('antiseptic editor: fixed department with empty department list', () => {
  it('enables Save once products arrive', () => {
    const props = { departments: [], products: [], fixedDepartment: 'Παθολογική', onSave: vi.fn(), onCancel: vi.fn() }
    const { rerender } = render(wrap(<AntisepticEntryEditor {...props}/>))
    expect(button('Αποθήκευση κατανάλωσης').disabled).toBe(true)
    rerender(wrap(<AntisepticEntryEditor {...props} products={products}/>))
    expect(button('Αποθήκευση κατανάλωσης').disabled).toBe(false)
  })
})
