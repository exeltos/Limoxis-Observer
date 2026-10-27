// Risk assessment (Ε.Δ.ΔΙΑΧ.090 / NHS National Patient Safety Agency 5×5 matrix).
// Score = likelihood (L) × consequence (C); the level follows the NHS bands
// 1–3 / 4–6 / 8–12 / 15–25. Every risk is scored three times: inherent (no
// controls), residual (with the controls already in place) and target (after
// the additional measures). Scores and levels are always computed, never typed.

export const LEVELS=[
 {id:'low',code:'Χ',max:3,range:'1–3',el:'Χαμηλός',en:'Low',responseEl:'Χωρίς ανάγκη για επιπλέον μέτρα',responseEn:'No additional measures needed'},
 {id:'moderate',code:'Μ',max:6,range:'4–6',el:'Μέτριος',en:'Moderate',responseEl:'Παρακολούθηση μέτρων & κινδύνου',responseEn:'Monitor the measures and the risk'},
 {id:'high',code:'Υ',max:12,range:'8–12',el:'Υψηλός',en:'High',responseEl:'Επιπλέον μέτρα μείωσης του κινδύνου (σχέδιο δράσης)',responseEn:'Additional risk-reduction measures (action plan)'},
 {id:'very_high',code:'ΠΥ',max:25,range:'15–25',el:'Πολύ υψηλός',en:'Very high',responseEl:'Αναθεώρηση της διαδικασίας, σχέδιο δράσης και ενημέρωση της Επιτροπής',responseEn:'Review the process, action plan and escalation to the committee'},
]
export const LEVEL_IDS=LEVELS.map(x=>x.id)
const LEVEL_RANK=Object.fromEntries(LEVELS.map((x,i)=>[x.id,i]))

export const LIKELIHOOD=[
 {value:1,el:'Σπάνια εμφάνιση',en:'Rare',frequencyEl:'Μη αναμενόμενο για χρόνια',frequencyEn:'Not expected for years',annual:'<0,1%'},
 {value:2,el:'Απίθανη εμφάνιση',en:'Unlikely',frequencyEl:'Τουλάχιστον μία φορά τον χρόνο',frequencyEn:'At least once a year',annual:'0,1–1%'},
 {value:3,el:'Πιθανή εμφάνιση',en:'Possible',frequencyEl:'Τουλάχιστον μία φορά τον μήνα',frequencyEn:'At least once a month',annual:'1–10%'},
 {value:4,el:'Πιο πιθανή εμφάνιση',en:'Likely',frequencyEl:'Τουλάχιστον μία φορά την εβδομάδα',frequencyEn:'At least once a week',annual:'10–50%'},
 {value:5,el:'Σχεδόν βέβαιη',en:'Almost certain',frequencyEl:'Σχεδόν καθημερινά',frequencyEn:'Almost daily',annual:'>50%'},
]
export const CONSEQUENCE=[
 {value:1,el:'Αμελητέα',en:'Negligible',exampleEl:'Ελάχιστη ή καμία βλάβη· δεν απαιτείται παρέμβαση.',exampleEn:'Minimal or no harm; no intervention needed.'},
 {value:2,el:'Μικρή',en:'Minor',exampleEl:'Μικρός τραυματισμός που απαιτεί ήσσονος σημασίας παρέμβαση· παράταση νοσηλείας 1–3 ημέρες.',exampleEn:'Minor injury needing minor intervention; stay extended by 1–3 days.'},
 {value:3,el:'Μέτρια',en:'Moderate',exampleEl:'Μέτρια βλάβη που απαιτεί παρέμβαση ειδικού· παράταση νοσηλείας 4–15 ημέρες· λίγοι ασθενείς.',exampleEn:'Moderate harm needing specialist intervention; stay extended by 4–15 days; a few patients.'},
 {value:4,el:'Μεγάλη',en:'Major',exampleEl:'Σοβαρή βλάβη με μακροχρόνια ανικανότητα ή αναπηρία· παράταση νοσηλείας >15 ημέρες.',exampleEn:'Major harm with long-term incapacity or disability; stay extended by >15 days.'},
 {value:5,el:'Καταστροφική',en:'Catastrophic',exampleEl:'Θάνατος ή μόνιμη, μη αναστρέψιμη βλάβη· επηρεάζει μεγάλο αριθμό ασθενών.',exampleEn:'Death or permanent, irreversible harm; affects many patients.'},
]

