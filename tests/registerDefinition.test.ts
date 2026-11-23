import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'
import { definitionChanges } from '../src/features/registers/registerEngine'
import type { Register } from '../src/features/registers/registerTypes'

// The definition of a register (owner, 23/11/2026): its parts right under the record's tabs on one surface, rows with a «⋯»
// at their right, a field or an indicator edited in a centred card, a preview of the entry form, and the save bar only
// when there are changes, with their count.
const saved = {
  id: 'r1', name: 'ΜΕΘ', status: 'active', kind: 'case',
  fields: [{ key: 'a', type: 'date', label: 'Α' }, { key: 'b', type: 'number', label: 'Β' }, { key: 'c', type: 'yesNo', label: 'Γ' }],
  indicators: [{ id: 'n', title: 'Ν', aggregation: 'count' }],
  settings: { sections: [{ key: 's1', label: 'Σ1' }], entryDateField: 'a' },
  sheet: {},
} as unknown as Register

describe('changes of a register definition', () => {
  it('counts none for the same definition, also with an empty list of breakdowns or keys in another order', () => {
    expect(definitionChanges(saved, structuredClone(saved))).toBe(0)
    const same = structuredClone(saved)
    same.settings = { entryDateField: 'a', sections: [{ label: 'Σ1', key: 's1' }], breakdowns: [] }
    expect(definitionChanges(saved, same)).toBe(0)
  })
  it('counts each change: the name, a changed field, a new indicator, the order and a setting', () => {
    const draft = structuredClone(saved)
    draft.name = 'ΜΕΘ 2'
    draft.fields[1] = { ...draft.fields[1], required: true }
    draft.indicators.push({ id: 'm', title: 'Μ', aggregation: 'mean' })
    expect(definitionChanges(saved, draft)).toBe(3)
    draft.fields = [draft.fields[2], draft.fields[0], draft.fields[1]]
    draft.settings = { ...draft.settings, entryDateField: '' }
    expect(definitionChanges(saved, draft)).toBe(5)
  })
  it('counts a field withdrawn as one change', () => {
    const draft = structuredClone(saved)
    draft.fields = draft.fields.filter(field => field.key !== 'b')
    expect(definitionChanges(saved, draft)).toBe(1)
  })
})

describe('the definition screen', () => {
  const source = readSource('src/features/registers/RegisterBuilder.tsx')
  it('has no card of its own above the parts and shows the save bar only with changes, with their count', () => {
    expect(source).not.toContain("title={en ? 'Definition' : 'Ορισμός'}")
    expect(source).toContain('{canEdit && dirty && <div className="inline-edit-footer register-def-savebar">')
    expect(source).toContain("`Αποθήκευση · ${changes} ${changes === 1 ? 'αλλαγή' : 'αλλαγές'}`")
  })
  it('puts the row actions in a «⋯» at the right of each row, with a handle and a keyboard way to reorder', () => {
    expect(source).not.toMatch(/<IconButton size="sm" label=\{en \? 'Up' : 'Πάνω'\}/)
    expect(source).toContain('className="register-def-menu-cell"><OverflowMenu')
    expect(source).toContain("label: en ? 'Move to section' : 'Μετακίνηση σε ενότητα'")
    expect(source).toContain("label: en ? 'Move up' : 'Μετακίνηση πάνω'")
    expect(source).toContain('className="register-def-grip" draggable')
  })
  it('edits in a centred card, previews the entry form with the same controls, and shows the indicator value live', () => {
    expect(source).toContain('<ObserverDialog width={compact ? \'compact\' : \'wide\'}')
    expect(source).toContain("import { RegisterField as RegisterFieldControl } from './RegisterEntryPage'")
    expect(source).toContain('valueOf(register, shown, entries, period)')
  })
})
