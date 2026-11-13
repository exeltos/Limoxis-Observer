import { describe, it, expect } from 'vitest'
import { advancedAntibioticNames, newTherapyRow, therapiesToSave } from '../src/features/surveillance/therapyEntries'

const advanced = advancedAntibioticNames([['Μεροπενέμη', 'Meropenem', { id: 'ABX-MEM' }], ['Κολιστίνη', 'Colistin']])

describe('therapy dialog entries', () => {
  it('a new row starts today, intravenous, without approval', () => {
    expect(newTherapyRow(new Date('2026-10-10T08:00:00Z'))).toEqual({ antimicrobial: '', dose: '', route: 'IV', indication: '', startedAt: '2026-10-10', plannedEndAt: '', approvalStatus: 'not_required' })
  })

  it('flags a restricted antibiotic for stewardship by its Greek or English name', () => {
    const saved = therapiesToSave([{ antimicrobial: 'Meropenem' }, { antimicrobial: 'Κολιστίνη' }, { antimicrobial: 'Amoxicillin' }], advanced)
    expect(saved.map(x => [x.antimicrobial, x.isAdvancedAntibiotic, x.stewardshipLinked])).toEqual([
      ['Meropenem', true, true],
      ['Κολιστίνη', true, true],
      ['Amoxicillin', false, false],
    ])
  })

  it('skips rows without an antibiotic and keeps the rest of each row', () => {
    const saved = therapiesToSave([{ antimicrobial: '', dose: '1g' }, { antimicrobial: 'Amoxicillin', dose: '1g', route: 'PO' }], advanced)
    expect(saved).toEqual([{ antimicrobial: 'Amoxicillin', dose: '1g', route: 'PO', isAdvancedAntibiotic: false, stewardshipLinked: false }])
  })
})
