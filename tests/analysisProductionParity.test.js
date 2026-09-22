import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
const analysis=fs.readFileSync('src/features/analysis/AnalysisPage.jsx','utf8')
const service=fs.readFileSync('src/features/platform/platformService.js','utf8')
describe('Production analytics parity with demo information architecture',()=>{
  it('keeps the same national-surveillance concepts in production',()=>{expect(analysis).toContain("tx('Κατανομή ανά τμήμα','Distribution by department')");expect(analysis).toContain("tx('Σημείο λοίμωξης','Infection site')");expect(analysis).toContain("tx('Τάση θετικών αποτελεσμάτων','Positive-results trend')")})
  it('joins microbiology results to sample and department context',()=>{expect(service).toContain("rpc('analysis_microbiology_findings'");expect(service).toContain("from('departments')");expect(service).toContain('nationalRows');expect(service).toContain('byDepartment');expect(service).toContain('bySource');expect(service).toContain('bySite')})
})
