import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { CalendarDays, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { RegistryTable } from '../../design-system/RegistryTable'
import { FilterBar, FilterDate, FilterSelect } from '../../design-system/FilterBar'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { demoLibrarySeed, demoPatientDayPeriods } from './managementData'
import { ManualDateField } from '../../design-system/ManualDateField'
import { loadDepartments, setDepartmentPatientDays } from './departmentsService'
import { MultiSelect } from '../../design-system/MultiSelect'
import { createPatientDayPeriod, loadPatientDayPeriods, removePatientDayPeriod, updatePatientDayPeriod } from './patientDayPeriodsCloudService'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import type { PatientDayPeriod } from './managementTypes'
import type { LanguageContextValue } from '../../core/i18n/languageTypes'

// What grouping reads of a row: its period and whether it is the hospital total.
type PeriodRow = Pick<PatientDayPeriod, 'from' | 'to' | 'scope'>
type Period<T extends PeriodRow = PatientDayPeriod> = { key: string, from: string, to: string, hospital: T|null, departments: T[] }
// A line of the list: a year's heading, or one of its periods.
type YearRow = { heading: string, count: number, key?: undefined } | (Period & { heading?: undefined })
// A line of a period: the whole hospital, then each department.
type PeriodLine = { id: string, value?: number | null, kind?: string, label?: string, departmentEl?: string, departmentEn?: string }
type Dept = { id: string, name: string, nameEn: string, tracked: boolean, separate?: boolean }
type Draft = { duration: string, year: number, month: number, quarter: number, from: string, to: string, values: Record<string,string>, separate: string[] }
type Editor = { mode: string, base: Period|null, draft: Draft }
type PeriodKind = { kind: string, year?: number, month?: number, quarter?: number }

// Patient days: the database keeps one row per department (or the hospital total) and period; the screen shows one
// line per period and enters all the departments of a period in one form. A period is free (from–to): a month,
// a quarter, a year or any range of days.
const HOSPITAL='hospital'
// The demo rows name the department (the demo departments use the name as id); the cloud rows carry its id.
const deptKey=(row: PatientDayPeriod)=>row.departmentId||row.departmentEl
const pad=(n: number)=>String(n).padStart(2,'0')
const lastDay=(y: number,m: number)=>new Date(Date.UTC(y,m,0)).getUTCDate()
const iso=(y: number,m: number,d: number)=>`${y}-${pad(m)}-${pad(d)}`
const parts=(v: string)=>v.split('-').map(Number)
// What the period is: a calendar month, a quarter, a year, or another range.
export function periodKind(from: string|null|undefined,to: string|null|undefined): PeriodKind{
  if(!from||!to)return {kind:'custom'}
  const [fy,fm,fd]=parts(from),[ty,tm,td]=parts(to)
  if(fd!==1||fy!==ty||td!==lastDay(ty,tm))return {kind:'custom'}
  if(fm===tm)return {kind:'month',year:fy,month:fm}
  if(fm===1&&tm===12)return {kind:'year',year:fy}
  if((fm-1)%3===0&&tm===fm+2)return {kind:'quarter',year:fy,quarter:(fm-1)/3+1}
  return {kind:'custom'}
}
export function periodRange(draft: Partial<Pick<Draft, 'duration' | 'year' | 'month' | 'quarter' | 'from' | 'to'>>){
  const y=Number(draft.year)
  if(draft.duration==='month'){const m=Number(draft.month);return {from:iso(y,m,1),to:iso(y,m,lastDay(y,m))}}
  if(draft.duration==='quarter'){const m=(Number(draft.quarter)-1)*3+1;return {from:iso(y,m,1),to:iso(y,m+2,lastDay(y,m+2))}}
  if(draft.duration==='year')return {from:iso(y,1,1),to:iso(y,12,31)}
  return {from:draft.from,to:draft.to}
}
export function groupPeriods<T extends PeriodRow>(rows: T[]){
  const map=new Map<string,Period<T>>()
  for(const row of rows){const key=`${row.from}|${row.to}`;if(!map.has(key))map.set(key,{key,from:row.from,to:row.to,hospital:null,departments:[]});const group=map.get(key)!;if(row.scope===HOSPITAL)group.hospital=row;else group.departments.push(row)}
  return [...map.values()].sort((a,b)=>b.from.localeCompare(a.from)||b.to.localeCompare(a.to))
}
function previousMonth(){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-1);return {year:d.getFullYear(),month:d.getMonth()+1}}

