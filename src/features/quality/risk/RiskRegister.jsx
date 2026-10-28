import { useMemo,useState } from 'react'
import { FigureCards } from '../../../design-system/FigureCards'
import { AlertTriangle,ChevronRight,Plus,Star } from 'lucide-react'
import { FilterBar,FilterSelect } from '../../../design-system/FilterBar'
import { ActionButton } from '../../../design-system/ActionButton'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { JCI_CHAPTERS,LEVELS,SECTIONS,riskWarnings,scored,warningLabel } from './riskModel'
import { L,LevelChip,defaultFrame,returnedClass,txt,usePaged } from './riskUi'
import { IndicatorBadge } from './RiskIndicatorsUi'

// What each KPI card of the register keeps.
const QUICK={highOrAbove:x=>['high','very_high'].includes(x.s.residual.level),veryHigh:x=>x.s.residual.level==='very_high',high:x=>x.s.residual.level==='high',noPlan:x=>x.warnings.some(w=>w.id==='action_plan_required'),noTarget:x=>!x.s.target.score,noIndicator:x=>!(x.risk.indicatorKeys||[]).length}

// The register: every risk of the assessment with its three scores.
// What happened in practice in the last twelve months: the incidents of the
// risk's departments and the audit findings of its JCI chapter.
function RiskEvidence({evidence,en}){
 if(!evidence||(!evidence.incidents&&!evidence.findings))return null
 const parts=[evidence.incidents&&L(en,`${evidence.incidents} ${evidence.incidents===1?'συμβάν':'συμβάντα'}`,`${evidence.incidents} ${evidence.incidents===1?'incident':'incidents'}`),evidence.findings&&L(en,`${evidence.findings} ${evidence.findings===1?'εύρημα':'ευρήματα'}`,`${evidence.findings} ${evidence.findings===1?'finding':'findings'}`)].filter(Boolean)
 return <span className="risk-evidence" title={L(en,'Τους τελευταίους 12 μήνες','In the last 12 months')}>{L(en,'12μ','12m')}: {parts.join(' · ')}</span>
}