// JCI hospital standards: the International Patient Safety Goals and the
// chapters. The exact standard / measurable element is kept as free text
// (jciReference), as the edition in use names it.
export const JCI_CHAPTERS=[
 {id:'IPSG.1',el:'Σωστή ταυτοποίηση ασθενών',en:'Identify patients correctly'},
 {id:'IPSG.2',el:'Αποτελεσματική επικοινωνία',en:'Improve effective communication'},
 {id:'IPSG.3',el:'Φάρμακα υψηλού κινδύνου',en:'Safety of high-alert medications'},
 {id:'IPSG.4',el:'Ασφαλής χειρουργική',en:'Ensure safe surgery'},
 {id:'IPSG.5',el:'Μείωση λοιμώξεων – υγιεινή χεριών',en:'Reduce health care–associated infections'},
 {id:'IPSG.6',el:'Πρόληψη πτώσεων',en:'Reduce harm from falls'},
 {id:'ACC',el:'Πρόσβαση & συνέχεια φροντίδας',en:'Access to care and continuity of care'},
 {id:'PCC',el:'Φροντίδα με επίκεντρο τον ασθενή',en:'Patient-centered care'},
 {id:'AOP',el:'Αξιολόγηση ασθενών (εργαστήριο, απεικόνιση)',en:'Assessment of patients (laboratory, imaging)'},
 {id:'COP',el:'Φροντίδα ασθενών',en:'Care of patients'},
 {id:'ASC',el:'Αναισθησία & χειρουργική φροντίδα',en:'Anesthesia and surgical care'},
 {id:'MMU',el:'Διαχείριση & χρήση φαρμάκων',en:'Medication management and use'},
 {id:'QPS',el:'Ποιότητα & ασφάλεια ασθενών',en:'Quality and patient safety'},
 {id:'PCI',el:'Πρόληψη & έλεγχος λοιμώξεων',en:'Prevention and control of infection'},
 {id:'GLD',el:'Διακυβέρνηση, ηγεσία & διοίκηση',en:'Governance, leadership and direction'},
 {id:'FMS',el:'Εγκαταστάσεις & ασφάλεια',en:'Facility management and safety'},
 {id:'SQE',el:'Προσόντα & εκπαίδευση προσωπικού',en:'Staff qualifications and education'},
 {id:'MOI',el:'Διαχείριση πληροφοριών',en:'Management of information'},
]
export const SECTIONS=[{id:'clinical',el:'Ιατρονοσηλευτικοί κίνδυνοι',en:'Clinical risks'},{id:'general',el:'Γενικές κατηγορίες',en:'General risks'}]
export const ASSESSMENT_STATUSES=['draft','under_review','approved','archived']

const pick=(item,en)=>item?(en?item.en:item.el):''
export const levelInfo=id=>LEVELS.find(x=>x.id===id)||null
export const levelLabel=(id,en)=>pick(levelInfo(id),en)
export const jciLabel=(id,en)=>pick(JCI_CHAPTERS.find(x=>x.id===id),en)
export const sectionLabel=(id,en)=>pick(SECTIONS.find(x=>x.id===id),en)
export const likelihoodLabel=(value,en)=>pick(LIKELIHOOD.find(x=>x.value===Number(value)),en)
export const consequenceLabel=(value,en)=>pick(CONSEQUENCE.find(x=>x.value===Number(value)),en)

