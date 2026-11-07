import { describe, expect, it } from 'vitest'
import { isSurveillanceOrganism } from '../src/features/analysis/surveillanceOrganisms'

describe('the organisms of the reports: WHO priority pathogens and the national surveillance only', () => {
  it('keeps the surveillance organisms, whatever the spelling', () => {
    for (const name of ['Klebsiella pneumoniae', 'KLEBSIELLA PNEUMONIAE (KPC)', 'Acinetobacter baumannii', 'Pseudomonas aeruginosa', 'Escherichia coli', 'E. coli', 'Staphylococcus aureus', 'MRSA', 'Enterococcus faecium', 'Clostridioides difficile', 'Proteus mirabilis', 'Enterobacter cloacae']) {
      expect(isSurveillanceOrganism(name)).toBe(true)
    }
  })
  it('leaves out the rest', () => {
    for (const name of ['Staphylococcus epidermidis', 'Candida albicans', 'Corynebacterium', '', null, 'Pseudomonas putida']) {
      expect(isSurveillanceOrganism(name)).toBe(false)
    }
  })
})
