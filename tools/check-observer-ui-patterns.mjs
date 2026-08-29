import fs from 'node:fs'
import path from 'node:path'

const root=path.resolve('src')
const files=[]
function walk(dir){for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);const stat=fs.statSync(p);if(stat.isDirectory())walk(p);else if(/\.jsx?$/.test(name))files.push(p)}}
walk(root)
const violations=[]
for(const file of files){
  const text=fs.readFileSync(file,'utf8')
  const rel=path.relative(root,file)
  if(file.includes(`${path.sep}features${path.sep}`)&&/>\s*(Εκτύπωση|Εξαγωγή|Print|Export)(?:\s+[^<]*)?</i.test(text))violations.push(`${rel}: visible Print/Export action detected; Observer uses icon-only utility actions`)
  if(file.includes(`${path.sep}committees${path.sep}`)&&/(committee-dialog|committee-form-grid)/.test(text))violations.push(`${rel}: legacy committee-only form shell detected; use Observer shared form language`)
  if(file.includes(`${path.sep}features${path.sep}`)&&/<input[^>]+type=["'](?:date|time)["']/i.test(text))violations.push(`${rel}: native date/time field detected in feature UI; use ManualDateField / TimeField`)
  if(file.includes(`${path.sep}features${path.sep}`)&&/RecordPage\.jsx$/.test(file)&&text.includes('<EntityRecordShell')&&!text.includes('PrintExportActions'))violations.push(`${rel}: record header does not use shared PrintExportActions`)
  if(file.includes(`${path.sep}features${path.sep}`)&&text.includes('<RecordActions')&&text.includes('UI_ACTIONS.PRINT')&&!text.includes('UI_ACTIONS.EXPORT'))violations.push(`${rel}: registry/page has Print without the canonical Export utility action`)
}
const recordActions=fs.readFileSync(path.join(root,'design-system','RecordActions.jsx'),'utf8')
if(!recordActions.includes("action===UI_ACTIONS.PRINT||action===UI_ACTIONS.EXPORT"))violations.push('design-system/RecordActions.jsx: Print/Export are not centrally forced to compact icon actions')
if(!recordActions.includes("export:{icon:Download"))violations.push('design-system/RecordActions.jsx: Export must use the canonical Download icon')
const printExport=path.join(root,'design-system','PrintExportActions.jsx')
if(!fs.existsSync(printExport))violations.push('design-system/PrintExportActions.jsx: missing shared record utility action component')
if(violations.length){console.error('Observer UI pattern audit failed:\n- '+violations.join('\n- '));process.exit(1)}
console.log('Observer UI pattern audit: OK')