const axis=value=>{const n=Number(value);return Number.isInteger(n)&&n>=1&&n<=5?n:null}
export function riskScore(likelihood,consequence){const l=axis(likelihood),c=axis(consequence);return l&&c?l*c:null}
export function levelForScore(score){if(!score)return null;return LEVELS.find(x=>score<=x.max).id}
export const levelRank=id=>id in LEVEL_RANK?LEVEL_RANK[id]:-1

// The three scores of a risk, each {l,c,score,level}.
export function scored(risk){
 const one=(l,c)=>{const score=riskScore(l,c);return {l:axis(l),c:axis(c),score,level:levelForScore(score)}}
 return {inherent:one(risk?.inherentL,risk?.inherentC),residual:one(risk?.residualL,risk?.residualC),target:one(risk?.targetL,risk?.targetC)}
}

const filled=value=>Boolean(String(value??'').trim())&&!/^δ\s*\/\s*α\.?$/i.test(String(value).trim())

// What the assessment still needs on a risk, most serious first.
export function riskWarnings(risk){
 const s=scored(risk),out=[]
 if(!s.inherent.score||!s.residual.score)out.push({id:'incomplete',tone:'danger'})
 if(s.inherent.score&&s.residual.score&&s.residual.score>s.inherent.score)out.push({id:'residual_above_inherent',tone:'danger'})
 const needsPlan=levelRank(s.residual.level)>=levelRank('high')
 if(needsPlan&&!filled(risk?.additionalMeasures))out.push({id:'action_plan_required',tone:'danger'})
 if(filled(risk?.additionalMeasures)&&!filled(risk?.owner))out.push({id:'owner_required',tone:'warning'})
 if(needsPlan&&!s.target.score)out.push({id:'target_required',tone:'warning'})
 if(s.target.score&&s.residual.score&&s.target.score>s.residual.score)out.push({id:'target_above_residual',tone:'danger'})
 if(s.inherent.c&&s.residual.c&&s.inherent.c!==s.residual.c&&!filled(risk?.consequenceRationale))out.push({id:'consequence_changed',tone:'info'})
 return out
}
export const WARNING_LABELS={
 incomplete:['Λείπει πιθανότητα ή συνέπεια','Likelihood or consequence missing'],
 residual_above_inherent:['Ο υπολειπόμενος υπερβαίνει τον εγγενή κίνδυνο','Residual exceeds inherent risk'],
 action_plan_required:['Υψηλός υπολειπόμενος χωρίς πρόσθετα μέτρα','High residual risk without additional measures'],
 owner_required:['Λείπει υπεύθυνος υλοποίησης','No owner for the measures'],
 target_required:['Ορίστε κίνδυνο-στόχο','Set a target risk'],
 target_above_residual:['Ο στόχος υπερβαίνει τον υπολειπόμενο κίνδυνο','Target exceeds residual risk'],
 consequence_changed:['Άλλαξε η συνέπεια (C): σημειώστε αιτιολόγηση','Consequence (C) changed: note the reason'],
}
export const warningLabel=(id,en)=>WARNING_LABELS[id]?.[en?1:0]||id

const KINDS=['inherent','residual','target']
const emptyHeat=()=>Array.from({length:5},()=>Array(5).fill(0))
const round1=value=>Math.round(value*10)/10
const avg=values=>values.length?round1(values.reduce((a,b)=>a+b,0)/values.length):null

