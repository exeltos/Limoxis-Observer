// Shared pieces of the risk assessment screens: level chips, the 5×5 heat map,
// the L/C pickers and the legend. Colours are the NHS bands (see riskAssessment.css).
import { useState, type ReactNode } from 'react'
import { useTableSort } from '../../../design-system/useTableSort'
import { Pencil,Trash2 } from 'lucide-react'
import { RegistryPagination } from '../../../design-system/RegistryPagination'
import { ActionButton } from '../../../design-system/ActionButton'
import { ObserverDialog,DialogActions } from '../../../design-system/ObserverDialog'
import { SearchableSelect } from '../../../design-system/SearchableSelect'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { formatDay } from '../../../core/i18n/formatDay'
import { readSessionValue,writeSessionValue } from '../../../core/storage/browserStorage'
import { CONSEQUENCE,LEVELS,LIKELIHOOD,levelForScore,levelLabel } from './riskModel'
import type { ScaleOption } from './riskTypes'

// The row last opened in a list, kept for the session, so it is highlighted
// on the way back (the registries' registry-row-returned).
export const rememberRow=(key: string,id: string|undefined)=>writeSessionValue(key,String(id))
export function useReturnedRow(key: string){
 const [returned,setReturned]=useState(()=>readSessionValue(key,'')||'')
 return {returned,remember:(id: string|undefined)=>{rememberRow(key,id);setReturned(String(id))}}
}
// Pages of a table with the registries' pager. A new filter (resetOn) goes back
// to page 1; on the way back from a record the page holding it is shown.
// sortBy (column key → value reader) gives the table's arrows: the whole list is sorted, then the page is cut.
export function usePaged<T>(list: T[],{en=false,resetOn='',startIndex=-1,sortBy=null}: {en?: boolean,resetOn?: string,startIndex?: number,sortBy?: Record<string,(row: T)=>unknown>|null}={}){
 const {sorted,sort,onSort}=useTableSort(list,sortBy||{})
 const [pageSize,setPageSize]=useState(15)
 const [page,setPage]=useState(()=>startIndex>=0?Math.floor(startIndex/15)+1:1)
 const resetKey=`${resetOn}|${sort.key}|${sort.dir}`
 const [seen,setSeen]=useState(resetKey)
 if(seen!==resetKey){setSeen(resetKey);setPage(1)}
 const totalPages=Math.max(1,Math.ceil(sorted.length/pageSize)),safePage=Math.min(page,totalPages)
 const items=sorted.slice((safePage-1)*pageSize,safePage*pageSize)
 const pager=<RegistryPagination language={en?'en':'el'} page={safePage} totalPages={totalPages} totalItems={sorted.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size=>{setPageSize(size);setPage(1)}}/>
 return {items,pager,sort,onSort,sorted}
}
// A tab outside the assessment page (tests, a standalone use) renders its KPIs
// and content one after the other.
export type RiskFrame=(kpis: ReactNode,content: ReactNode,options?: {registry?: boolean,name?: string})=>ReactNode
export const defaultFrame=(kpis: ReactNode,content: ReactNode,{name=''}: {name?: string}={})=><>{kpis}{name?<div className={name}>{content}</div>:content}</>
// The class that marks the row last opened.
export const returnedClass=(returned: string,id: string|undefined)=>returned&&String(id)===returned?' registry-row-returned':''

// Demo records carry English wording in `<field>En`; user records have one language.
export const txt=(item: Readonly<Record<string,unknown>>|null|undefined,field: string,en: boolean)=>((en&&item?.[`${field}En`])||item?.[field]||'') as string
export const L=(en: boolean,el: string,enText: string)=>en?enText:el

export function LevelChip({score,level,en,compact=false,title}: {score?: number|null,level?: string|null,en: boolean,compact?: boolean,title?: string}){
 const id=level||levelForScore(score)
 if(!score||!id)return <span className="risk-level risk-level-none">—</span>
 return <span className={`risk-level risk-level-${id}`} title={title||`${score} · ${levelLabel(id,en)}`}><strong>{score}</strong>{!compact&&<span>{levelLabel(id,en)}</span>}</span>
}