export function RiskRegister({risks,en,canEdit,onOpen,onCreate,cell,onClearCell,actions=null,indicatorValues=null,returned='',preset=null,frame=defaultFrame,evidenceOf=null}){
 const [query,setQuery]=useState('')
 const [section,setSection]=useState('all')
 const [process,setProcess]=useState('all')
 const [level,setLevel]=useState('all')
 const [jci,setJci]=useState(preset?.jci||'all')
 const [flag,setFlag]=useState('all')
 // A KPI card filters the register; a second click clears it.
 const [quick,setQuick]=useState(preset?.quick||null)
 const toggleQuick=id=>setQuick(current=>current===id?null:id)
 const processes=useMemo(()=>[...new Set(risks.map(r=>txt(r,'process',en)).filter(Boolean))].sort(),[risks,en])
 const all=useMemo(()=>risks.map(risk=>({risk,s:scored(risk),warnings:riskWarnings(risk)})),[risks])
 const counts=useMemo(()=>Object.fromEntries(Object.entries(QUICK).map(([id,test])=>[id,all.filter(test).length])),[all])
 const rows=useMemo(()=>all.filter(x=>!quick||QUICK[quick](x)).filter(({risk,s,warnings})=>{
  const text=`${risk.lineageKey} ${txt(risk,'process',en)} ${txt(risk,'scope',en)} ${txt(risk,'hazard',en)} ${txt(risk,'owner',en)} ${risk.indicator||''}`.toLowerCase()
  if(query&&!text.includes(query.toLowerCase()))return false
  if(section!=='all'&&risk.section!==section)return false
  if(process!=='all'&&txt(risk,'process',en)!==process)return false
  if(level!=='all'&&s.residual.level!==level)return false
  if(jci!=='all'&&risk.jci!==jci)return false
  if(flag==='warnings'&&!warnings.some(w=>w.tone!=='info'))return false
  if(flag==='prioritized'&&!risk.prioritized)return false
  if(cell&&(s[cell.kind].l!==cell.l||s[cell.kind].c!==cell.c))return false
  return true
 }),[all,quick,en,query,section,process,level,jci,flag,cell])
 // Rows of the two sections, each under its own heading.
 const ordered=useMemo(()=>SECTIONS.flatMap(x=>rows.filter(r=>(r.risk.section||'clinical')===x.id)),[rows])
 const {items:pageRows,pager}=usePaged(ordered,{en,resetOn:JSON.stringify([query,section,process,level,jci,flag,quick,cell]),startIndex:ordered.findIndex(r=>r.risk.lineageKey===returned)})
 const sectionTotals=useMemo(()=>Object.fromEntries(SECTIONS.map(x=>[x.id,ordered.filter(r=>(r.risk.section||'clinical')===x.id).length])),[ordered])
 const groups=SECTIONS.map(x=>({section:x,rows:pageRows.filter(r=>(r.risk.section||'clinical')===x.id)})).filter(g=>g.rows.length)
 // The table's rows: each section's heading, then its risks.
 const tableRows=groups.flatMap(({section:g,rows:list})=>[{heading:g},...list])
 const active=(section!=='all')+(process!=='all')+(level!=='all')+(jci!=='all')+(flag!=='all')
 const figure=(id,value,label,late=false)=><button key={id} type="button" className={`${late&&value?'is-late':''}${quick===id?' is-active':''}`.trim()} onClick={()=>toggleQuick(id)}><b>{value}</b> {label}</button>
 const kpis=<FigureCards className="quality-summary-line risk-summary-line">
   <button type="button" className={!quick?'is-active':undefined} onClick={()=>setQuick(null)}><b>{all.length}</b> {L(en,'κίνδυνοι','risks')}</button>
   {figure('veryHigh',counts.veryHigh,L(en,'πολύ υψηλοί (μετά τα μέτρα)','very high (after measures)'),true)}
   {figure('high',counts.high,L(en,'υψηλοί (μετά τα μέτρα)','high (after measures)'))}
   {figure('noPlan',counts.noPlan,L(en,'υψηλοί χωρίς σχέδιο δράσης','high without an action plan'),true)}
   {figure('noTarget',counts.noTarget,L(en,'χωρίς κίνδυνο-στόχο','without a target'),true)}
   {figure('noIndicator',counts.noIndicator,L(en,'χωρίς δείκτη','without an indicator'),true)}
 </FigureCards>
 return frame(kpis,<>
  <div className="risk-toolbar">
   <FilterBar query={query} onQueryChange={setQuery} placeholder={L(en,'Αναζήτηση κινδύνου, διεργασίας, τμήματος…','Search risk, process, department…')} activeAdvancedCount={active+(quick?1:0)} onClear={()=>{setQuery('');setSection('all');setProcess('all');setLevel('all');setJci('all');setFlag('all');setQuick(null);onClearCell?.()}}>
    <FilterSelect label={L(en,'Ενότητα','Section')} value={section} onChange={setSection}><option value="all">{L(en,'Όλες','All')}</option>{SECTIONS.map(x=><option key={x.id} value={x.id}>{en?x.en:x.el}</option>)}</FilterSelect>
    <FilterSelect label={L(en,'Διεργασία','Process')} value={process} onChange={setProcess}><option value="all">{L(en,'Όλες','All')}</option>{processes.map(p=><option key={p} value={p}>{p}</option>)}</FilterSelect>
    <FilterSelect label={L(en,'Υπολειπόμενος κίνδυνος','Residual risk')} value={level} onChange={setLevel}><option value="all">{L(en,'Όλα τα επίπεδα','All levels')}</option>{LEVELS.map(x=><option key={x.id} value={x.id}>{en?x.en:x.el}</option>)}</FilterSelect>
    <FilterSelect label="JCI" value={jci} onChange={setJci}><option value="all">{L(en,'Όλα','All')}</option>{JCI_CHAPTERS.map(x=><option key={x.id} value={x.id}>{x.id} · {en?x.en:x.el}</option>)}</FilterSelect>
    <FilterSelect label={L(en,'Εμφάνιση','Show')} value={flag} onChange={setFlag}><option value="all">{L(en,'Όλους','All')}</option><option value="warnings">{L(en,'Με εκκρεμότητες','With open points')}</option><option value="prioritized">{L(en,'Επιλεγμένους για FMEA','Selected for FMEA')}</option></FilterSelect>
   </FilterBar>
   <div className="risk-toolbar-actions">
    {canEdit&&<ActionButton label={L(en,'Νέος κίνδυνος','New risk')} tone="primary" onClick={onCreate}><Plus size={16}/><span>{L(en,'Νέος κίνδυνος','New risk')}</span></ActionButton>}
    {actions}
   </div>
  </div>
  {cell&&<div className="risk-cell-filter"><span>{L(en,'Φίλτρο από τον χάρτη','Filter from the heat map')}: L{cell.l} × C{cell.c}</span><button type="button" onClick={onClearCell}>{L(en,'Καθαρισμός','Clear')}</button></div>}
  <RegistryTable wrapperClassName="scroll-table risk-table-wrap" className="risk-table" rows={tableRows} rowKey={row=>row.heading?`section-${row.heading.id}`:row.risk.id||row.risk.lineageKey}
   columns={[{key:'code',label:L(en,'Κωδ.','Code')},{key:'process',label:L(en,'Διεργασία / τμήμα','Process / department')},{key:'risk',label:L(en,'Κίνδυνος','Risk')},{key:'inherent',label:L(en,'Εγγενής','Inherent')},{key:'residual',label:L(en,'Υπολειπόμενος','Residual'),className:'risk-step'},{key:'target',label:L(en,'Στόχος','Target'),className:'risk-step'},{key:'owner',label:L(en,'Υπεύθυνος','Owner')},{key:'open',label:''}]}
   rowProps={row=>row.heading?{}:{className:`risk-row-clickable${returnedClass(returned,row.risk.lineageKey)}`,onClick:()=>onOpen(row.risk)}}
   emptyTitle={risks.length?L(en,'Κανένας κίνδυνος με αυτά τα φίλτρα','No risk matches these filters'):L(en,'Δεν υπάρχουν κίνδυνοι','No risks yet')} emptyText={risks.length?L(en,'Αλλάξτε ή καθαρίστε τα φίλτρα.','Change or clear the filters.'):L(en,'Προσθέστε κινδύνους ή εισαγάγετε το μητρώο από Excel.','Add risks or import the register from Excel.')}
   renderRow={row=>row.heading?<tr className="risk-section-row"><td colSpan={8}><strong>{en?row.heading.en:row.heading.el}</strong><span>{sectionTotals[row.heading.id]}</span></td></tr>:<>
     <td><strong>{row.risk.lineageKey}</strong>{row.risk.prioritized&&<Star size={13} className="risk-star" aria-label="FMEA"/>}</td>
     <td><span className="risk-process">{txt(row.risk,'process',en)||'—'}</span><small>{txt(row.risk,'scope',en)}</small></td>
     <td className="risk-hazard"><span>{txt(row.risk,'hazard',en)}</span>
      {(row.risk.jci||(row.risk.indicatorKeys||[]).length>0||evidenceOf)&&<small className="risk-hazard-meta">{row.risk.jci&&<span>JCI {row.risk.jci}</span>}{(row.risk.indicatorKeys||[]).length>0&&<IndicatorBadge keys={row.risk.indicatorKeys||[]} values={indicatorValues} en={en}/>}{evidenceOf&&<RiskEvidence evidence={evidenceOf(row.risk)} en={en}/>}</small>}
      {row.warnings.filter(w=>w.tone!=='info').slice(0,2).map(w=><small key={w.id} className="risk-row-warning"><AlertTriangle size={12}/>{warningLabel(w.id,en)}</small>)}</td>
     <td><LevelChip score={row.s.inherent.score} level={row.s.inherent.level} en={en} compact/></td>
     <td className="risk-step"><LevelChip score={row.s.residual.score} level={row.s.residual.level} en={en}/></td>
     <td className="risk-step"><LevelChip score={row.s.target.score} level={row.s.target.level} en={en} compact/></td>
     <td>{txt(row.risk,'owner',en)||'—'}</td>
     <td className="risk-open-cell"><button type="button" className="risk-open-button" aria-label={L(en,'Άνοιγμα κινδύνου','Open the risk')} onClick={e=>{e.stopPropagation();onOpen(row.risk)}}><ChevronRight size={15}/></button></td>
    </>}/>
  {rows.length>0&&pager}
 </>,{registry:true,name:'risk-register'})
}