// Everything the analysis shows, from one pass over the risks.
export function summarizeRisks(risks=[]){
 const list=risks.map(risk=>({risk,s:scored(risk),warnings:riskWarnings(risk)}))
 const levels=Object.fromEntries(KINDS.map(kind=>[kind,Object.fromEntries(LEVEL_IDS.map(id=>[id,0]))]))
 const heat=Object.fromEntries(KINDS.map(kind=>[kind,emptyHeat()]))
 const scores=Object.fromEntries(KINDS.map(kind=>[kind,[]]))
 for(const {s} of list)for(const kind of KINDS){const x=s[kind];if(!x.score)continue;levels[kind][x.level]++;heat[kind][x.c-1][x.l-1]++;scores[kind].push(x.score)}
 const group=key=>{
  const map=new Map()
  for(const item of list){const k=String(item.risk[key]||'—');const g=map.get(k)||{key:k,count:0,inherent:[],residual:[],highOrAbove:0,max:0};g.count++;if(item.s.inherent.score)g.inherent.push(item.s.inherent.score);if(item.s.residual.score){g.residual.push(item.s.residual.score);g.max=Math.max(g.max,item.s.residual.score)};if(levelRank(item.s.residual.level)>=levelRank('high'))g.highOrAbove++;map.set(k,g)}
  return [...map.values()].map(g=>({key:g.key,count:g.count,inherentAvg:avg(g.inherent),residualAvg:avg(g.residual),residualMax:g.max,highOrAbove:g.highOrAbove,level:levelForScore(g.max)})).sort((a,b)=>b.residualMax-a.residualMax||(b.residualAvg||0)-(a.residualAvg||0)||a.key.localeCompare(b.key))
 }
 const reduced=list.filter(x=>x.s.inherent.score&&x.s.residual.score)
 const priorities=list.filter(x=>x.s.residual.score).sort((a,b)=>b.s.residual.score-a.s.residual.score||(b.s.inherent.score||0)-(a.s.inherent.score||0)||String(a.risk.code).localeCompare(String(b.risk.code)))
 return {
  total:list.length,levels,heat,
  averages:Object.fromEntries(KINDS.map(kind=>[kind,avg(scores[kind])])),
  reduction:{average:avg(reduced.map(x=>x.s.inherent.score-x.s.residual.score)),percent:reduced.length?Math.round(reduced.reduce((a,x)=>a+(x.s.inherent.score-x.s.residual.score)/x.s.inherent.score,0)/reduced.length*100):null,reducedCount:reduced.filter(x=>x.s.residual.score<x.s.inherent.score).length},
  byProcess:group('process'),bySection:group('section'),byJci:group('jci'),
  priorities:priorities.filter(x=>levelRank(x.s.residual.level)>=levelRank('high')).map(x=>x.risk),
  withoutPlan:list.filter(x=>x.warnings.some(w=>w.id==='action_plan_required')).map(x=>x.risk),
  withWarnings:list.filter(x=>x.warnings.some(w=>w.tone!=='info')).length,
  prioritized:list.filter(x=>x.risk.prioritized).map(x=>x.risk),
 }
}

// A risk is the same risk across periods when it keeps its lineage key (set
// when an assessment is carried forward); otherwise its wording must match.
const norm=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim()
export const riskIdentity=risk=>risk?.lineageKey||`${norm(risk?.process)}|${norm(risk?.scope)}|${norm(risk?.hazard)}`

export function compareAssessments(currentRisks=[],previousRisks=[]){
 const prev=new Map(previousRisks.map(r=>[riskIdentity(r),r]))
 const seen=new Set(),rows=[]
 for(const risk of currentRisks){
  const key=riskIdentity(risk),before=prev.get(key);seen.add(key)
  const now=scored(risk).residual.score,then=before?scored(before).residual.score:null
  const status=!before?'new':now==null||then==null?'unchanged':now<then?'improved':now>then?'worsened':'unchanged'
  rows.push({key,risk,previous:before||null,current:now,before:then,delta:now!=null&&then!=null?now-then:null,status})
 }
 for(const [key,risk] of prev)if(!seen.has(key))rows.push({key,risk,previous:risk,current:null,before:scored(risk).residual.score,delta:null,status:'removed'})
 const counts=Object.fromEntries(['improved','worsened','unchanged','new','removed'].map(id=>[id,rows.filter(r=>r.status===id).length]))
 return {rows:rows.sort((a,b)=>(b.delta??-99)-(a.delta??-99)||String(a.risk.code).localeCompare(String(b.risk.code))),counts,current:summarizeRisks(currentRisks),previous:summarizeRisks(previousRisks)}
}