// Rows: consequence 5 (top) to 1; columns: likelihood 1 to 5. A cell shows how
// many risks sit there; its colour is the band of L×C.
export function RiskHeatMap({heat,en,title,caption,onCell,active,emptyNote=''}: {heat?: number[][],en: boolean,title?: string,caption?: string,onCell?: ((cell: {l: number,c: number})=>void)|null,active?: {l: number,c: number}|null,emptyNote?: string}){
 const empty=!(heat||[]).some(row=>row.some(Boolean))
 return <figure className={`risk-heatmap${empty&&emptyNote?' is-empty':''}`}>
  {title&&<figcaption><strong>{title}</strong>{caption&&<span>{caption}</span>}</figcaption>}
  <div className="risk-heatmap-body">
   <span className="risk-heatmap-axis risk-heatmap-axis-c">{L(en,'Συνέπεια (C)','Consequence (C)')}</span>
   <table><tbody>
    {[5,4,3,2,1].map(c=><tr key={c}><th scope="row" title={CONSEQUENCE[c-1][en?'en':'el']}>{c}</th>{[1,2,3,4,5].map(l=>{const score=l*c,count=heat?.[c-1]?.[l-1]||0,isActive=active&&active.l===l&&active.c===c
     return <td key={l} className={`risk-cell risk-cell-${levelForScore(score)}${count?' has-risks':''}${isActive?' is-active':''}`} title={`L${l} × C${c} = ${score} · ${count}`}>{onCell&&count?<button type="button" onClick={()=>onCell({l,c})}>{count}</button>:<span>{count||''}</span>}<small>{score}</small></td>})}</tr>)}
    <tr><th aria-hidden="true"/>{[1,2,3,4,5].map(l=><th key={l} scope="col" title={LIKELIHOOD[l-1][en?'en':'el']}>{l}</th>)}</tr>
   </tbody></table>
   <span className="risk-heatmap-axis risk-heatmap-axis-l">{L(en,'Πιθανότητα (L)','Likelihood (L)')}</span>
   {empty&&emptyNote&&<p className="risk-heatmap-empty">{emptyNote}</p>}
  </div>
 </figure>
}

export function LevelLegend({en,showResponse=false}: {en: boolean,showResponse?: boolean}){
 return <ul className={`risk-legend${showResponse?' risk-legend-full':''}`}>{LEVELS.map(x=><li key={x.id}><span className={`risk-swatch risk-cell-${x.id}`}/><strong>{en?x.en:x.el}</strong><small>{x.range}</small>{showResponse&&<em>{en?x.responseEn:x.responseEl}</em>}</li>)}</ul>
}

// L or C of a stage: one value of the 1–5 scale, typed or picked; «×» clears it.
export function AxisSelect({label,value,onChange,scale,en,disabled=false}: {label: string,value: number|null|undefined,onChange: (value: number|null)=>void,scale: ScaleOption[],en: boolean,disabled?: boolean}){
 return <SearchableSelect className="risk-axis-select" label={label} value={value??''} disabled={disabled} placeholder="—" clearLabel={disabled?'':L(en,'Καθαρισμός','Clear')} emptyLabel={L(en,'Καμία τιμή','No value')} onChange={v=>onChange(v===''||v==null?null:Number(v))} options={scale.map(x=>({value:x.value,label:`${x.value} · ${en?x.en:x.el}`}))}/>
}

export const STATUS_LABELS: Record<string,string[]>={draft:['Πρόχειρο','Draft'],under_review:['Σε έλεγχο','Under review'],approved:['Εγκεκριμένη','Approved'],archived:['Αρχειοθετημένη','Archived']}
export const statusLabel=(id: string,en: boolean)=>STATUS_LABELS[id]?.[en?1:0]||id
export const statusTone=(id: string)=>id==='approved'?'success':id==='under_review'?'warning':'neutral'
export function AssessmentStatusBadge({status,en}: {status: string,en: boolean}){return <StatusBadge tone={statusTone(status)}>{statusLabel(status,en)}</StatusBadge>}
export const PERIOD_KINDS: Record<string,string[]>={annual:['Ετήσια','Annual'],semester:['Εξαμηνιαία','Six-monthly'],quarter:['Τριμηνιαία','Quarterly'],other:['Άλλη','Other']}
export const fmtDate=(value: unknown,locale: string)=>formatDay(value,String(locale||'').startsWith('en')?'en':'el')

// Edit and delete of a risk or an opportunity: the record shell lists them in
// its "…" menu. The page opens read-only; «Επεξεργασία» unlocks the fields.
export function recordActions({en,canEdit,editing,isNew,onEdit,onDelete}: {en: boolean,canEdit: boolean,editing: boolean,isNew: boolean,onEdit: ()=>void,onDelete?: (()=>void)|null}){
 if(!canEdit||editing||isNew)return null
 return <>
  <ActionButton label={L(en,'Επεξεργασία','Edit')} tone="edit" onClick={onEdit}><Pencil size={16}/><span>{L(en,'Επεξεργασία','Edit')}</span></ActionButton>
  {onDelete&&<ActionButton label={L(en,'Διαγραφή','Delete')} tone="danger" onClick={onDelete}><Trash2 size={16}/><span>{L(en,'Διαγραφή','Delete')}</span></ActionButton>}
 </>
}

export function DeleteConfirm({en,title,text,onClose,onConfirm}: {en: boolean,title: string,text: ReactNode,onClose: ()=>void,onConfirm: ()=>void|Promise<void>}){
 return <ObserverDialog width="compact" title={title} onClose={onClose} footer={<DialogActions onCancel={onClose} onSave={onConfirm} saveLabel={L(en,'Διαγραφή','Delete')}/>}><p>{text}</p></ObserverDialog>
}
