import { useMemo } from 'react'
import { Info } from 'lucide-react'
import { RegistryTable } from '../../design-system/RegistryTable'
import { FilterSelect } from '../../design-system/FilterBar'
import { EODY_FOOTNOTES,eodyEntryByName } from '../reporting/eodyCatalogue'

const DEADLINE_SHORT={immediate:'eodyFilterImmediate','24h':'eodyFilter24h',weekly:'eodyFilterWeekly'}
const FILTERS=[['all','eodyFilterAll'],['immediate','eodyFilterImmediate'],['24h','eodyFilter24h'],['weekly','eodyFilterWeekly']]

// Splits the platform library rows into the 57 catalogue entries (in ΕΟΔΥ order) and the earlier rows
// that are not in the catalogue; earlier rows are listed only while they are still active.
export function splitNotifiableRows(rows=[],{deadline='all',query=''}={}){
 const text=query.trim().toLowerCase()
 const match=row=>!text||`${row[0]} ${row[1]} ${row[2]?.code||''}`.toLowerCase().includes(text)
 const catalogue=[],legacy=[]
 for(const row of rows){const entry=eodyEntryByName(row[0]);if(entry)catalogue.push({row,entry});else if(row[2]?.active!==false)legacy.push(row)}
 catalogue.sort((a,b)=>a.entry.n-b.entry.n)
 return {
  catalogue:catalogue.filter(({row,entry})=>(deadline==='all'||entry.deadline===deadline)&&match(row)),
  legacy:deadline==='all'?legacy.filter(match):[],
 }
}

// «Προθεσμία δήλωσης»: a choice of the library's «Filters».
export function EodyDeadlineFilter({value,onChange,t}){
 return <FilterSelect label={t('librariesPanel.eodyFilterLabel')} value={value} onChange={onChange}>{FILTERS.map(([key,label])=><option key={key} value={key}>{t(`librariesPanel.${label}`)}</option>)}</FilterSelect>
}

export function NotifiableDiseasesTable({rows,query,deadline='all',language,t,loading,onOpen}){
 const {catalogue,legacy}=useMemo(()=>splitNotifiableRows(rows,{deadline,query}),[rows,deadline,query])
 const en=language==='en'
 const statusCell=meta=>meta.active===false?<span className="status-badge temporary">{t('librariesPanel.inactiveStatus')}</span>:<span className="eody-status">{t('librariesPanel.activeStatus')}</span>
 return <div className="eody-library">
  <RegistryTable
   wrapperClassName="table-wrap scroll-table"
   className="eody-library-table"
   columns={[{key:'name',label:t('librariesPanel.eodyDisease')},{key:'deadline',label:t('librariesPanel.eodyDeadline'),className:'eody-col-deadline',style:{width:130}},{key:'note',label:t('librariesPanel.eodyNote'),className:'eody-col-note',style:{width:116}}]}
   rows={catalogue}
   rowKey={({row,entry})=>`eody-${entry.n}-${row[2]?.id||''}`}
   rowProps={({row})=>({className:`registry-row-clickable${row[2]?.active===false?' eody-row-inactive':''}`,tabIndex:0,onClick:()=>onOpen?.(row),onKeyDown:event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onOpen?.(row)}}})}
   renderRow={({row,entry})=>{const meta=row[2]||{};return <>
    <td title={`${entry.el} — ${entry.en}`}><strong>{en?entry.en:entry.el}</strong><span className="eody-en">{en?entry.el:entry.en}</span>{meta.active===false&&<span className="status-badge temporary">{t('librariesPanel.inactiveStatus')}</span>}</td>
    <td className={entry.deadline==='immediate'?'eody-deadline eody-deadline-immediate':'eody-deadline'}>{t(`librariesPanel.${DEADLINE_SHORT[entry.deadline]}`)}</td>
    <td className="eody-note">{entry.notes.length?<span className="eody-note-mark" tabIndex={0} title={entry.notes.map(key=>EODY_FOOTNOTES[key][en?'en':'el']).join(' ')}><Info size={13} aria-hidden="true"/>{t('librariesPanel.eodyNote')}</span>:<span className="eody-note-none">—</span>}</td></>}}
  />
  {legacy.length>0&&<details className="eody-legacy">
   <summary>{t('librariesPanel.legacyEntries')} ({legacy.length})</summary>
   <p className="eody-legacy-note">{t('librariesPanel.legacyEntriesNote')}</p>
   <ul className="eody-legacy-list">{legacy.map(row=>{const meta=row[2]||{};return <li key={`legacy-${meta.id||row[0]}`}><strong>{en?row[1]:row[0]}</strong><span className="eody-legacy-code">{meta.code||'—'}</span>{statusCell(meta)}<button type="button" className="eody-legacy-open" onClick={()=>onOpen?.(row)}>{en?'Open':'Άνοιγμα'}</button></li>})}</ul>
  </details>}
  {!loading&&catalogue.length===0&&legacy.length===0&&<div className="inline-empty">{t('noData')}</div>}
 </div>
}
