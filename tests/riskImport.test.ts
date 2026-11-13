import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
import {correctWording,importPlan,normalizeProcess,parseRiskWorkbook,readWorkbook} from '../src/features/quality/risk/riskImport'

// A synthetic workbook in the Ε.Δ.ΔΙΑΧ.090 layout (two risk sheets and one of
// opportunities), with the kinds of typed mistakes the import must correct.
const load=async(name='riskAssessmentSample')=>{const buf=fs.readFileSync(`tests/fixtures/${name}.xlsx`);return readWorkbook(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength))}

describe('risk assessment Excel import',()=>{
 it('reads the sheets of an .xlsx file without a library',async()=>{
  const sheets=await load()
  expect(sheets.map(s=>s.name)).toEqual(['Ιατρονοσηλευτικά','Γενικές Κατηγορίες','Αξιολόγηση Ευκαιριών'])
  expect(sheets[0].rows[11][2]).toBe('Εμφάνιση Ενδονοσοκομειακής Λοίμωξης')
  expect(sheets[0].rows[11][7]).toBe('1.Τήρηση πρωτοκόλλων\n2.Εκπαίδευση')
 })
 it('takes the risks of both sections, the opportunities and the header',async()=>{
  const result=parseRiskWorkbook(await load())
  expect(result.meta).toEqual({formCode:'Ε.Δ.ΔΙΑΧ.090',title:'ΕΚΤΙΜΗΣΗ ΕΠΙΚΙΝΔΥΝΟΤΗΤΑΣ (ΚΛΙΝΙΚΗΣ ΚΑΙ ΜΗ)',assessedOn:'2026-04-01',nextReviewOn:'2027-04-01',assessor:'Διεύθυνση Ποιότητας'})
  expect(result.sheets).toEqual([{name:'Ιατρονοσηλευτικά',section:'clinical',count:3},{name:'Γενικές Κατηγορίες',section:'general',count:1},{name:'Αξιολόγηση Ευκαιριών',section:'opportunities',count:1}])
  expect(result.risks.map(r=>[r.lineageKey,r.section,r.inherentL,r.inherentC,r.residualL,r.residualC])).toEqual([['R001','clinical',4,5,3,5],['R002','clinical',3,4,2,4],['R003','clinical',1,5,1,5],['R004','general',2,5,1,5]])
  expect(result.opportunities[0]).toMatchObject({activity:'Πιστοποίηση ISO',rating:'Υψηλή Απόδοση',owner:'Ποιότητα'})
 })
 it('drops «Δ/Α», unifies process names and suggests the JCI goal',async()=>{
  const [first,second,third]=parseRiskWorkbook(await load()).risks
  expect(second.additionalMeasures).toBe('');expect(second.owner).toBe('')
  expect([first.process,second.process,third.process]).toEqual(['ΑΣΦΑΛΕΙΑ ΑΣΘΕΝΩΝ','ΑΣΦΑΛΕΙΑ ΑΣΘΕΝΩΝ','ΔΙΑΧΕΙΡΙΣΗ ΝΟΜΟΘΕΤΙΚΩΝ ΑΠΑΙΤΗΣΕΩΝ'])
  expect([first.jci,second.jci]).toEqual(['IPSG.5','IPSG.1'])
 })
 it('recomputes typed scores and levels and lists every correction',async()=>{
  const {fixes}=parseRiskWorkbook(await load())
  // 3×4 typed as 15; 2×4 typed as 4 and «Μέτριος»; 1×5 typed «Χαμηλός» (it is 5 → Moderate).
  expect(fixes).toEqual(expect.arrayContaining([
   {lineageKey:'R002',field:'inherentScore',before:15,after:12},
   {lineageKey:'R002',field:'residualScore',before:4,after:8},
   {lineageKey:'R002',field:'residualLevel',before:'Μ-Μέτριος Κίνδυνος',after:'high'},
   {lineageKey:'R003',field:'inherentLevel',before:'Χ-Χαμηλός Κίνδυνος',after:'moderate'},
   {lineageKey:'R001',field:'process',before:'ΑΣΦΑΛΕΙΑ ΑΣΘΕΝΗ',after:'ΑΣΦΑΛΕΙΑ ΑΣΘΕΝΩΝ'},
  ]))
  // 3×4=12 typed «Υψηλός» is right: no correction for it.
  expect(fixes.filter(f=>f.lineageKey==='R002'&&f.field==='inherentLevel')).toHaveLength(0)
 })
 it('rejects a file that is not a workbook',async()=>{
  await expect(readWorkbook(new TextEncoder().encode('not a zip').buffer)).rejects.toThrow('SPREADSHEET_NOT_XLSX')
 })
 it('normalizes the spelling of a process',()=>{
  expect(normalizeProcess(' ΤΑΥΤΟΠΟΙΗΣΗ  ΑΣΘΕΝΗ ')).toBe('ΤΑΥΤΟΠΟΙΗΣΗ ΑΣΘΕΝΩΝ')
  expect(normalizeProcess('ΑΣΦΑΛΕΙΑ ΝΕΟΓΝΟΥ')).toBe('ΑΣΦΑΛΕΙΑ ΝΕΟΓΝΟΥ')
 })
 it('corrects misspelt words, not parts of words',()=>{
  expect(correctWording('1.Τήρηση Εσωτερικού Κανονισνμού\n2.Εκπάιδευση')).toBe('1.Τήρηση Εσωτερικού Κανονισμού\n2.Εκπαίδευση')
  expect(correctWording('ΑνεκπάιδευσηΧ')).toBe('ΑνεκπάιδευσηΧ')
 })
})

