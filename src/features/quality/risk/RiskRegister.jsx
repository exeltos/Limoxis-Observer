import { useMemo,useState } from 'react'
import { AlertOctagon,AlertTriangle,ChevronRight,ClipboardList,Gauge,Plus,Star,Target } from 'lucide-react'
import { FilterBar,FilterSelect } from '../../../design-system/FilterBar'
import { ActionButton } from '../../../design-system/ActionButton'
import { MetricCard } from '../../../design-system/MetricCard'
import { JCI_CHAPTERS,LEVELS,SECTIONS,riskWarnings,scored,warningLabel } from './riskModel'
import { L,LevelChip,defaultFrame,returnedClass,txt,usePaged } from './riskUi'
import { IndicatorBadge } from './RiskIndicatorsUi'

// What each KPI card of the register keeps.
const QUICK={highOrAbove:x=>['high','very_high'].includes(x.s.residual.level),veryHigh:x=>x.s.residual.level==='very_high',high:x=>x.s.residual.level==='high',noPlan:x=>x.warnings.some(w=>w.id==='action_plan_required'),noTarget:x=>!x.s.target.score,noIndicator:x=>!(x.risk.indicatorKeys||[]).length}

// The register: every risk of the assessment with its three scores.
export function RiskRegister({risks,en,canEdit,onOpen,onCreate,cell,onClearCell,actions=null,indicatorValues=null,returned='',preset=null,frame=defaultFrame}){
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
 const active=(section!=='all')+(process!=='all')+(level!=='all')+(jci!=='all')+(flag!=='all')
 const kpis=<div className="module-summary-strip risk-kpi-strip risk-register-kpis">
   <MetricCard icon={ClipboardList} value={all.length} label={L(en,'Κίνδυνοι','Risks')} onClick={()=>setQuick(null)} active={!quick}/>
   <MetricCard icon={AlertOctagon} value={counts.veryHigh} label={L(en,'Πολύ υψηλοί (υπολ.)','Very high (residual)')} onClick={()=>toggleQuick('veryHigh')} active={quick==='veryHigh'}/>
   <MetricCard icon={AlertTriangle} value={counts.high} label={L(en,'Υψηλοί (υπολ.)','High (residual)')} onClick={()=>toggleQuick('high')} active={quick==='high'}/>
   <MetricCard icon={ClipboardList} value={counts.noPlan} label={L(en,'Υψηλοί χωρίς σχέδιο δράσης','High without an action plan')} onClick={()=>toggleQuick('noPlan')} active={quick==='noPlan'}/>
   <MetricCard icon={Target} value={counts.noTarget} label={L(en,'Χωρίς κίνδυνο-στόχο','Without a target')} onClick={()=>toggleQuick('noTarget')} active={quick==='noTarget'}/>
   <MetricCard icon={Gauge} value={counts.noIndicator} label={L(en,'Χωρίς δείκτη','Without an indicator')} onClick={()=>toggleQuick('noIndicator')} active={quick==='noIndicator'}/>
 </div>
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
  <div className="scroll-table risk-table-wrap">
   <table className="data-table sticky-table risk-table"><thead><tr>
    <th>{L(en,'Κωδ.','Code')}</th><th>{L(en,'Διεργασία / τμήμα','Process / department')}</th><th>{L(en,'Κίνδυνος','Risk')}</th>
    <th>{L(en,'Εγγενής','Inherent')}</th><th className="risk-step">{L(en,'Υπολειπόμενος','Residual')}</th><th className="risk-step">{L(en,'Στόχος','Target')}</th>
    <th>{L(en,'Δείκτες','Indicators')}</th><th>JCI</th><th>{L(en,'Υπεύθυνος','Owner')}</th><th aria-hidden="true"/>
   </tr></thead><tbody>
    {groups.map(({section:g,rows:list})=>[
     <tr key={`section-${g.id}`} className="risk-section-row"><td colSpan={10}><strong>{en?g.en:g.el}</strong><span>{sectionTotals[g.id]}</span></td></tr>,
     ...list.map(({risk,s,warnings})=><tr key={risk.id||risk.lineageKey} className={`risk-row-clickable${returnedClass(returned,risk.lineageKey)}`} onClick={()=>onOpen(risk)}>
     <td><strong>{risk.lineageKey}</strong>{risk.prioritized&&<Star size={13} className="risk-star" aria-label="FMEA"/>}</td>
     <td><span className="risk-process">{txt(risk,'process',en)||'—'}</span><small>{txt(risk,'scope',en)}</small></td>
     <td className="risk-hazard"><span>{txt(risk,'hazard',en)}</span>{warnings.filter(w=>w.tone!=='info').slice(0,2).map(w=><small key={w.id} className="risk-row-warning"><AlertTriangle size={12}/>{warningLabel(w.id,en)}</small>)}</td>
     <td><LevelChip score={s.inherent.score} level={s.inherent.level} en={en} compact/></td>
     <td className="risk-step"><LevelChip score={s.residual.score} level={s.residual.level} en={en}/></td>
     <td className="risk-step"><LevelChip score={s.target.score} level={s.target.level} en={en} compact/></td>
     <td><IndicatorBadge keys={risk.indicatorKeys||[]} values={indicatorValues} en={en}/></td>
     <td>{risk.jci||'—'}</td>
     <td>{txt(risk,'owner',en)||'—'}</td>
     <td className="risk-open-cell"><ChevronRight size={15}/></td>
    </tr>)
    ])}
   </tbody></table>
   {!rows.length&&<div className="registry-empty-state"><strong>{risks.length?L(en,'Κανένας κίνδυνος με αυτά τα φίλτρα','No risk matches these filters'):L(en,'Δεν υπάρχουν κίνδυνοι','No risks yet')}</strong><span>{risks.length?L(en,'Αλλάξτε ή καθαρίστε τα φίλτρα.','Change or clear the filters.'):L(en,'Προσθέστε κινδύνους ή εισαγάγετε το μητρώο από Excel.','Add risks or import the register from Excel.')}</span></div>}
  </div>
  {rows.length>0&&pager}
 </>,{registry:true,name:'risk-register'})
}
