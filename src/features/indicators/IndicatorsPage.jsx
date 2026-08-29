import { useMemo,useState } from 'react'
import { Activity,Calculator,CheckCircle2,Database,Pencil,Plus,Target,Trash2,TrendingUp } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { RecordActions } from '../../design-system/RecordActions'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { CAPABILITIES,can } from '../../core/permissions/roles'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { indicatorCategoryLabels } from './indicatorDefinitions'
import { calculateIndicators,indicatorMetricCatalog } from './indicatorEngine'
import { loadCustomIndicators,saveCustomIndicators,nextCustomIndicatorId,saveIndicatorOverride,markIndicatorDeleted } from './indicatorStore'
import { downloadCsv } from '../../core/export/csvExport'
import { useAuditActor } from '../../core/audit/useAuditActor'

const statusLabel={onTarget:'indicatorsRecords.onTargetStatus',attention:'indicatorsRecords.attentionStatus',context:'indicatorsRecords.contextStatus'}

export function IndicatorsPage(){
 const {language,t}=useLanguage()
 const {notify,confirm}=useFeedback()
 const {role,membership}=useTenant()
 const actor=useAuditActor()
 const [query,setQuery]=useState('')
 const [category,setCategory]=useState('all')
 const [selected,setSelected]=useState(null)
 const [editor,setEditor]=useState(null)
 const [revision,setRevision]=useState(0)
 const greek=language==='el'
 const addOns=membership?.capabilities??[]
 const customCapabilities=membership?.customCapabilities??[]
 const canManage=can(role,CAPABILITIES.MANAGE_INDICATORS,addOns,customCapabilities)
 const allRows=useMemo(()=>calculateIndicators(),
   // eslint-disable-next-line react-hooks/exhaustive-deps -- 'revision' is a deliberate cache-bust counter bumped after mutations; not read directly but must stay in deps to force recompute.
   [revision])
 const categories=[...new Set(allRows.map(x=>x.category))]
 const rows=useMemo(()=>allRows.filter(x=>`${x.titleEl} ${x.titleEn} ${x.source}`.toLowerCase().includes(query.toLowerCase())).filter(x=>category==='all'||x.category===category),[allRows,query,category])
 const attention=allRows.filter(x=>x.status==='attention').length
 const onTarget=allRows.filter(x=>x.status==='onTarget').length

 function action(value){
  if(value===UI_ACTIONS.CREATE){setEditor({mode:'create',item:null});return}
  if(value===UI_ACTIONS.PRINT){window.print();return}
  if(value===UI_ACTIONS.EXPORT){downloadCsv('limoxis-indicators.csv',[t('code'),t('indicatorsRecords.tableIndicator'),t('indicatorsRecords.tableCategory'),t('indicatorsRecords.tableResult'),t('indicatorsRecords.unitLabel'),t('indicatorsRecords.numeratorLabel'),t('indicatorsRecords.denominatorLabel'),t('indicatorsRecords.sourceDocumentationLabel'),t('indicatorsRecords.versionLabel')],rows.map(x=>[x.id,greek?x.titleEl:x.titleEn,indicatorCategoryLabels[x.category]||x.category,x.value,greek?x.unit:x.unitEn,x.numerator,x.denominator??'',x.source,x.version]));notify(t('currentListExported'),'success')}
 }

 function saveCustom(def){
  const current=loadCustomIndicators()
  const isExistingCustom=def.id&&current.some(x=>x.id===def.id)
  if(!def.id){
   saveCustomIndicators([...current,{...def,id:nextCustomIndicatorId(current),createdAt:new Date().toISOString(),createdBy:actor.name,createdById:actor.id,updatedAt:new Date().toISOString(),updatedBy:actor.name,updatedById:actor.id}])
  }else if(isExistingCustom){
   saveCustomIndicators(current.map(x=>x.id===def.id?{...x,...def,updatedAt:new Date().toISOString(),updatedBy:actor.name,updatedById:actor.id}:x))
  }else{
   saveIndicatorOverride(def.id,def,{actor})
  }
  setEditor(null);setSelected(null);setRevision(x=>x+1)
  notify(def.id?t('indicatorsRecords.indicatorUpdated'):t('indicatorsRecords.indicatorCreated'),'success')
 }

 async function deleteIndicator(item){
  const ok=await confirm({title:t('indicatorsRecords.deleteIndicatorTitle'),message:`${t('indicatorsRecords.deleteIndicatorMessagePrefix')} «${item.titleEl}» ${t('indicatorsRecords.deleteIndicatorMessageSuffix')}`,confirmLabel:t('delete'),danger:true})
  if(!ok)return
  const custom=loadCustomIndicators()
  if(custom.some(x=>x.id===item.id))saveCustomIndicators(custom.filter(x=>x.id!==item.id))
  else markIndicatorDeleted(item.id,{actor})
  setSelected(null);setRevision(x=>x+1);notify(t('indicatorsRecords.indicatorDeleted'),'success')
 }

 return <Page fill title={t('indicators')} subtitle={t('indicatorsRecords.pageSubtitle')} actions={<RecordActions actions={[UI_ACTIONS.CREATE,UI_ACTIONS.PRINT,UI_ACTIONS.EXPORT]} resourceCapability={CAPABILITIES.VIEW_INDICATORS} actionCapabilities={{[UI_ACTIONS.CREATE]:CAPABILITIES.MANAGE_INDICATORS,[UI_ACTIONS.PRINT]:CAPABILITIES.VIEW_INDICATORS,[UI_ACTIONS.EXPORT]:CAPABILITIES.VIEW_INDICATORS}} onAction={action}/>}>
  <div className="indicator-summary-strip"><Summary icon={Activity} value={allRows.length} label={t('indicatorsRecords.activeIndicators')}/><Summary icon={CheckCircle2} value={onTarget} label={t('indicatorsRecords.onTargetStatus')}/><Summary icon={Target} value={attention} label={t('indicatorsRecords.needAttentionLabel')}/><Summary icon={TrendingUp} value={allRows.filter(x=>x.calculation==='auto').length} label={t('indicatorsRecords.autoCalculationLabel')}/></div>
  <div className="workspace-fill indicator-workspace indicator-registry">
   <FilterBar query={query} onQueryChange={setQuery} placeholder={t('indicatorsRecords.searchPlaceholder')} activeAdvancedCount={category!=='all'?1:0} onClear={()=>{setQuery('');setCategory('all')}}><FilterSelect label={t('indicatorsRecords.tableCategory')} value={category} onChange={setCategory}><option value="all">{t('indicatorsRecords.allFeminine')}</option>{categories.map(x=><option key={x} value={x}>{indicatorCategoryLabels[x]||x}</option>)}</FilterSelect></FilterBar>
   <div className="surface indicator-table-surface"><div className="scroll-table"><table className="data-table sticky-table indicator-click-table"><thead><tr><th>{t('indicatorsRecords.tableIndicator')}</th><th>{t('indicatorsRecords.tableCategory')}</th><th>{t('indicatorsRecords.tableResult')}</th><th>{t('indicatorsRecords.targetLabel')}</th><th>{t('indicatorsRecords.sourceDocumentationLabel')}</th><th>{t('indicatorsRecords.statusFieldLabel')}</th></tr></thead><tbody>{rows.map(x=><tr key={x.id} tabIndex="0" role="button" onClick={()=>setSelected(x)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(x)}}}><td><strong>{greek?x.titleEl:x.titleEn}</strong><small>{x.evidence}</small></td><td>{indicatorCategoryLabels[x.category]||x.category}</td><td className="indicator-result-cell"><strong>{x.value??'—'}</strong><small>{greek?x.unit:x.unitEn}</small></td><td>{formatTarget(x)}</td><td>{x.source}</td><td><span className={`indicator-status ${x.status}`}>{t(statusLabel[x.status])}</span></td></tr>)}</tbody></table></div></div>
  </div>
  {selected&&<IndicatorDialog item={selected} greek={greek} canManage={canManage} t={t} onClose={()=>setSelected(null)} onEdit={()=>setEditor({mode:'edit',item:selected})} onDelete={()=>deleteIndicator(selected)}/>}
  {editor&&<IndicatorEditorDialog initial={editor.item} t={t} onClose={()=>setEditor(null)} onSave={saveCustom}/>}
 </Page>
}

