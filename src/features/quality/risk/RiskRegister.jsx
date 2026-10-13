import { useMemo,useState } from 'react'
import { AlertTriangle,CheckSquare2,Pencil,Plus,Star,Trash2 } from 'lucide-react'
import { FilterBar,FilterSelect } from '../../../design-system/FilterBar'
import { OverflowMenu } from '../../../design-system/OverflowMenu'
import { ActionButton } from '../../../design-system/ActionButton'
import { JCI_CHAPTERS,LEVELS,SECTIONS,riskWarnings,scored,warningLabel } from './riskModel'
import { L,LevelChip,txt } from './riskUi'
import { IndicatorChip } from './RiskIndicatorsUi'

// The register: every risk of the assessment with its three scores.
export function RiskRegister({risks,en,canEdit,onOpen,onCreate,onDelete,onCreateCapa,cell,onClearCell,actions=null,indicatorValues=null}){
 const [query,setQuery]=useState('')
 const [section,setSection]=useState('all')
 const [process,setProcess]=useState('all')
 const [level,setLevel]=useState('all')
 const [jci,setJci]=useState('all')
 const [flag,setFlag]=useState('all')
 const processes=useMemo(()=>[...new Set(risks.map(r=>txt(r,'process',en)).filter(Boolean))].sort(),[risks,en])
 const rows=useMemo(()=>risks.map(risk=>({risk,s:scored(risk),warnings:riskWarnings(risk)})).filter(({risk,s,warnings})=>{
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
 }),[risks,en,query,section,process,level,jci,flag,cell])
 const active=(section!=='all')+(process!=='all')+(level!=='all')+(jci!=='all')+(flag!=='all')
 return <div className="risk-register">
  <div className="risk-toolbar">
   <FilterBar query={query} onQueryChange={setQuery} placeholder={L(en,'Αναζήτηση κινδύνου, διεργασίας, τμήματος…','Search risk, process, department…')} activeAdvancedCount={active} onClear={()=>{setQuery('');setSection('all');setProcess('all');setLevel('all');setJci('all');setFlag('all');onClearCell?.()}}>
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
    <th>{L(en,'Εγγενής','Inherent')}</th><th>{L(en,'Υπολειπόμενος','Residual')}</th><th>{L(en,'Στόχος','Target')}</th>
    <th>JCI</th><th>{L(en,'Υπεύθυνος','Owner')}</th><th aria-label={L(en,'Ενέργειες','Actions')}/>
   </tr></thead><tbody>
    {rows.map(({risk,s,warnings})=><tr key={risk.id||risk.lineageKey} onClick={()=>onOpen(risk)}>
     <td><strong>{risk.lineageKey}</strong>{risk.prioritized&&<Star size={13} className="risk-star" aria-label="FMEA"/>}</td>
     <td><span className="risk-process">{txt(risk,'process',en)||'—'}</span><small>{txt(risk,'scope',en)}</small></td>
     <td className="risk-hazard"><span>{txt(risk,'hazard',en)}</span>{(risk.indicatorKeys||[]).length>0&&<span className="risk-row-indicators">{risk.indicatorKeys.map(key=><IndicatorChip key={key} indicatorKey={key} values={indicatorValues} en={en} compact/>)}</span>}{warnings.filter(w=>w.tone!=='info').slice(0,2).map(w=><small key={w.id} className="risk-row-warning"><AlertTriangle size={12}/>{warningLabel(w.id,en)}</small>)}</td>
     <td><LevelChip score={s.inherent.score} level={s.inherent.level} en={en} compact/></td>
     <td><LevelChip score={s.residual.score} level={s.residual.level} en={en}/></td>
     <td><LevelChip score={s.target.score} level={s.target.level} en={en} compact/></td>
     <td>{risk.jci||'—'}</td>
     <td>{txt(risk,'owner',en)||'—'}</td>
     <td onClick={e=>e.stopPropagation()}><OverflowMenu label={L(en,'Ενέργειες κινδύνου','Risk actions')} items={[
      {id:'open',label:canEdit?L(en,'Επεξεργασία','Edit'):L(en,'Προβολή','View'),icon:Pencil,onClick:()=>onOpen(risk)},
      {id:'capa',label:L(en,'Δημιουργία διορθωτικής ενέργειας','Create CAPA'),icon:CheckSquare2,onClick:()=>onCreateCapa(risk)},
      ...(canEdit?[{id:'delete',label:L(en,'Διαγραφή','Delete'),icon:Trash2,tone:'danger',separatorBefore:true,onClick:()=>onDelete(risk)}]:[]),
     ]}/></td>
    </tr>)}
   </tbody></table>
   {!rows.length&&<div className="registry-empty-state"><strong>{risks.length?L(en,'Κανένας κίνδυνος με αυτά τα φίλτρα','No risk matches these filters'):L(en,'Δεν υπάρχουν κίνδυνοι','No risks yet')}</strong><span>{risks.length?L(en,'Αλλάξτε ή καθαρίστε τα φίλτρα.','Change or clear the filters.'):L(en,'Προσθέστε κινδύνους ή εισαγάγετε το μητρώο από Excel.','Add risks or import the register from Excel.')}</span></div>}
  </div>
  <p className="risk-count">{L(en,`${rows.length} από ${risks.length} κινδύνους`,`${rows.length} of ${risks.length} risks`)}</p>
 </div>
}
