// Import of a risk assessment spreadsheet (Ε.Δ.ΔΙΑΧ.090, Ε.Δ.QUAL.050-02):
//   risk sheets   ΔΙΕΡΓΑΣΙΑ | Τμήμα/Αφορά | Πιθανό Ρίσκο | L | C | Αποτέλεσμα | Κατηγορία |
//                 Προληπτικά μέτρα | L | C | Αποτέλεσμα | Κατηγορία | Πρόσθετα μέτρα |
//                 Υπεύθυνος | Συχνότητα ελέγχου | Δείκτης / κωδικός συμβάντος
//   opportunities ΔΡΑΣΤΗΡΙΟΤΗΤΑ | ΕΥΚΑΙΡΙΕΣ | Χαρακτηρισμός | Σχέδια δράσης | Χρόνος | Υπεύθυνος | Αποτελεσματικότητα
// Columns are found by their header, so a sheet may also carry a second set of
// L / Αποτέλεσμα / Κατηγορία columns marked «ΕΠΑΝΑΞΙΟΛΟΓΗΣΗ»: the file then
// holds two periods (initial and reassessment) of the same risks, and each
// becomes its own assessment with the same lineage keys.
// Scores and levels are recomputed from L and C; every typed result or level
// that disagrees, every process name that was unified and every misspelling
// corrected is listed in `fixes` so the user sees what changed before importing.
import { readWorkbookSheets } from '../../../core/import/spreadsheetImport'
import { levelForScore, riskScore, suggestJci } from './riskModel'

// Every sheet of the workbook, rows kept in place (row n is rows[n-1]).
export const readWorkbook=readWorkbookSheets

const clean=value=>{if(value==null)return '';return String(value).replace(/\r/g,'').split('\n').map(line=>line.replace(/[ \t]+/g,' ').trim()).join('\n').replace(/\n{3,}/g,'\n\n').trim()}
const notApplicable=value=>{const s=clean(value);return /^(δ\s*\/\s*α\.?|-)$/i.test(s)?'':s}
const num=value=>{const n=typeof value==='number'?value:Number(String(value??'').trim().replace(',','.'));return Number.isFinite(n)?n:null}
const isAxis=value=>{const n=num(value);return Number.isInteger(n)&&n>=1&&n<=5}
const fold=value=>clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
function excelDate(value){
 const n=num(value);if(n&&n>20000&&n<80000){const d=new Date(Date.UTC(1899,11,30)+n*86400000);return d.toISOString().slice(0,10)}
 const m=String(value||'').match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
 const iso=String(value||'').match(/\d{4}-\d{2}-\d{2}/);return iso?iso[0]:null
}
const LEVEL_FROM_TEXT=[[/^πυ|πολυ/,'very_high'],[/^υ|υψηλ/,'high'],[/^μ|μετρ/,'moderate'],[/^χ|χαμηλ/,'low']]
const typedLevel=text=>{const t=fold(text);return (LEVEL_FROM_TEXT.find(([p])=>p.test(t))||[])[1]||''}

// The same process written three ways (ΑΣΘΕΝΗ / ΑΣΘΕΝΟΥΣ / ΑΣΘΕΝΩΝ) is one process.
const PROCESS_ALIASES=[[/^ασφαλεια ασθεν(η|ους|ων)$/,'ΑΣΦΑΛΕΙΑ ΑΣΘΕΝΩΝ'],[/^ταυτοποιηση ασθεν(η|ους|ων)$/,'ΤΑΥΤΟΠΟΙΗΣΗ ΑΣΘΕΝΩΝ']]
export function normalizeProcess(value){
 const text=clean(value).replace(/\s+/g,' ');const f=fold(text)
 const alias=PROCESS_ALIASES.find(([p])=>p.test(f));if(alias)return alias[1]
 return text===text.toLowerCase()||/[a-zα-ω]/.test(text)?text.toLocaleUpperCase('el-GR').normalize('NFD').replace(/[\u0300-\u036f]/g,''):text
}

function findLabel(sheets,pattern){
 for(const sheet of sheets)for(const row of sheet.rows)for(let i=0;i<row.length;i++)if(row[i]!=null&&pattern.test(fold(row[i]))){const next=row.slice(i+1).find(v=>v!=null&&String(v).trim());if(next!=null)return next}
 return null
}