function formatTarget(x){if(x.target==null)return '—';return `${x.direction==='higher'?'≥':x.direction==='lower'?'≤':''} ${x.target}${x.unit==='%'?'%':''}`}
function Summary({icon:Icon,value,label}){return <div><span className="indicator-summary-icon"><Icon size={15}/></span><strong>{value}</strong><small>{label}</small></div>}

function IndicatorDialog({item,greek,canManage,t,onClose,onEdit,onDelete}){
 const metricLabel=key=>indicatorMetricCatalog.find(x=>x.key===key)?.label||key||'—'
 return <ObserverDialog eyebrow={t('indicatorsRecords.tableIndicator')} title={greek?item.titleEl:item.titleEn} subtitle={t('indicatorsRecords.dialogSubtitle')} width="wide" onClose={onClose} footer={<>
   {canManage&&<div className="record-inline-actions indicator-dialog-icon-actions"><button type="button" onClick={onEdit} title={t('indicatorsRecords.editIndicator')} aria-label={t('indicatorsRecords.editIndicator')}><Pencil size={16}/></button><button type="button" className="danger" onClick={onDelete} title={t('indicatorsRecords.deleteIndicatorTitle')} aria-label={t('indicatorsRecords.deleteIndicatorTitle')}><Trash2 size={16}/></button></div>}
   
   <Button onClick={onClose}>{t('close')}</Button>
  </>}>
  <div className="indicator-view-form">
   <div className="indicator-view-grid">
    <div className="indicator-view-field entry-span-2"><span>{t('indicatorsRecords.indicatorNameLabel')}</span><strong>{greek?item.titleEl:item.titleEn}</strong></div>
    <div className="indicator-view-field"><span>{t('indicatorsRecords.tableCategory')}</span><strong>{indicatorCategoryLabels[item.category]||item.category}</strong></div>
    <div className="indicator-view-field"><span>{t('indicatorsRecords.unitLabel')}</span><strong>{greek?item.unit:item.unitEn}</strong></div>
   </div>

   <div className="indicator-view-section">
    <div className="indicator-view-section-head"><Calculator size={15}/><div><strong>{item.calculation==='manual'?t('indicatorsRecords.manualIndicatorTitle'):t('indicatorsRecords.autoIndicatorTitle')}</strong><span>{item.calculation==='manual'?t('indicatorsRecords.manualIndicatorDesc'):t('indicatorsRecords.autoIndicatorDesc')}</span></div></div>
    {item.calculation==='auto'?<div className="indicator-view-grid">
      <div className="indicator-view-field"><span>{t('indicatorsRecords.numeratorLabel')}</span><strong>{metricLabel(item.numerator)}</strong><small>{item.numerator??'—'}</small></div>
      <div className="indicator-view-field"><span>{t('indicatorsRecords.denominatorLabel')}</span><strong>{item.denominator?metricLabel(item.denominator):t('indicatorsRecords.noDenominator')}</strong><small>{item.denominator||'—'}</small></div>
      <div className="indicator-view-field"><span>{t('indicatorsRecords.multiplierLabel')}</span><strong>{item.multiplier}</strong></div>
      <div className="indicator-view-preview"><span>{t('indicatorsRecords.currentCalculationLabel')}</span><strong>{item.numerator??'—'}{item.denominator?` ÷ ${item.denominator}`:''} × {item.multiplier}</strong></div>
     </div>:<div className="indicator-view-grid">
      <div className="indicator-view-field"><span>{t('indicatorsRecords.currentValueLabel')}</span><strong>{item.value??'—'} {greek?item.unit:item.unitEn}</strong></div>
      <div className="indicator-view-field"><span>{t('indicatorsRecords.sourceDocumentationLabel')}</span><strong>{item.source}</strong></div>
     </div>}
   </div>

   <div className="indicator-view-grid">
    <div className="indicator-view-field"><span>{t('indicatorsRecords.targetLabel')}</span><strong>{formatTarget(item)}</strong></div>
    <div className="indicator-view-field"><span>{t('indicatorsRecords.desiredDirectionLabel')}</span><strong>{item.direction==='higher'?t('indicatorsRecords.directionHigherBetter'):item.direction==='lower'?t('indicatorsRecords.directionLowerBetter'):t('indicatorsRecords.directionNoTarget')}</strong></div>
    <div className="indicator-view-field"><span>{t('indicatorsRecords.currentValueLabel')}</span><strong>{item.value??'—'}</strong><small>{greek?item.unit:item.unitEn}</small></div>
    <div className="indicator-view-field"><span>{t('indicatorsRecords.statusFieldLabel')}</span><strong><span className={`indicator-status ${item.status}`}>{t(statusLabel[item.status])}</span></strong></div>
   </div>

   <div className="indicator-view-note"><Database size={15}/><div><strong>{t('indicatorsRecords.dataSourceLabel')}</strong><span>{item.source} · {item.evidence}</span></div></div>
  </div>
 </ObserverDialog>
}

