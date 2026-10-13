import { useMemo,useState } from 'react'
import { AlertOctagon,AlertTriangle,CheckSquare2,ClipboardList,Gauge,Pencil,Plus,Star,Target,Trash2 } from 'lucide-react'
import { FilterBar,FilterSelect } from '../../../design-system/FilterBar'
import { OverflowMenu } from '../../../design-system/OverflowMenu'
import { ActionButton } from '../../../design-system/ActionButton'
import { MetricCard } from '../../../design-system/MetricCard'
import { JCI_CHAPTERS,LEVELS,SECTIONS,riskWarnings,scored,warningLabel } from './riskModel'
import { L,LevelChip,txt } from './riskUi'
import { IndicatorBadge } from './RiskIndicatorsUi'

// What each KPI card of the register keeps.
const QUICK={veryHigh:x=>x.s.residual.level==='very_high',high:x=>x.s.residual.level==='high',noPlan:x=>x.warnings.some(w=>w.id==='action_plan_required'),noTarget:x=>!x.s.target.score,noIndicator:x=>!(x.risk.indicatorKeys||[]).length}

// The register: every risk of the assessment with its three scores.
export function RiskRegister({risks,en,canEdit,onOpen,onCreate,onDelete,onCreateCapa,cell,onClearCell,actions=null,indicatorValues=null}){
 const [query,setQuery]=useState('')
 const [section,setSection]=useState('all')
 const [process,setProcess]=useState('all')
 const [level,setLevel]=useState('all')
 const [jci,setJci]=useState('all')
 const [flag,setFlag]=useState('all')
 // A KPI card filters the register; a second click clears it.
 const [quick,setQuick]=useState(null)
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
 const groups=useMemo(()=>SECTIONS.map(x=>({section:x,rows:rows.filter(r=>(r.risk.section||'clinical')===x.id)})).filter(g=>g.rows.length),[rows])
 const active=(section!=='all')+(process!=='all')+(level!=='all')+(jci!=='all')+(flag!=='all')
 return <div className="risk-register">
  <div className="module-summary-strip risk-kpi-strip risk-register-kpis">
   <MetricCard icon={ClipboardList} value={all.length} label={L(en,'Κίνδυνοι','Risks')} onClick={()=>setQuick(null)} active={!quick}/>
   <MetricCard icon={AlertOctagon} tone="danger" value={counts.veryHigh} label={L(en,'Πολύ υψηλοί (υπολ.)','Very high (residual)')} onClick={()=>toggleQuick('veryHigh')} active={quick==='veryHigh'}/>
   <MetricCard icon={AlertTriangle} tone="warning" value={counts.high} label={L(en,'Υψηλοί (υπολ.)','High (residual)')} onClick={()=>toggleQuick('high')} active={quick==='high'}/>
   <MetricCard icon={ClipboardList} tone={counts.noPlan?'danger':'neutral'} value={counts.noPlan} label={L(en,'Υψηλοί χωρίς σχέδιο δράσης','High without an action plan')} onClick={()=>toggleQuick('noPlan')} active={quick==='noPlan'}/>
   <MetricCard icon={Target} value={counts.noTarget} label={L(en,'Χωρίς κίνδυνο-στόχο','Without a target')} onClick={()=>toggleQuick('noTarget')} active={quick==='noTarget'}/>
   <MetricCard icon={Gauge} value={counts.noIndicator} label={L(en,'Χωρίς δείκτη','Without an indicator')} onClick={()=>toggleQuick('noIndicator')} active={quick==='noIndicator'}/>
  </div>
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
    <th>{L(en,'Δείκτες','Indicators')}</th><th>JCI</th><th>{L(en,'Υπεύθυνος','Owner')}</th><th aria-label={L(en,'Ενέργειες','Actions')}/>
   </tr></thead><tbody>
    {groups.map(({section:g,rows:list})=>[
     <tr key={`section-${g.id}`} className="risk-section-row"><td colSpan={10}><strong>{en?g.en:g.el}</strong><span>{list.length}</span></td></tr>,
     ...list.map(({risk,s,warnings})=><tr key={risk.id||risk.lineageKey} onClick={()=>onOpen(risk)}>
     <td><strong>{risk.lineageKey}</strong>{risk.prioritized&&<Star size={13} className="risk-star" aria-label="FMEA"/>}</td>
     <td><span className="risk-process">{txt(risk,'process',en)||'—'}</span><small>{txt(risk,'scope',en)}</small></td>
     <td className="risk-hazard"><span>{txt(risk,'hazard',en)}</span>{warnings.filter(w=>w.tone!=='info').slice(0,2).map(w=><small key={w.id} className="risk-row-warning"><AlertTriangle size={12}/>{warningLabel(w.id,en)}</small>)}</td>
     <td><LevelChip score={s.inherent.score} level={s.inherent.level} en={en} compact/></td>
     <td className="risk-step"><LevelChip score={s.residual.score} level={s.residual.level} en={en}/></td>
     <td className="risk-step"><LevelChip score={s.target.score} level={s.target.level} en={en} compact/></td>
     <td><IndicatorBadge keys={risk.indicatorKeys||[]} values={indicatorValues} en={en}/></td>
     <td>{risk.jci||'—'}</td>
     <td>{txt(risk,'owner',en)||'—'}</td>
     <td onClick={e=>e.stopPropagation()}><OverflowMenu label={L(en,'Ενέργειες κινδύνου','Risk actions')} items={[
      {id:'open',label:canEdit?L(en,'Επεξεργασία','Edit'):L(en,'Προβολή','View'),icon:Pencil,onClick:()=>onOpen(risk)},
      {id:'capa',label:L(en,'Δημιουργία διορθωτικής ενέργειας','Create CAPA'),icon:CheckSquare2,onClick:()=>onCreateCapa(risk)},
      ...(canEdit?[{id:'delete',label:L(en,'Διαγραφή','Delete'),icon:Trash2,tone:'danger',separatorBefore:true,onClick:()=>onDelete(risk)}]:[]),
     ]}/></td>
    </tr>)
    ])}
   </tbody></table>
   {!rows.length&&<div className="registry-empty-state"><strong>{risks.length?L(en,'Κανένας κίνδυνος με αυτά τα φίλτρα','No risk matches these filters'):L(en,'Δεν υπάρχουν κίνδυνοι','No risks yet')}</strong><span>{risks.length?L(en,'Αλλάξτε ή καθαρίστε τα φίλτρα.','Change or clear the filters.'):L(en,'Προσθέστε κινδύνους ή εισαγάγετε το μητρώο από Excel.','Add risks or import the register from Excel.')}</span></div>}
  </div>
  <p className="risk-count">{L(en,`${rows.length} από ${risks.length} κινδύνους`,`${rows.length} of ${risks.length} risks`)}</p>
 </div>
}