export function BedDaysPanel(){
  const {language,locale,t}=useLanguage(); const {notify,confirm}=useFeedback(); const {tenant,isDemo}=useTenant();
  const [rows,setRows]=useState<PatientDayPeriod[]>(isDemo?demoPatientDayPeriods:[]); const [departments,setDepartments]=useState<Dept[]>(isDemo?demoLibrarySeed.departments.map(([el,en])=>({id:el,name:el,nameEn:en,tracked:true})):[]); const [loading,setLoading]=useState(!isDemo); const [editor,setEditor]=useState<Editor|null>(null); const [selectedKey,setSelectedKey]=useState<string|null>(null); const [busy,setBusy]=useState(false); const [filters,setFilters]=useState({from:'',to:'',department:'all'});
  const fmt=(v: string|null|undefined)=>v?new Intl.DateTimeFormat(locale).format(new Date(`${v}T12:00:00`)):'—';
  const monthName=(m: number|undefined)=>t(`bedDaysPanel.m${m}`)
  const periodLabel=(from: string,to: string)=>{const p=periodKind(from,to);if(p.kind==='month')return `${monthName(p.month)} ${p.year}`;if(p.kind==='quarter')return `${t(`bedDaysPanel.q${p.quarter}`)} ${p.year}`;if(p.kind==='year')return String(p.year);if(from&&to&&from.slice(0,7)===to.slice(0,7)&&from.endsWith('-01')){const [y,m]=parts(from);return `${monthName(m)} ${y} · ${t('bedDaysPanel.until')} ${new Intl.DateTimeFormat(locale,{day:'numeric',month:'numeric'}).format(new Date(`${to}T12:00:00`))}`}return `${fmt(from)} – ${fmt(to)}`}
  const deptName=(row: Pick<PeriodLine, 'departmentEl' | 'departmentEn'>)=>language==='el'?row.departmentEl:(row.departmentEn||row.departmentEl)
  const num=(v: unknown)=>Number(v).toLocaleString(locale)
  const periods=useMemo(()=>groupPeriods(rows),[rows])
  const filtered=useMemo(()=>periods.filter(p=>{if(filters.from&&p.to<filters.from)return false;if(filters.to&&p.from>filters.to)return false;if(filters.department!=='all'&&!p.departments.some(d=>deptKey(d)===filters.department))return false;return true}),[periods,filters])
  const selected=useMemo(()=>periods.find(p=>p.key===selectedKey)||null,[periods,selectedKey])
  // By year (owner, 8/11/2026): this year open, the earlier ones closed, each a click away.
  const [openYears,setOpenYears]=useState(()=>new Set([String(new Date().getFullYear())]))
  const toggleYear=(year: string)=>setOpenYears(current=>{const next=new Set(current);if(next.has(year))next.delete(year);else next.add(year);return next})
  const yearRows=useMemo(()=>{const years=new Map<string,Period[]>();for(const period of filtered){const year=String(period.from).slice(0,4);if(!years.has(year))years.set(year,[]);years.get(year)!.push(period)}return [...years].sort((a,b)=>b[0].localeCompare(a[0])).flatMap(([year,list]): YearRow[]=>[{heading:year,count:list.length},...(openYears.has(year)?list:[])])},[filtered,openYears])

  useEffect(()=>{if(isDemo){setRows(demoPatientDayPeriods);setDepartments(demoLibrarySeed.departments.map(([el,en])=>({id:el,name:el,nameEn:en,tracked:true})));setLoading(false);return}if(!tenant?.id)return;let active=true;setLoading(true);Promise.all([loadPatientDayPeriods(tenant.id),loadDepartments(tenant.id)]).then(([periods,depts])=>{if(active){setRows(periods);setDepartments(depts.map(d=>({id:d.id,name:d.name,nameEn:d.name,separate:Boolean(d.patient_days_separate),tracked:Boolean(d.patient_days_tracked)})))}}).catch(error=>{if(active)notify(error?.message||t('managementPanel.loadFailed'),'error')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[isDemo,tenant?.id,notify,t])

  function openCreate(){const pm=previousMonth();setEditor({mode:'create',base:null,draft:{duration:'month',year:pm.year,month:pm.month,quarter:Math.ceil(pm.month/3),from:'',to:'',values:{},separate:departments.filter(d=>d.separate).map(d=>d.id)}})}
  function openEdit(period: Period){const p=periodKind(period.from,period.to);const values: Record<string,string>={};for(const d of period.departments)values[deptKey(d)]=String(d.value??'');if(period.hospital)values[HOSPITAL]=String(period.hospital.value??'');const today=new Date();setEditor({mode:'edit',base:period,draft:{duration:p.kind,year:p.year||today.getFullYear(),month:p.month||1,quarter:p.quarter||1,from:period.from,to:period.to,values,separate:departments.filter(d=>d.separate).map(d=>d.id)}})}
  async function save(){
    if(!editor)return
    const {draft,base}=editor;const {from,to}=periodRange(draft)
    if(!from||!to||to<from){notify(t('completeRequiredFields'),'danger');return}
    // Only the departments that keep patient days: a department taken off the list keeps no figure for the period.
    const trackedIds=new Set([...(draft.separate||[]),...departments.filter(d=>String(draft.values[d.id]??'').trim()!=='').map(d=>d.id)])
    const lines: {id: string,dept: Dept|null,off?: boolean}[]=[...departments.map(d=>({id:d.id,dept:d,off:!trackedIds.has(d.id)})),{id:HOSPITAL,dept:null}]
    if(!lines.some(l=>String(draft.values[l.id]??'')!=='')){notify(t('bedDaysPanel.noValues'),'danger');return}
    // A new period that already exists adds to it, so a period never has two rows for one department.
    const target=base||periods.find(p=>p.from===from&&p.to===to)||null
    const existingOf=(id: string)=>target?(id===HOSPITAL?target.hospital:target.departments.find(d=>deptKey(d)===id))||null:null
    setBusy(true)
    try{
      let next=[...rows]
      for(const line of lines){
        const raw=line.off?'':String(draft.values[line.id]??'').trim();const existing=existingOf(line.id)
        const record={from,to,scope:line.dept?'department':HOSPITAL,departmentId:line.dept?.id||'',departmentEl:line.dept?.name||'',departmentEn:line.dept?.nameEn||line.dept?.name||'',value:raw,source:'manual'}
        if(raw===''){if(existing){if(!isDemo)await removePatientDayPeriod(tenant!.id,existing.id);next=next.filter(r=>r.id!==existing.id)}continue}
        if(existing){if(existing.from===from&&existing.to===to&&String(existing.value)===raw)continue;const saved=isDemo?{...existing,...record,value:Number(raw)}:await updatePatientDayPeriod(tenant!.id,existing.id,record);next=next.map(r=>r.id===existing.id?saved:r)}
        else{const saved=isDemo?{id:`pd-${Date.now()}-${line.id}`,...record,value:Number(raw)}:await createPatientDayPeriod(tenant!.id,record);next=[saved,...next]}
      }
      // Which departments keep patient days and which of them are counted apart from the hospital's total (a setting of
      // the department, not of the period).
      const separate=new Set(draft.separate||[])
      const changed=departments.filter(d=>Boolean(d.tracked)!==trackedIds.has(d.id)||Boolean(d.separate)!==separate.has(d.id))
      if(!isDemo)for(const d of changed)await setDepartmentPatientDays(tenant!.id,d.id,{tracked:trackedIds.has(d.id),separate:separate.has(d.id)})
      if(changed.length)setDepartments(current=>current.map(d=>({...d,tracked:trackedIds.has(d.id),separate:separate.has(d.id)})))
      setRows(next);setSelectedKey(`${from}|${to}`);setEditor(null);notify(t(editor.mode==='edit'?'patientDaysUpdated':'patientDaysSaved'),'success')
    }catch(error){notify((error as Error)?.message||t('managementPanel.saveFailed'),'error')}finally{setBusy(false)}
  }
  async function removePeriod(period: Period){const ok=await confirm({message:t('bedDaysPanel.deletePeriodConfirm'),danger:true,confirmLabel:t('delete')});if(!ok)return;const ids=[...period.departments,...(period.hospital?[period.hospital]:[])].map(r=>r.id);try{if(!isDemo)for(const id of ids)await removePatientDayPeriod(tenant!.id,id);setRows(current=>current.filter(r=>!ids.includes(r.id)));setSelectedKey(null);notify(t('actionCompleted'),'success')}catch(error){notify((error as Error)?.message||t('managementPanel.saveFailed'),'error')}}
  const advancedCount=(filters.from?1:0)+(filters.to?1:0)+(filters.department!=='all'?1:0)

  if(editor)return <section className="management-section management-scroll-section"><PeriodEditor t={t} language={language} departments={departments} editor={editor} setEditor={setEditor} monthName={monthName} periodLabel={periodLabel} busy={busy} onClose={()=>setEditor(null)} onSave={save}/></section>

  if(selected)return <section className="management-section management-scroll-section"><EntityRecordShell className="bed-days-record-shell workspace-fill" avatar={<CalendarDays size={19}/>} eyebrow={t('patientDays')} title={periodLabel(selected.from,selected.to)} subtitle={`${fmt(selected.from)} – ${fmt(selected.to)}`} onBack={()=>setSelectedKey(null)} backLabel={t('patientDays')}
    headerActions={<div className="row-actions"><Button recordMenu variant="secondary" onClick={()=>openEdit(selected)}><Pencil size={15}/>{t('bedDaysPanel.editPeriodMenu')}</Button><Button recordMenu variant="secondary" onClick={()=>removePeriod(selected)}><Trash2 size={15}/>{t('bedDaysPanel.deletePeriod')}</Button></div>}>
    <RecordTabPanel title={t('bedDaysPanel.periodTitle')}><RegistryTable bare sortable={false} wrapperClassName="bed-days-table-wrap" columns={[{key:'department',label:t('department')},{key:'value',label:<span className="bed-days-num-head">{t('patientDays')}</span>,className:'bed-days-num'}]}
      rows={[{id:'__total',label:t('wholeHospital'),value:selected.hospital?.value,kind:'bed-days-total'},...selected.departments] as PeriodLine[]} rowKey={row=>row.id} rowProps={row=>({className:row.kind||undefined})}
      renderRow={row=><><td>{row.kind?row.label:deptName(row)}</td><td className="bed-days-num">{row.value==null?'—':num(row.value)}</td></>}/></RecordTabPanel>
  </EntityRecordShell></section>

  return <section className="management-section management-scroll-section"><div className="bed-days-panel workspace-fill"><div className="section-toolbar"><div><h2>{t('patientDays')}</h2></div><div className="row-actions bed-days-actions"><FilterBar activeAdvancedCount={advancedCount} onClear={()=>setFilters({from:'',to:'',department:'all'})} advanced={<><FilterDate label={t('periodFrom')} value={filters.from} onChange={value=>setFilters(c=>({...c,from:value}))}/><FilterDate label={t('periodTo')} value={filters.to} onChange={value=>setFilters(c=>({...c,to:value}))}/></>}><FilterSelect label={t('department')} value={filters.department} onChange={value=>setFilters(c=>({...c,department:value}))}><option value="all">{t('allDepartments')}</option>{departments.map(d=><option key={d.id} value={d.id}>{language==='el'?d.name:(d.nameEn||d.name)}</option>)}</FilterSelect></FilterBar><Button onClick={openCreate}><Plus size={15}/>{t('bedDaysPanel.newPeriod')}</Button></div></div>{loading&&<TableSkeleton/>}<RegistryTable
  wrapperClassName="bed-days-table-wrap" className="bed-days-list-table" sortable={false}
  columns={[{key:'period',label:t('period')},{key:'hospital',label:t('wholeHospital')},{key:'departments',label:t('bedDaysPanel.separateLabel')}]}
  rows={yearRows}
  rowKey={row=>row.heading?`y-${row.heading}`:(row as Period).key}
  rowProps={row=>row.heading?{className:'bed-days-year-row'}:({className:'clickable-row',onClick:()=>setSelectedKey((row as Period).key)})}
  renderRow={row=>row.heading?<td colSpan={3}><button type="button" className="bed-days-year-toggle" aria-expanded={openYears.has(row.heading)} onClick={()=>toggleYear(row.heading)}>{openYears.has(row.heading)?<ChevronDown size={15} aria-hidden="true"/>:<ChevronRight size={15} aria-hidden="true"/>}<strong>{row.heading}</strong><span>{t('bedDaysPanel.periodsCount').replace('{n}',String(row.count))}</span></button></td>:<><td><strong>{periodLabel((row as Period).from,(row as Period).to)}</strong></td><td><strong>{(row as Period).hospital?num((row as Period).hospital!.value):'—'}</strong></td><td>{(row as Period).departments.length?(row as Period).departments.map(d=>`${deptName(d)} ${num(d.value)}`).join(' · '):'—'}</td></>}
/>{!loading&&filtered.length===0&&<div className="inline-empty">{t('noPatientDaysFound')}</div>}</div></section>
}

function PeriodEditor({t,language,departments,editor,setEditor,monthName,periodLabel,busy,onClose,onSave}: {t: LanguageContextValue['t'],language: string,departments: Dept[],editor: Editor,setEditor: Dispatch<SetStateAction<Editor|null>>,monthName: (m: number)=>string,periodLabel: (from: string,to: string)=>string,busy: boolean,onClose: ()=>void,onSave: ()=>void}){
  const {draft}=editor
  const set=(key: string,value: unknown)=>setEditor(c=>({...c!,draft:{...c!.draft,[key]:value}}))
  const setValue=(id: string,value: string)=>setEditor(c=>({...c!,draft:{...c!.draft,values:{...c!.draft.values,[id]:value.replace(/\D/g,'')}}}))
  const thisYear=new Date().getFullYear(); const years: number[]=[]; for(let y=thisYear+1;y>=thisYear-6;y--)years.push(y)
  const separate=new Set(draft.separate||[])
  const name=(d: Dept)=>language==='el'?d.name:(d.nameEn||d.name)
  // The departments calculated apart (owner, 8/11/2026: the hospital's total and only those), and any that already has a
  // figure in the period.
  // The period the form is about, in the title (owner, 8/11/2026).
  const chosen=periodRange(draft)
  const shown=departments.filter(d=>separate.has(d.id)||String(draft.values[d.id]??'')!=='')
  // Every figure is a field like the period's, on the same columns (owner, 8/11/2026): the hospital's total right under
  // the year, the departments calculated apart under it.
  const field=(id: string,label: string,strong?: boolean,extra='')=><label key={id} className={`field bed-days-field${strong?' bed-days-field-total':''}${extra}`}><span>{label}</span><input className="input" inputMode="numeric" value={draft.values[id]??''} onChange={e=>setValue(id,e.target.value)}/></label>
  const yearColumn=draft.duration==='year'?2:3
  return <EntityRecordShell className="bed-days-record-shell workspace-fill" avatar={<CalendarDays size={19}/>} title={`${t(editor.mode==='edit'?'bedDaysPanel.editPeriod':'bedDaysPanel.newPeriod')}${chosen.from&&chosen.to?` · ${periodLabel(chosen.from,chosen.to)}`:''}`} subtitle={t('bedDaysPanel.entryHint')} onBack={onClose} backLabel={t('patientDays')}>
    <RecordTabPanel title={t('period')} footer={<div className="inline-edit-footer"><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><SaveButton disabled={busy} loading={busy} onClick={onSave}>{t('save')}</SaveButton></div>}>
      <div className="bed-days-editor">
        <div className="bed-days-period-fields bed-days-grid">
          <label className="field"><span>{t('bedDaysPanel.duration')}</span><select className="input" value={draft.duration} onChange={e=>set('duration',e.target.value)}><option value="month">{t('bedDaysPanel.month')}</option><option value="quarter">{t('bedDaysPanel.quarter')}</option><option value="year">{t('bedDaysPanel.year')}</option><option value="custom">{t('bedDaysPanel.custom')}</option></select></label>
          {draft.duration==='month'&&<label className="field"><span>{t('bedDaysPanel.month')}</span><select className="input" value={draft.month} onChange={e=>set('month',Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{monthName(i+1)}</option>)}</select></label>}
          {draft.duration==='quarter'&&<label className="field"><span>{t('bedDaysPanel.quarter')}</span><select className="input" value={draft.quarter} onChange={e=>set('quarter',Number(e.target.value))}>{[1,2,3,4].map(q=><option key={q} value={q}>{t(`bedDaysPanel.q${q}`)}</option>)}</select></label>}
          {draft.duration!=='custom'&&<label className="field"><span>{t('bedDaysPanel.year')}</span><select className="input" value={draft.year} onChange={e=>set('year',Number(e.target.value))}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></label>}
          {draft.duration==='custom'&&<><ManualDateField className="field" label={t('periodFrom')} value={draft.from} onChange={v=>set('from',v)}/><ManualDateField className="field" label={t('periodTo')} value={draft.to} onChange={v=>set('to',v)}/></>}
          {field(HOSPITAL,t('wholeHospital'),true,` bed-days-under-col-${yearColumn}`)}
          <div className="bed-days-separate"><MultiSelect label={t('bedDaysPanel.separateLabel')} tags options={departments.map(d=>({value:d.id,label:name(d)}))} selected={draft.separate||[]} onChange={value=>set('separate',value)} placeholder={t('bedDaysPanel.separateNone')}/><small>{t('bedDaysPanel.separateHint')}</small></div>
          {shown.map(d=>field(d.id,name(d)))}
        </div>
      </div>
    </RecordTabPanel>
  </EntityRecordShell>
}