// Misspellings found in the registers; corrected word by word on import.
const WORDING=[
 ['Κανονισνμού','Κανονισμού'],['Μεσσαία','Μέτρια'],['Απεικονηστικά','Απεικονιστικά'],['ΑΠΕΙΚΟΝΗΣΤΙΚΩΝ','ΑΠΕΙΚΟΝΙΣΤΙΚΩΝ'],['Πλυμμήρας','Πλημμύρας'],
 ['εξόφλιση','εξόφληση'],['κρίσημου','κρίσιμου'],['Ευρωπαικά','Ευρωπαϊκά'],['Χημειοθεραπέιες','Χημειοθεραπείες'],['Νακρωτικών','Ναρκωτικών'],
 ['Αναθέωρηση','Αναθεώρηση'],['Ασθενιύς','Ασθενούς'],['Ασφλαλειας','Ασφάλειας'],['Βιοίατρικού','Βιοϊατρικού'],['Διαχυτη','Διάχυτη'],
 ['Εκπάιδευση','Εκπαίδευση'],['εκπάιδευση','εκπαίδευση'],['Εξάθρωση','Εξάρθρωση'],['Κατευντήριων','Κατευθυντήριων'],['Κλειστα','Κλειστά'],
 ['Λυθοτριψίας','Λιθοτριψίας'],['Παρακολύθηση','Παρακολούθηση'],['Προεχγειρητικό','Προεγχειρητικό'],['Πρωτοκολλου','Πρωτοκόλλου'],
 ['Πυροσβετήρων','Πυροσβεστήρων'],['Πυροσβετικής','Πυροσβεστικής'],['Ρηξη','Ρήξη'],['Συμβαμάτων','Συμβάντων'],['Υγειηνής','Υγιεινής'],
 ['αδιεούχο','αδειούχο'],['ασθενεις','ασθενείς'],['αυτσηρή','αυστηρή'],['εμβρυουλκιία','εμβρυουλκία'],['συκιουλκία','σικυουλκία'],
 ['περινεου','περινέου'],['προσωοικού','προσωπικού'],['προφωρικές','προφορικές'],['φαρμεκυτικών','φαρμακευτικών'],['κλιμακα','κλίμακα'],
 ['Πυρινική','Πυρηνική'],['γλύστριμα','γλίστρημα'],['ύπαρξη ιολογικού','ύπαρξη βιολογικού'],['ασαφής ιατρικές','ασαφείς ιατρικές'],
 ['ΚΑΤΆ ΤΗ ΕΙΣΑΓΩΓΗ','ΚΑΤΑ ΤΗΝ ΕΙΣΑΓΩΓΗ'],['Διαδικασίας; Συμβάντων','Διαδικασίας Συμβάντων'],
]
const LETTER='A-Za-zͰ-Ͽἀ-῿'
const WORDING_RULES=WORDING.map(([wrong,right])=>[new RegExp(`(^|[^${LETTER}])${wrong.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=$|[^${LETTER}])`,'g'),right])
// The corrected text and the words that were changed, once each.
export function wordingChanges(value){
 let text=String(value??'');const changes=[]
 WORDING_RULES.forEach(([rule,right],i)=>{rule.lastIndex=0;if(rule.test(text)){changes.push([WORDING[i][0],right]);rule.lastIndex=0;text=text.replace(rule,(_,lead)=>lead+right)}})
 return {text,changes}
}
export const correctWording=value=>wordingChanges(value).text