// One point per assessment, oldest first: the course of the residual risk.
export function riskTrend(assessments=[]){
 return [...assessments].filter(a=>a.assessedOn).sort((a,b)=>String(a.assessedOn).localeCompare(String(b.assessedOn))).map(a=>{const s=summarizeRisks(a.risks||[]);return {id:a.id,label:a.periodLabel||a.assessedOn,assessedOn:a.assessedOn,total:s.total,residualAverage:s.averages.residual,inherentAverage:s.averages.inherent,levels:s.levels.residual,highOrAbove:s.levels.residual.high+s.levels.residual.very_high}})
}

// Suggested JCI chapter from the wording of a risk (an editable proposal).
const JCI_RULES=[
 [/εσόδων|εοπυυ/,'GLD'],[/ταυτοποι/,'IPSG.1'],[/επικοινωνι|κρισιμα αποτελεσματα|critical result/,'IPSG.2'],[/λαθος χειρουργικη περιοχη|wrong site/,'IPSG.4'],[/πτωση|fall/,'IPSG.6'],
 [/κεντρικων η περιφερικων γραμμων|central line/,'PCI'],[/ενδονοσοκομειακ|λοιμογον|hand hygiene|υγιειν/,'IPSG.5'],[/επομολυνση|βιολογικ|λοιμωξ|infection/,'PCI'],[/αιχμηρ|sharps/,'SQE'],
 [/κυτταροστατικ|φαρμακ|ναρκωτικ|εξαγγειωση|medication/,'MMU'],[/μεταγγιση|transfusion/,'COP'],[/αναισθησ|διεγχειρητικ|μεταγχειρητικ|μετεγχειρητικ|anesthe|surgical/,'ASC'],
 [/βλαβη μεγαφωνικου/,'FMS'],[/κωδικου μπλε|resuscitation/,'COP'],[/χημικ|ραδιενεργ/,'FMS'],[/ασθενοφορ|διακομιδ|transfer/,'ACC'],
 [/ιατρικου φακελου|προσωπικων στοιχειων|πληροφοριακ|λαθος αποδεκτη|καταχωρησης|record/,'MOI'],[/απεικονιση|imaging/,'AOP'],[/εργαστηριακης διαδικασιας, λογω βλαβης/,'AOP'],
 [/εξοπλισμ|πυρκαγ|πλυμμ|πλημμ|ηλεκτροπλ|απαγωγ|κλοπη|βιας|κακοποιησ|fire|flood|equipment/,'FMS'],[/αγωγων|προμηθ|αποθηκευσης|legal/,'GLD'],[/ικανοποιησ|satisfaction/,'PCC'],
]
export function suggestJci(...texts){const text=norm(texts.join(' '));return (JCI_RULES.find(([pattern])=>pattern.test(text))||[null,'COP'])[1]}

// Measures are kept as text, one per line; the editor shows them as a list.
// Old registers number them («1.Τήρηση… 2.Τήρηση…»), sometimes several on one
// line: the numbers are dropped and every numbered part becomes its own item.
export function parseMeasures(text){
 return String(text||'').replace(/\r/g,'')
  .split('\n')
  .flatMap(line=>line.split(/\s+(?=\d{1,2}\s?[.)]\s*\S)/))
  .map(item=>item.replace(/^\s*(\d{1,2}\s?[.)]|[-•·*])\s*/,'').trim())
  .filter(Boolean)
}
export const joinMeasures=items=>items.map(item=>String(item||'').trim()).filter(Boolean).join('\n')

