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
  if(file.includes(`${path.sep}features${path.sep}`)&&/RecordPage\.jsx$/.test(file)&&text.includes('<EntityRecordShell')&&!text.includes('<ExportMenu'))violations.push(`${rel}: record page has no «Εξαγωγή» control (ExportMenu)`)
  // A record's export sits in the header utility area (headerActions), never in a card's «…» menu slot.
  if(text.includes('<EntityRecordShell')&&/menu=\{<>[^\n]*?<ExportMenu/.test(text))violations.push(`${rel}: «Εξαγωγή» inside a card menu; put it in the record header (headerActions)`)
  // One export control: print / download / «Λήψη» buttons and menu items live only in ExportMenu.
  if(file.includes(`${path.sep}features${path.sep}`)&&file.endsWith('.jsx')){
    const standalone=[/<(Printer|Download|FileDown)\b/,/icon\s*:\s*(Printer|Download|FileDown)\b/,/\bid\s*:\s*'(print|pdf|download|export|word|csv)'/,/<(Button|IconButton|ActionButton|button)\b[^>]*\b(label|aria-label|title)=\{[^}]{0,60}'(Λήψη|Εκτύπωση|Εξαγωγή|Download|Print|Export)\b/]
    const hit=standalone.find(pattern=>pattern.test(text))
    if(hit)violations.push(`${rel}: standalone print / download / export control (${hit}); use ExportMenu («Εξαγωγή ▾»)`)
  }
  if(file.includes(`${path.sep}features${path.sep}`)&&text.includes('<RecordActions')&&text.includes('UI_ACTIONS.PRINT')&&!text.includes('UI_ACTIONS.EXPORT'))violations.push(`${rel}: registry/page has Print without the canonical Export utility action`)
}
// Shared form controls: a feature's lists use SearchableSelect / MultiSelect /
// FilterSelect, its yes-no and multi-choice fields YesNoField / ModeSwitch /
const RAW_CONTROL_CEILINGS={kitchen:{select:0,checkbox:0,datalist:0},controls:{select:0,checkbox:0,datalist:0},surveillance:{select:0,checkbox:0,datalist:0},patients:{select:0,checkbox:0,datalist:0},laboratory:{select:0,checkbox:0,datalist:0},prevention:{select:0,checkbox:0,datalist:0},quality:{select:0,checkbox:0,datalist:0},registers:{select:0,checkbox:0,datalist:0},documents:{select:0,checkbox:0,datalist:0},indicators:{select:0,checkbox:0,datalist:0},employees:{select:0,checkbox:0,datalist:0},calendar:{select:0,checkbox:0,datalist:0},training:{select:5,checkbox:8,datalist:1},committees:{select:14,checkbox:2,datalist:2}}
for(const [module,ceiling] of Object.entries(RAW_CONTROL_CEILINGS)){
  const sources=files.filter(file=>file.includes(`${path.sep}features${path.sep}${module}${path.sep}`)&&file.endsWith('.jsx')).map(file=>fs.readFileSync(file,'utf8'))
  const count=pattern=>sources.reduce((n,text)=>n+(text.match(pattern)||[]).length,0)
  const found={select:count(/<select\b/g),checkbox:count(/type=["']checkbox["']/g),datalist:count(/<datalist\b/g)}
  for(const [kind,max] of Object.entries(ceiling))if(found[kind]>max)violations.push(`features/${module}: ${found[kind]} raw <${kind}> (ceiling ${max}); use the shared design-system field instead`)
}
// A choice of three or more values is one house select (SearchableSelect /
// FilterSelect), never a row of buttons: a ModeSwitch with 3+ written options
// in a feature is flagged (a few older ones are held to a ceiling).
const MODE_SWITCH_CEILINGS={prevention:1}
const modeSwitchCount={}
for(const file of files.filter(file=>file.includes(`${path.sep}features${path.sep}`)&&file.endsWith('.jsx'))){
  const text=fs.readFileSync(file,'utf8')
  const re=/<ModeSwitch\b/g;let m
  while((m=re.exec(text))){
    let depth=0,j=m.index
    for(;j<text.length;j++){const c=text[j];if(c==='{')depth++;else if(c==='}')depth--;else if(c==='>'&&depth===0)break}
    if((text.slice(m.index,j).match(/\{\s*value\s*:/g)||[]).length>=3){const module=path.relative(path.join(root,'features'),file).split(path.sep)[0];modeSwitchCount[module]=(modeSwitchCount[module]||0)+1}
  }
}
for(const [module,count] of Object.entries(modeSwitchCount))if(count>(MODE_SWITCH_CEILINGS[module]||0))violations.push(`features/${module}: ${count} ModeSwitch with 3+ options (ceiling ${MODE_SWITCH_CEILINGS[module]||0}); use the house select (SearchableSelect / FilterSelect)`)
const recordActions=fs.readFileSync(path.join(root,'design-system','RecordActions.jsx'),'utf8')
if(!recordActions.includes('action===UI_ACTIONS.PRINT||action===UI_ACTIONS.EXPORT')||!recordActions.includes('<ExportMenu'))violations.push('design-system/RecordActions.jsx: Print / Export must go through the one export control (ExportMenu)')
if(!fs.existsSync(path.join(root,'design-system','ExportMenu.jsx')))violations.push('design-system/ExportMenu.jsx: missing the shared «Εξαγωγή» control')
if(violations.length){console.error('Observer UI pattern audit failed:\n- '+violations.join('\n- '));process.exit(1)}
console.log('Observer UI pattern audit: OK')
