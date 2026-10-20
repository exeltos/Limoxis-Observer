import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { filterControlRows } from '../src/features/controls/controlFilters'

const page = fs.readFileSync('src/features/controls/ControlsPage.jsx', 'utf8')
const record = fs.readFileSync('src/features/controls/ControlRecordPage.jsx', 'utf8')
const editor = fs.readFileSync('src/features/controls/ControlEditor.jsx', 'utf8')
const expiry = fs.readFileSync('src/features/controls/ControlExpiryPanel.jsx', 'utf8')

const row = (id, extra = {}) => ({
  item: { id, title: id, category: 'Θερμοκρασίες', frequency: { kind: 'weekly', interval: 1 }, responseConfig: { criticality: 'high' }, ...extra },
  departments: ['ΜΕΘ'],
})

describe('controls list: three cards, two filters (Ο7)', () => {
  it('shows only the cards that ask for action, and the adherence card opens no tab', () => {
    const strip = page.slice(page.indexOf('<div className="module-summary-strip">'), page.indexOf('<CanonicalTabs'))
    expect((strip.match(/<Kpi /g) || []).length).toBe(3)
    expect(strip.indexOf('label={tx.overdue}')).toBeLessThan(strip.indexOf('label={tx.dueSoon}'))
    expect(strip.indexOf('label={tx.dueSoon}')).toBeLessThan(strip.indexOf('tx.adherence'))
    const adherenceCard = strip.slice(strip.indexOf('<Kpi loading={firstLoad} icon={Gauge}'))
    expect(adherenceCard).not.toContain('onClick')
  })

  it('keeps only the department and status filters', () => {
    const bar = page.slice(page.indexOf('<FilterBar'), page.indexOf('</FilterBar>'))
    expect((bar.match(/<FilterSelect /g) || []).length).toBe(2)
    expect(bar).toContain('label={tx.department}')
    expect(bar).toContain('label={tx.status}')
    expect(page).toContain('registry.loadViewState({query:')
    expect(page).toContain("registry.saveViewState({query,department,status,view})")
  })

  it('finds frequency, type and criticality through the search box, in both languages', () => {
    const rows = [row('A'), row('B', { frequency: { kind: 'daily', timesPerDay: 1, times: ['09:00'] }, responseConfig: { criticality: 'low' }, category: 'Καθαριότητα' })]
    const ids = (query) => filterControlRows(rows, { query }).map((r) => r.item.id)
    expect(ids('εβδομαδιαία')).toEqual(['A'])
    expect(ids('weekly')).toEqual(['A'])
    expect(ids('καθημερινά')).toEqual(['B'])
    expect(ids('υψηλή')).toEqual(['A'])
    expect(ids('καθαριότητα')).toEqual(['B'])
  })
})

describe('one place per action (Ο6)', () => {
  it('has no «Στο ημερολόγιο» button; the calendar link keeps working', () => {
    expect(page).not.toContain('toCalendar')
    expect(page).toContain("get('tab')==='calendar'")
  })

  it('records from the header only for one department, otherwise only from the department rows', () => {
    expect(record).toContain('{canExecute&&visibleDepartments.length===1&&<ActionButton')
    expect(record).toContain('{allowed&&assignments.length>1&&<ActionButton')
  })

  it('has one export per tab: the expiry panel hands its form to the page menu', () => {
    expect(expiry).toContain('{!onExportChange&&<ExportMenu')
    expect(page).toContain('onExportChange={setExpiryExport}')
    expect(record).toContain('onExportChange={setExpiryExport}')
  })

  it('leaves «Δημιουργία» as the only create button of an empty list', () => {
    expect(page).not.toContain('emptyAction=')
    expect(page).toContain('πατήστε «Δημιουργία» πάνω δεξιά')
  })

  it('saves from the form footer only', () => {
    expect(editor).not.toContain('headerActions=')
    expect((editor.match(/<SaveButton /g) || []).length).toBe(1)
    expect(editor).toContain('<div className="inline-edit-footer control-editor-footer">')
  })
})

describe('control record page (Ο5)', () => {
  it('shows the values as a DetailList on the card, without a second title or frame', () => {
    expect(record).toContain("import { DetailList } from '../../design-system/DetailList'")
    expect(record).not.toContain('RecordDetailsGrid')
    expect(record).not.toContain('RecordTabPanel')
    expect(record).not.toContain("<SectionHeader title={en?'Control details'")
    expect(record).not.toContain("title={en?'Executions':'Εκτελέσεις'} subtitle")
  })

  it('has one «…» menu per execution row, with the print inside it', () => {
    expect(record).toContain("id:'print'")
    expect(record).not.toContain('<ExportMenu compact')
    expect((record.match(/<OverflowMenu items=\{historyActions\(h\)\}/g) || []).length).toBe(1)
  })
})

describe('new control form (Ο8)', () => {
  it('folds the optional parts in a collapsed «Προχωρημένα» section', () => {
    const advanced = editor.indexOf('<MoreSection')
    expect(advanced).toBeGreaterThan(0)
    expect(editor).toContain("defaultOpen={advancedOpenAtStart||advancedForced}")
    expect(editor).toContain("moreLabel={en?'Advanced':'Προχωρημένα'}")
    expect(editor.indexOf("How it is recorded")).toBeGreaterThan(advanced)
    expect(editor.indexOf("Actions on deviation")).toBeGreaterThan(advanced)
    expect(editor.indexOf("What is checked")).toBeLessThan(advanced)
    expect(editor.indexOf("en?'Schedule':'Προγραμματισμός'")).toBeLessThan(advanced)
    expect(editor.indexOf('inline-edit-footer control-editor-footer')).toBeGreaterThan(editor.indexOf('</MoreSection>'))
  })

  it('opens the section by itself when a checklist or choice list is still missing', () => {
    expect(editor).toContain("const advancedMissing=")
    expect(editor).toContain('if(advancedMissing)setAdvancedForced(true)')
  })
})
