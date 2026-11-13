import { describe, expect, it } from 'vitest'
import { readAnalysisPageSource } from './helpers/analysisPageSource'
import { readSource } from './helpers/readSource'
const analysis=readAnalysisPageSource()
const service=readSource('src/features/platform/platformService.js')
describe('Production analytics parity with demo information architecture',()=>{
  it('keeps the same national-surveillance concepts in production',()=>{expect(analysis).toContain("tx('Μικροοργανισμοί ανά τμήμα','Organisms by department')");expect(analysis).toContain("tx('Είδος δείγματος','Specimen type')");expect(analysis).toContain("tx('Τάση θετικών αποτελεσμάτων','Positive-results trend')")})
  it('joins microbiology results to sample and department context',()=>{expect(service).toContain("rpc('analysis_microbiology_findings'");expect(service).toContain("from('departments')");expect(service).toContain('nationalRows');expect(service).toContain('byDepartment');expect(service).toContain('bySource');expect(service).toContain('bySite')})
})