function IndicatorEditorDialog({initial,t,onClose,onSave}){
 const [draft,setDraft]=useState(initial?{...initial,target:initial.target??'',manualValue:initial.manualValue??'',denominator:initial.denominator??''}:{titleEl:'',category:'prevention',unit:'%',source:'',calculation:'auto',numerator:'',denominator:'',multiplier:100,target:'',direction:'higher',manualValue:''})
 const set=(k,v)=>setDraft(x=>({...x,[k]:v}))
 const sourceForMetric=key=>indicatorMetricCatalog.find(x=>x.key===key)?.source||''
 const valid=draft.titleEl?.trim()&&(draft.calculation==='manual'||draft.numerator)
 function save(){
  if(!valid)return
  const source=draft.calculation==='auto'?(sourceForMetric(draft.numerator)||draft.source||'Limoxis'):(draft.source||t('indicatorsRecords.manualSourceFallback'))
  onSave({...draft,id:initial?.id||null,titleEl:draft.titleEl.trim(),titleEn:draft.titleEn||draft.titleEl.trim(),source,numerator:draft.calculation==='auto'?draft.numerator:'manual_value',denominator:draft.calculation==='auto'?(draft.denominator||null):null,multiplier:Number(draft.multiplier||1),version:initial?.version||'custom-1',target:draft.target===''?null:Number(draft.target),manualValue:draft.calculation==='manual'?Number(draft.manualValue||0):null,active:true,createdAt:initial?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()})
 }
 return <ObserverDialog title={initial?t('indicatorsRecords.editIndicator'):t('indicatorsRecords.newIndicatorTitle')} subtitle={initial?t('indicatorsRecords.editIndicatorSubtitle'):t('indicatorsRecords.newIndicatorSubtitle')} width="wide" onClose={onClose} footer={<DialogActions onCancel={onClose} onSave={save} saveLabel={initial?t('save'):t('indicatorsRecords.createIndicatorLabel')} disabled={!valid}/>}>
  <div className="indicator-create-form">
   <label><span>{t('indicatorsRecords.indicatorNameRequired')}</span><input value={draft.titleEl} onChange={e=>set('titleEl',e.target.value)}/></label>
   <div className="indicator-create-grid"><label><span>{t('indicatorsRecords.tableCategory')}</span><select value={draft.category} onChange={e=>set('category',e.target.value)}><option value="surveillance">{t('surveillance')}</option><option value="prevention">{t('prevention')}</option><option value="workforce">{t('workforce')}</option><option value="quality">{t('indicatorsRecords.qualityCategory')}</option><option value="other">{t('other')}</option></select></label><label><span>{t('indicatorsRecords.unitLabel')}</span><input value={draft.unit} onChange={e=>set('unit',e.target.value)} placeholder={t('indicatorsRecords.unitPlaceholder')}/></label></div>
   <div className="indicator-create-mode"><button type="button" className={draft.calculation==='auto'?'active':''} onClick={()=>set('calculation','auto')}><Calculator size={15}/><div><strong>{t('indicatorsRecords.autoModeLabel')}</strong><span>{t('indicatorsRecords.autoModeDesc')}</span></div></button><button type="button" className={draft.calculation==='manual'?'active':''} onClick={()=>set('calculation','manual')}><Plus size={15}/><div><strong>{t('indicatorsRecords.manualModeLabel')}</strong><span>{t('indicatorsRecords.manualModeDesc')}</span></div></button></div>
   {draft.calculation==='auto'?<><div className="indicator-create-grid"><label><span>{t('indicatorsRecords.numeratorRequired')}</span><select value={draft.numerator} onChange={e=>{set('numerator',e.target.value);set('source',sourceForMetric(e.target.value))}}><option value="">{t('indicatorsRecords.selectMetricPlaceholder')}</option>{indicatorMetricCatalog.map(x=><option key={x.key} value={x.key}>{x.label} · {x.source}</option>)}</select></label><label><span>{t('indicatorsRecords.denominatorLabel')}</span><select value={draft.denominator||''} onChange={e=>set('denominator',e.target.value)}><option value="">{t('indicatorsRecords.noDenominator')}</option>{indicatorMetricCatalog.map(x=><option key={x.key} value={x.key}>{x.label} · {x.source}</option>)}</select></label></div><div className="indicator-create-grid"><label><span>{t('indicatorsRecords.multiplierLabel')}</span><input type="number" value={draft.multiplier} onChange={e=>set('multiplier',e.target.value)}/></label><div className="indicator-create-preview"><span>{t('indicatorsRecords.formulaTypeLabel')}</span><strong>{draft.numerator||t('indicatorsRecords.numeratorLabel')}{draft.denominator?` ÷ ${draft.denominator}`:''} × {draft.multiplier||1}</strong></div></div></>:<div className="indicator-create-grid"><label><span>{t('indicatorsRecords.currentValueLabel')}</span><input type="number" value={draft.manualValue} onChange={e=>set('manualValue',e.target.value)}/></label><label><span>{t('indicatorsRecords.sourceDocumentationLabel')}</span><input value={draft.source} onChange={e=>set('source',e.target.value)} placeholder={t('indicatorsRecords.sourcePlaceholderExample')}/></label></div>}
   <div className="indicator-create-grid"><label><span>{t('indicatorsRecords.targetLabel')}</span><input type="number" value={draft.target} onChange={e=>set('target',e.target.value)} placeholder={t('optional')}/></label><label><span>{t('indicatorsRecords.desiredDirectionLabel')}</span><select value={draft.direction} onChange={e=>set('direction',e.target.value)}><option value="higher">{t('indicatorsRecords.directionHigherBetter')}</option><option value="lower">{t('indicatorsRecords.directionLowerBetter')}</option><option value="context">{t('indicatorsRecords.directionNoTarget')}</option></select></label></div>
  </div>
 </ObserverDialog>
}