// Header columns of a risk sheet. L / C / result / level columns are inherent
// before the «Προληπτικά μέτρα» column and residual after it; a header with
// «ΕΠΑΝΑΞΙΟΛΟΓΗΣΗ» (any spelling) belongs to the reassessment.
const REASSESS=/επ[αε]ναξ/
function sheetColumns(header){
 const find=pattern=>header.findIndex(v=>v!=null&&pattern.test(fold(v)))
 const process=find(/^διεργασια/),scope=find(/τμημα|αφορα/),hazard=find(/πιθανο ρισκο|κινδυνος/),controls=find(/^προληπτικα μετρα/)
 const measures=find(/προσθετα μετρα/),owner=find(/^υπευθυνος/),frequency=find(/^συχνοτητα/),indicator=find(/^δεικτης/)
 const scores={inherent:{},residual:{}},years={initial:[],reassessment:[]}
 header.forEach((v,i)=>{
  const t=fold(v);const kind=/^πιθανοτητα/.test(t)?'l':/κλιμακα|συνεπεια/.test(t)?'c':/^αποτελεσμα/.test(t)?'result':/^κατηγορια/.test(t)?'level':null
  if(!kind||i<=hazard)return
  // A second column of the same kind is the reassessment even when its header
  // only carries the year («Πιθανότητα (L) 2025»).
  const phase=controls>=0&&i>controls?'residual':'inherent',slot=(scores[phase][kind]||={})
  const period=REASSESS.test(t)||slot.initial!=null?'reassessment':'initial'
  if(slot[period]!=null)return
  slot[period]=i
  const year=Number(t.match(/\b(20\d\d)\b/)?.[1]);if(year)years[period].push(year)
 })
 const twoPeriods=Object.values(scores).some(phase=>Object.values(phase).some(slot=>slot.reassessment!=null))
 return {process,scope,hazard,controls,measures,owner,frequency,indicator,scores,twoPeriods,years}
}

function readRisk(row,cols,period,lineageKey,section){
 const at=i=>i>=0?row[i]:null
 const col=(phase,kind)=>{const slot=cols.scores[phase][kind]||{};return slot[period]??slot.initial??-1}
 const words=[]
 const text=(field,value)=>{const {text:fixed,changes}=wordingChanges(clean(value));for(const [before,after] of changes)words.push({lineageKey,field:'wording',before,after});return fixed}
 const L0=at(col('inherent','l')),C0=at(col('inherent','c'))
 if(!isAxis(L0)||!isAxis(C0)||!clean(at(cols.hazard)))return null
 const rawProcess=clean(at(cols.process)),process=normalizeProcess(correctWording(rawProcess)),hazard=text('hazard',at(cols.hazard))
 const L1=at(col('residual','l')),C1=at(col('residual','c'))
 const risk={lineageKey,section,process,scope:text('scope',at(cols.scope)),hazard,inherentL:num(L0),inherentC:num(C0),existingControls:text('existingControls',at(cols.controls)),
  residualL:isAxis(L1)?num(L1):null,residualC:isAxis(C1)?num(C1):null,additionalMeasures:notApplicable(text('additionalMeasures',at(cols.measures))),owner:notApplicable(text('owner',at(cols.owner))),
  reviewFrequency:text('reviewFrequency',at(cols.frequency)),indicator:clean(at(cols.indicator)),targetL:null,targetC:null,jci:suggestJci(hazard,process),jciReference:'',prioritized:false,notes:'',consequenceRationale:'',dueDate:null}
 const fixes=[]
 if(process!==rawProcess.replace(/\s+/g,' '))fixes.push({lineageKey,field:'process',before:rawProcess,after:process})
 fixes.push(...words)
 for(const kind of ['inherent','residual']){
  const score=riskScore(risk[`${kind}L`],risk[`${kind}C`]);if(!score)continue
  const typed=num(at(col(kind,'result')));if(typed!=null&&typed!==score)fixes.push({lineageKey,field:`${kind}Score`,before:typed,after:score})
  const level=at(col(kind,'level')),typedL=typedLevel(level),actual=levelForScore(score);if(typedL&&typedL!==actual)fixes.push({lineageKey,field:`${kind}Level`,before:clean(level),after:actual})
 }
 return {risk,fixes}
}

