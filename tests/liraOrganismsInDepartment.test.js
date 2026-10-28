import {describe,expect,it} from 'vitest'
import {answerCompact,evidenceSummary} from '../src/features/lira/LiraAssistantLauncher'

const today=new Date().toISOString().slice(0,10)
const lab=(id,department,organism)=>({id,resultId:id,department,organism,result:'positive',patient:`P-${id}`,date:today,resultedAt:today})
const data={laboratory:[lab('1','ΜΕΘ','Klebsiella pneumoniae'),lab('2','ΜΕΘ','Klebsiella pneumoniae'),lab('3','ΜΕΘ','Acinetobacter baumannii'),lab('4','Παθολογική','Escherichia coli')],surveillance:[],handHygiene:[],bundles:[],qualityIncidents:[],qualityCapas:[]}

describe('LIRA: organisms in a department',()=>{
 it('answers «Μικρόβια στη ΜΕΘ» with the organisms recorded there, not the generic assessment',()=>{
  const answer=answerCompact('Μικρόβια στη ΜΕΘ',data,'el')
  expect(answer.generic).toBeFalsy()
  expect(answer.points).toEqual(['Klebsiella pneumoniae: 2 εγγραφές','Acinetobacter baumannii: 1 εγγραφές'])
 })
 it('names evidence by source and count, without record ids',()=>{
  const text=evidenceSummary([{source:'surveillance_cases',id:'a'},{source:'surveillance_cases',id:'b'},{source:'quality_incidents',id:'c'},{source:'hai_classifications'}],false)
  expect(text).toBe('Περιστατικά επιτήρησης (2) · Συμβάντα ποιότητας (1) · Ταξινομήσεις ΛΣΦΥ')
  expect(text).not.toMatch(/#/)
 })
})
