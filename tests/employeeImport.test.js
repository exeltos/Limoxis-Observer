// @vitest-environment jsdom
import { describe,expect,it } from 'vitest'
import { parseCsv,parseXlsx } from '../src/core/import/spreadsheetImport'
import { mapHeaders,normalizeDate,planEmployeeImport } from '../src/features/employees/employeeImport'

// A minimal .xlsx: stored (uncompressed) zip entries.
function storedZip(files){
 const enc=new TextEncoder(),parts=[],central=[];let offset=0
 for(const [name,text] of Object.entries(files)){
  const n=enc.encode(name),d=enc.encode(text)
  const local=new DataView(new ArrayBuffer(30));local.setUint32(0,0x04034b50,true);local.setUint32(18,d.length,true);local.setUint32(22,d.length,true);local.setUint16(26,n.length,true)
  parts.push(new Uint8Array(local.buffer),n,d)
  const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint32(20,d.length,true);c.setUint32(24,d.length,true);c.setUint16(28,n.length,true);c.setUint32(42,offset,true)
  central.push(new Uint8Array(c.buffer),n)
  offset+=30+n.length+d.length
 }
 const size=central.reduce((s,p)=>s+p.length,0)
 const end=new DataView(new ArrayBuffer(22));end.setUint32(0,0x06054b50,true);end.setUint16(10,Object.keys(files).length,true);end.setUint32(12,size,true);end.setUint32(16,offset,true)
 const all=[...parts,...central,new Uint8Array(end.buffer)],out=new Uint8Array(all.reduce((s,p)=>s+p.length,0));let at=0
 for(const p of all){out.set(p,at);at+=p.length}
 return out.buffer
}

describe('spreadsheet import',()=>{
 it('reads Excel CSV with ; quotes and BOM',()=>{
  expect(parseCsv('﻿Κωδικός;Επώνυμο\r\n"1";"Παπα;δοπούλου ""Μ"""\r\n\r\n')).toEqual([['Κωδικός','Επώνυμο'],['1','Παπα;δοπούλου "Μ"']])
  expect(parseCsv('a,b\n1,2')).toEqual([['a','b'],['1','2']])
 })
 it('reads the first sheet of an xlsx with shared strings and gaps',async()=>{
  const buffer=storedZip({
   'xl/workbook.xml':'<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="A" r:id="rId1"/></sheets></workbook>',
   'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
   'xl/sharedStrings.xml':'<sst><si><t>Κωδικός</t></si><si><t>Όνομα</t></si><si><r><t>Μα</t></r><r><t>ρία</t></r></si></sst>',
   'xl/worksheets/sheet1.xml':'<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row><row r="2"><c r="A2"><v>1001</v></c><c r="C2" t="s"><v>2</v></c></row></sheetData></worksheet>',
  })
  expect(await parseXlsx(buffer)).toEqual([['Κωδικός','','Όνομα'],['1001','','Μαρία']])
 })
})

describe('employee import plan',()=>{
 const reference={departments:[{id:'d1',name:'ΜΕΘ',nameEn:'ICU'}],professions:[['Νοσηλευτικό προσωπικό','Nursing staff']],positions:[['Νοσηλευτής/τρια ΜΕΘ','ICU Nurse']]}
 const header=['Κωδικός','Επώνυμο','Ονομα','Τμήμα','Κατηγορία','Θέση','Ημερομηνία πρόσληψης']
 it('matches headers regardless of accents and aliases',()=>{
  expect(mapHeaders(header)).toMatchObject({code:0,lastName:1,firstName:2,department:3,profession:4,position:5,hireDate:6})
 })
 it('reads dates as ISO, day/month/year or Excel day numbers',()=>{
  expect(normalizeDate('2020-03-01')).toBe('2020-03-01')
  expect(normalizeDate('1/3/2020')).toBe('2020-03-01')
  expect(normalizeDate('43891')).toBe('2020-03-01')
  expect(normalizeDate('13/13/2020')).toBe(null)
 })
 it('plans new, existing and invalid rows',()=>{
  const rows=[header,
   ['1001','Παπαδοπούλου','Μαρία','μεθ','Nursing staff','ICU Nurse','01/03/2020'],
   ['EMP-001','Γεωργίου','Νίκος','ΜΕΘ','Νοσηλευτικό προσωπικό','',''],
   ['1002','Δήμου','','Καρδιολογική','Νοσηλευτικό προσωπικό','',''],
   ['1001','Άλλος','Ένας','ΜΕΘ','Νοσηλευτικό προσωπικό','','']]
  const existing=[{id:'EMP-001',dbId:'u1'}]
  const plan=planEmployeeImport(rows,{existing,...reference})
  expect(plan.items.map(i=>i.action)).toEqual(['create','skip','error','error'])
  expect(plan.items[0].value).toMatchObject({department:'ΜΕΘ',departmentId:'d1',profession:'Νοσηλευτικό προσωπικό',position:'Νοσηλευτής/τρια ΜΕΘ',hireDate:'2020-03-01',employmentStatus:'active'})
  expect(plan.items[2].errors.join(' ')).toMatch(/Όνομα.*Καρδιολογική|Καρδιολογική/)
  expect(plan.items[3].errors[0]).toMatch(/επαναλαμβάνεται/)
  expect(planEmployeeImport(rows,{existing,...reference,updateExisting:true}).counts).toEqual({create:1,update:1,skip:0,error:2})
 })
 it('reports missing required columns',()=>{
  expect(planEmployeeImport([['Κωδικός','Όνομα']],reference).missingColumns).toEqual(['Επώνυμο','Τμήμα','Επαγγελματική κατηγορία'])
 })
})