// The result: `periods` holds one entry per period found (oldest first), each
// with its risks and fixes; `risks` / `fixes` are those of the latest period.
export function parseRiskWorkbook(sheets){
 const riskSheets=[],opportunities=[],used=[]
 for(const sheet of sheets){
  const headerIndex=sheet.rows.findIndex(row=>row.some(v=>/^διεργασια/.test(fold(v)))&&row.some(v=>/πιθανο ρισκο|κινδυνος/.test(fold(v))))
  if(headerIndex>=0){riskSheets.push({sheet,cols:sheetColumns(sheet.rows[headerIndex]),rows:sheet.rows.slice(headerIndex+1),section:/γενικ/.test(fold(sheet.name))?'general':'clinical'});continue}
  const oppHeader=sheet.rows.findIndex(row=>row.some(v=>/^δραστηριοτητα/.test(fold(v)))&&row.some(v=>/ευκαιρ/.test(fold(v))))
  if(oppHeader>=0){
   const base=sheet.rows[oppHeader].findIndex(v=>/^δραστηριοτητα/.test(fold(v)))
   const before=opportunities.length
   for(const row of sheet.rows.slice(oppHeader+1)){const cell=k=>correctWording(clean(row[base+k]));if(!cell(0))continue;opportunities.push({activity:cell(0),opportunity:cell(1),rating:cell(2),actionPlan:cell(3),timeframe:cell(4),owner:cell(5),effectiveness:cell(6)})}
   if(opportunities.length>before)used.push({name:sheet.name,section:'opportunities',count:opportunities.length-before})
  }
 }
 const twoPeriods=riskSheets.some(s=>s.cols.twoPeriods)
 const periodKeys=twoPeriods?['initial','reassessment']:['initial']
 // One lineage key per row, shared by the periods: a risk added at the
 // reassessment («Νέος Κίνδυνος» in the initial columns) gets the next key and
 // appears in that period only.
 const periods=periodKeys.map(key=>({key,risks:[],fixes:[]}))
 let next=0
 for(const {sheet,cols,rows,section} of riskSheets){
  let count=0
  for(const row of rows){
   const lineageKey=`R${String(next+1).padStart(3,'0')}`
   const reads=periodKeys.map(key=>readRisk(row,cols,key,lineageKey,section))
   if(!reads.some(Boolean))continue
   next++
   reads.forEach((read,i)=>{if(read){periods[i].risks.push(read.risk);periods[i].fixes.push(...read.fixes)}})
   if(reads.at(-1))count++
  }
  if(count)used.splice(used.filter(u=>u.section!=='opportunities').length,0,{name:sheet.name,section,count})
 }
 for(const period of periods){const years=riskSheets.flatMap(s=>s.cols.years[period.key]);period.year=years.length?(period.key==='initial'?Math.min(...years):Math.max(...years)):null}
 const formCell=sheets.flatMap(s=>s.rows.flat()).find(v=>/[Α-ΩA-Z]\.[Α-ΩA-Z.]*\d{2,}/.test(String(v||'')))
 const formCode=String(formCell||'').match(/[Α-ΩA-Z]\.[Α-ΩA-Z.]*\d{2,}(-\d{2,})?/)?.[0]||''
 const meta={formCode,title:clean(formCell||'').replace(formCode,'').replace(/^[\s-]+/,''),assessedOn:excelDate(findLabel(sheets,/^ημερομηνια αξιολογησης/)),nextReviewOn:excelDate(findLabel(sheets,/^ημερομηνια επομενης/)),assessor:clean(findLabel(sheets,/^υπευθυνος αξιολογησης/)).replace(/\s+/g,' ')}
 const latest=periods.at(-1)
 return {meta,periods,risks:latest.risks,opportunities,fixes:latest.fixes,sheets:used}
}

// What an import creates: one assessment per period, oldest first. The latest
// takes the header the user confirmed and the opportunities; an earlier one
// takes its own period label and date and is due for review on the latest's date.
export function importPlan(parsed,header,{initialLabel,initialOn}={}){
 const periods=parsed.periods||[{key:'initial',risks:parsed.risks}]
 return periods.map((period,i)=>{
  const latest=i===periods.length-1
  const own=latest?header:{...header,periodLabel:initialLabel||String(period.year||''),assessedOn:initialOn,nextReviewOn:header.assessedOn}
  return {header:{...own,title:header.title},risks:period.risks,opportunities:latest?parsed.opportunities:[]}
 })
}

export async function importRiskWorkbook(file){
 const buffer=await (file.arrayBuffer?file.arrayBuffer():new Response(file).arrayBuffer())
 return parseRiskWorkbook(await readWorkbook(buffer))
}
