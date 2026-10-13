// Import of a risk assessment spreadsheet in the Ε.Δ.ΔΙΑΧ.090 layout:
//   risk sheets   ΔΙΕΡΓΑΣΙΑ | Τμήμα/Αφορά | Πιθανό Ρίσκο | L | C | Αποτέλεσμα | Κατηγορία |
//                 Προληπτικά μέτρα | L | C | Αποτέλεσμα | Κατηγορία | Πρόσθετα μέτρα |
//                 Υπεύθυνος | Συχνότητα ελέγχου | Δείκτης / κωδικός συμβάντος
//   opportunities ΔΡΑΣΤΗΡΙΟΤΗΤΑ | ΕΥΚΑΙΡΙΕΣ | Χαρακτηρισμός | Σχέδια δράσης | Χρόνος | Υπεύθυνος | Αποτελεσματικότητα
// Scores and levels are recomputed from L and C; every typed result or level
// that disagrees, and every process name that was unified, is listed in `fixes`
// so the user sees what changed before importing.
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

export function parseRiskWorkbook(sheets){
 const risks=[],opportunities=[],fixes=[],used=[]
 for(const sheet of sheets){
  const headerIndex=sheet.rows.findIndex(row=>row.some(v=>/^διεργασια/.test(fold(v)))&&row.some(v=>/πιθανο ρισκο|κινδυνος/.test(fold(v))))
  if(headerIndex>=0){
   const header=sheet.rows[headerIndex],base=header.findIndex(v=>/^διεργασια/.test(fold(v)))
   const section=/γενικ/.test(fold(sheet.name))?'general':'clinical'
   let count=0
   for(const row of sheet.rows.slice(headerIndex+1)){
    const cell=k=>row[base+k]
    if(!isAxis(cell(3))||!isAxis(cell(4))||!clean(cell(2)))continue
    const lineageKey=`R${String(risks.length+1).padStart(3,'0')}`
    const rawProcess=clean(cell(0)),process=normalizeProcess(rawProcess),hazard=clean(cell(2))
    const risk={lineageKey,section,process,scope:clean(cell(1)),hazard,inherentL:num(cell(3)),inherentC:num(cell(4)),existingControls:clean(cell(7)),
     residualL:isAxis(cell(8))?num(cell(8)):null,residualC:isAxis(cell(9))?num(cell(9)):null,additionalMeasures:notApplicable(cell(12)),owner:notApplicable(cell(13)),
     reviewFrequency:clean(cell(14)),indicator:clean(cell(15)),targetL:null,targetC:null,jci:suggestJci(hazard,process),jciReference:'',prioritized:false,notes:'',consequenceRationale:'',dueDate:null}
    risks.push(risk);count++
    if(process!==rawProcess.replace(/\s+/g,' '))fixes.push({lineageKey,field:'process',before:rawProcess,after:process})
    for(const [kind,l,c,result,level] of [['inherent',3,4,5,6],['residual',8,9,10,11]]){
     const score=riskScore(cell(l),cell(c));if(!score)continue
     const typed=num(cell(result));if(typed!=null&&typed!==score)fixes.push({lineageKey,field:`${kind}Score`,before:typed,after:score})
     const typedL=typedLevel(cell(level)),actual=levelForScore(score);if(typedL&&typedL!==actual)fixes.push({lineageKey,field:`${kind}Level`,before:clean(cell(level)),after:actual})
    }
   }
   if(count)used.push({name:sheet.name,section,count})
   continue
  }
  const oppHeader=sheet.rows.findIndex(row=>row.some(v=>/^δραστηριοτητα/.test(fold(v)))&&row.some(v=>/ευκαιρ/.test(fold(v))))
  if(oppHeader>=0){
   const base=sheet.rows[oppHeader].findIndex(v=>/^δραστηριοτητα/.test(fold(v)))
   for(const row of sheet.rows.slice(oppHeader+1)){const cell=k=>clean(row[base+k]);if(!cell(0))continue;opportunities.push({activity:cell(0),opportunity:cell(1),rating:cell(2),actionPlan:cell(3),timeframe:cell(4),owner:cell(5),effectiveness:cell(6)})}
   if(opportunities.length)used.push({name:sheet.name,section:'opportunities',count:opportunities.length})
  }
 }
 const formCell=sheets.flatMap(s=>s.rows.flat()).find(v=>/[Α-Ω]\.[Α-Ω.]*\d{2,}/.test(String(v||'')))
 const formCode=String(formCell||'').match(/[Α-ΩA-Z][Α-ΩA-Z.]*\.\d{2,}/)?.[0]||''
 const meta={formCode,title:clean(formCell||'').replace(formCode,'').replace(/^[\s-]+/,''),assessedOn:excelDate(findLabel(sheets,/^ημερομηνια αξιολογησης/)),nextReviewOn:excelDate(findLabel(sheets,/^ημερομηνια επομενης/)),assessor:clean(findLabel(sheets,/^υπευθυνος αξιολογησης/))}
 return {meta,risks,opportunities,fixes,sheets:used}
}

export async function importRiskWorkbook(file){
 const buffer=await (file.arrayBuffer?file.arrayBuffer():new Response(file).arrayBuffer())
 return parseRiskWorkbook(await readWorkbook(buffer))
}