// Periods: an assessment is annual, six-monthly or quarterly. Which year and
// which semester or quarter it covers is read from its label («Γ' τρίμηνο
// 2026», «2026-Α», «Q3 2026», «2ο εξάμηνο 2026»), else from its date.
const GREEK_INDEX={'α':1,'β':2,'γ':3,'δ':4}
const kindOf=a=>a?.periodKind==='semester'||a?.periodKind==='quarter'?a.periodKind:'annual'
export {kindOf as periodKindOf}
export function periodOf(a){
 const kind=kindOf(a),date=String(a?.assessedOn||''),label=norm(a?.periodLabel)
 const year=Number((label.match(/(?:19|20)\d\d/)||[])[0])||Number(date.slice(0,4))||null
 const month=Number(date.slice(5,7))||1,max=kind==='quarter'?4:kind==='semester'?2:1
 let index=null
 if(max>1){
  const rest=label.replace(/(?:19|20)\d\d/g,' ')
  const m=rest.match(/(?:^|[^a-zα-ω0-9])([1-4])(?:ο|η|st|nd|rd|th)?(?![0-9])/)||rest.match(/[qhs]([1-4])/)
  const g=rest.match(/(?:^|[^a-zα-ω])([αβγδ])(?:['΄’ʹ]|(?=[^a-zα-ω]|$))/)
  index=m?Number(m[1]):g?GREEK_INDEX[g[1]]:null
  if(!index||index>max)index=kind==='quarter'?Math.ceil(month/3):month<=6?1:2
 }
 return {kind,year,index}
}
export const periodKey=({kind,year,index})=>kind==='annual'?`${year}`:`${year}-${kind==='quarter'?'Q':'S'}${index}`
// The period to compare with: the same one a year earlier, or the one before.
export function counterpart(period,mode='lastYear'){
 const {kind,year,index}=period
 if(kind==='annual')return {kind,year:year-1,index}
 if(mode==='lastYear')return {kind,year:year-1,index}
 const max=kind==='quarter'?4:2
 return index>1?{kind,year,index:index-1}:{kind,year:year-1,index:max}
}
const ORDINAL=['Α','Β','Γ','Δ']
export function periodName({kind,year,index},en){
 if(kind==='annual')return String(year)
 if(en)return `${kind==='quarter'?'Q':'H'}${index} ${year}`
 return `${ORDINAL[index-1]}' ${kind==='quarter'?'τρίμηνο':'εξάμηνο'} ${year}`
}
// A label for a new assessment from its type and date.
export function suggestPeriodLabel(kind,date,en){
 const year=Number(String(date||'').slice(0,4))||new Date().getFullYear(),month=Number(String(date||'').slice(5,7))||1
 const k=kind==='semester'||kind==='quarter'?kind:'annual'
 return periodName({kind:k,year,index:k==='quarter'?Math.ceil(month/3):month<=6?1:2},en)
}

// Opportunities: a high or low yield, and how effective the action plan was.
export const OPPORTUNITY_RATINGS=[{id:'high',el:'Υψηλή απόδοση',en:'High yield'},{id:'low',el:'Χαμηλή απόδοση',en:'Low yield'}]
export const EFFECTIVENESS=[{id:'effective',el:'Αποτελεσματικό',en:'Effective',tone:'active'},{id:'partial',el:'Μερικώς αποτελεσματικό',en:'Partly effective',tone:'warning'},{id:'ineffective',el:'Μη αποτελεσματικό',en:'Not effective',tone:'danger'},{id:'pending',el:'Εκκρεμεί',en:'Pending',tone:''}]
export function ratingOf(text){const t=norm(text);if(!t)return '';if(/υψηλ|high/.test(t))return 'high';if(/χαμηλ|low/.test(t))return 'low';return ''}
// A note that starts with a status («Προς αξιολόγηση. Ποσοστό…»): the status,
// and the note without it.
const EFFECTIVENESS_RULES=[
 [/^(μη αποτελεσματικ\S*|αναποτελεσματικ\S*|not effective|ineffective)/,'ineffective'],
 [/^(μερικως(?: αποτελεσματικ\S*)?|partly(?: effective)?|partially(?: effective)?)/,'partial'],
 [/^(αποτελεσματικ\S*|effective)/,'effective'],
 [/^(προς αξιολογηση|εκκρεμει(?: αξιολογηση)?|σε εξελιξη|υπο αξιολογηση|pending|in progress)/,'pending'],
]
export function readEffectiveness(status,note){
 const text=String(note||'').trim()
 if(status)return {status,note:text}
 const plain=norm(text)
 for(const [pattern,id] of EFFECTIVENESS_RULES){const m=plain.match(pattern);if(m){const rest=text.slice(m[0].length).replace(/^[\s.:;,–-]+/,'');return {status:id,note:rest}}}
 return {status:'',note:text}
}
export const opportunityCode=index=>`Ε${String(index+1).padStart(3,'0')}`
// An opportunity as the screens use it: the yield as an id, the status apart
// from the note. ratingLabel() turns the id back into the stored wording.
export function normalizeOpportunity(o){
 const e=readEffectiveness(o?.effectivenessStatus,o?.effectiveness)
 return {...o,ratingId:o?.ratingId??ratingOf(o?.rating),effectivenessStatus:e.status,effectiveness:e.note}
}
export const ratingLabel=id=>OPPORTUNITY_RATINGS.find(r=>r.id===id)?.el||''

// Assessments loaded from a platform template carry its code in their history.
export const templateCodeOf=a=>(a?.history||[]).find(h=>h?.action==='riskAssessmentImported'&&h?.detail?.template)?.detail.template||''
const isSeededDemo=a=>/^RSA-DEMO-/.test(String(a?.code||''))
// While a template is loaded in a Demo, its assessments stand alone: the
// seeded Demo assessments are hidden (not deleted) until it is removed.
export function visibleAssessments(list=[]){
 return list.some(templateCodeOf)?list.filter(a=>!isSeededDemo(a)):list
}

// What happened in practice in the last twelve months for a risk: the incidents
// of the departments its scope names and the audit findings of its JCI chapter.
const plain=value=>String(value||'').toLocaleLowerCase('el').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()
export function riskEvidenceRows(risk,{incidents=[],findings=[]}={},on=new Date().toISOString().slice(0,10)){
 const since=`${Number(on.slice(0,4))-1}${on.slice(4,10)}`
 const scope=plain(`${risk.scope||''} ${risk.process||''}`)
 const parts=scope.split(/[,;/]| και /).map(part=>part.trim()).filter(part=>part.length>=3)
 const named=department=>{const name=plain(department);return Boolean(name)&&(scope.includes(name)||parts.some(part=>name.includes(part)))}
 const inYear=date=>String(date||'').slice(0,10)>=since&&String(date||'').slice(0,10)<=on
 const live=row=>row.lifecycleStatus!=='voided'
 const chapter=String(risk.jci||'').split('.')[0]
 const byDate=(a,b)=>String(b.date||'').localeCompare(String(a.date||''))
 return {
  incidents:incidents.filter(row=>live(row)&&inYear(row.date)&&named(row.department)).sort(byDate),
  findings:chapter?findings.filter(row=>live(row)&&inYear(row.date)&&row.standard==='jci'&&String(row.clauseRef||'').toUpperCase().startsWith(chapter.toUpperCase())).sort(byDate):[],
 }
}
export function riskEvidence(risk,practice={},on=new Date().toISOString().slice(0,10)){
 const rows=riskEvidenceRows(risk,practice,on)
 return {incidents:rows.incidents.length,findings:rows.findings.length}
}

// The same risk (its lineage key) in every assessment, oldest first: its three scores per period.
export function riskLineage(assessments=[],lineageKey){
 return assessments.map(assessment=>({assessment,risk:(assessment.risks||[]).find(item=>item.lineageKey===lineageKey)})).filter(entry=>entry.risk)
  .sort((a,b)=>String(a.assessment.assessedOn||'').localeCompare(String(b.assessment.assessedOn||'')))
  .map(({assessment,risk})=>({code:assessment.code,period:assessment.periodLabel,assessedOn:assessment.assessedOn,status:assessment.status,...scored(risk)}))
}