// A synthetic workbook in the Ε.Δ.QUAL.050-02 layout: every risk is scored for
// the initial assessment and again for the reassessment, in extra columns.
describe('risk assessment Excel import with a reassessment',()=>{
 it('reads two periods of the same risks, oldest first',async()=>{
  const result=parseRiskWorkbook(await load('riskAssessmentReassessment'))
  expect(result.meta).toEqual({formCode:'Ε.Δ.QUAL.050-02',title:'ΕΚΤΙΜΗΣΗ ΚΛΙΝΙΚΗΣ ΚΑΙ ΜΗ ΕΠΙΚΙΝΔΥΝΟΤΗΤΑΣ',assessedOn:'2026-04-01',nextReviewOn:'2027-02-01',assessor:'Διεύθυνση Ποιότητας'})
  expect(result.periods.map(p=>[p.key,p.year,p.risks.length])).toEqual([['initial',2024,3],['reassessment',2025,3]])
  const pick=p=>p.risks.map(r=>[r.lineageKey,r.inherentL,r.inherentC,r.residualL,r.residualC])
  expect(pick(result.periods[0])).toEqual([['R001',2,4,1,4],['R002',3,4,2,4],['R003',2,5,1,5]])
  expect(pick(result.periods[1])).toEqual([['R001',2,4,1,4],['R002',2,4,1,4],['R003',1,5,1,5]])
  expect(result.risks).toBe(result.periods[1].risks)
  expect(result.sheets).toEqual([{name:'Ιατρονοσηλευτικά',section:'clinical',count:2},{name:'Γενικές Κατηγορίες',section:'general',count:1},{name:'Αξιολόγηση Ευκαιριών',section:'opportunities',count:2}])
 })
 it('corrects the typed scores of each period and the wording',async()=>{
  const [initial,again]=parseRiskWorkbook(await load('riskAssessmentReassessment')).periods
  // 2×4 typed as 16 in the initial period; right (8) in the reassessment.
  expect(initial.fixes).toContainEqual({lineageKey:'R001',field:'inherentScore',before:16,after:8})
  expect(again.fixes.filter(f=>f.lineageKey==='R001'&&f.field==='inherentScore')).toHaveLength(0)
  // 2×5=10 typed «Υψηλός» is right in the initial period; 1×5=5 typed «Μέτριος» is right too.
  expect(initial.fixes.filter(f=>f.lineageKey==='R003'&&/Level$/.test(f.field))).toHaveLength(0)
  expect(again.fixes).toContainEqual({lineageKey:'R001',field:'process',before:'ΑΣΦΑΛΕΙΑ ΑΣΘΕΝΩΝ ΚΑΤΆ ΤΗ ΕΙΣΑΓΩΓΗ',after:'ΑΣΦΑΛΕΙΑ ΑΣΘΕΝΩΝ ΚΑΤΑ ΤΗΝ ΕΙΣΑΓΩΓΗ'})
  const [r1,r2,r3]=again.risks
  expect([r1.existingControls,r2.existingControls,r3.existingControls]).toEqual(['1.Τήρηση Εσωτερικού Κανονισμού','Εκπαίδευση προσωπικού','Διαθεσιμότητα Πυροσβεστήρων'])
  expect(again.fixes.filter(f=>f.field==='wording').map(f=>[f.lineageKey,f.before,f.after])).toEqual([['R001','Κανονισνμού','Κανονισμού'],['R002','Εκπάιδευση','Εκπαίδευση'],['R003','Πυροσβετήρων','Πυροσβεστήρων']])
 })
 it('plans one assessment per period, the latest with the opportunities',async()=>{
  const parsed=parseRiskWorkbook(await load('riskAssessmentReassessment'))
  const plan=importPlan(parsed,{title:'Εκτίμηση',periodLabel:'2026',assessedOn:'2026-04-01',nextReviewOn:'2027-02-01'},{initialOn:'2024-04-01'})
  expect(plan.map(p=>[p.header.periodLabel,p.header.assessedOn,p.header.nextReviewOn,p.risks.length,p.opportunities.length])).toEqual([['2024','2024-04-01','2026-04-01',3,0],['2026','2026-04-01','2027-02-01',3,2]])
 })
})
