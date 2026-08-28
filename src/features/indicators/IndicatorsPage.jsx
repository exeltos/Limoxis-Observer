import { useMemo,useState } from 'react'
import { Activity,Calculator,CheckCircle2,Database,Info,Plus,Target,TrendingUp } from 'lucide-react'
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
import { loadCustomIndicators,saveCustomIndicators,nextCustomIndicatorId } from './indicatorStore'
import { downloadCsv } from '../../core/export/csvExport'

const statusLabel={onTarget:'Εντός στόχου',attention:'Χρειάζεται προσοχή',context:'Παρακολούθηση'}

export function IndicatorsPage(){
 const {language,t}=useLanguage()
 const {notify,confirm}=useFeedback()
 const {role,membership}=useTenant()
 const [query,setQuery]=useState('')
 const [category,setCategory]=useState('all')
 const [selected,setSelected]=useState(null)
 const [editor,setEditor]=useState(null)
 const [revision,setRevision]=useState(0)
 const greek=language==='el'
 const addOns=membership?.capabilities??[]
 const customCapabilities=membership?.customCapabilities??[]
 const canManage=can(role,CAPABILITIES.MANAGE_INDICATORS,addOns,customCapabilities)
 const allRows=useMemo(()=>calculateIndicators(),[revision])
 const categories=[...new Set(allRows.map(x=>x.category))]
 const rows=useMemo(()=>allRows.filter(x=>`${x.titleEl} ${x.titleEn} ${x.source}`.toLowerCase().includes(query.toLowerCase())).filter(x=>category==='all'||x.category===category),[allRows,query,category])
 const attention=allRows.filter(x=>x.status==='attention').length
 const onTarget=allRows.filter(x=>x.status==='onTarget').length

 function action(value){
  if(value===UI_ACTIONS.CREATE){setEditor({mode:'create',item:null});return}
  if(value===UI_ACTIONS.PRINT){window.print();return}
  if(value===UI_ACTIONS.EXPORT){downloadCsv('limoxis-indicators.csv',['Κωδικός','Δείκτης','Κατηγορία','Αποτέλεσμα','Μονάδα','Αριθμητής','Παρονομαστής','Πηγή','Έκδοση'],rows.map(x=>[x.id,greek?x.titleEl:x.titleEn,indicatorCategoryLabels[x.category]||x.category,x.value,greek?x.unit:x.unitEn,x.numerator,x.denominator??'',x.source,x.version]));notify(t('currentListExported'),'success')}
 }

 function saveCustom(def){
  const current=loadCustomIndicators()
  const next=def.id?current.map(x=>x.id===def.id?def:x):[...current,{...def,id:nextCustomIndicatorId(current)}]
  saveCustomIndicators(next)
  setEditor(null);setSelected(null);setRevision(x=>x+1)
  notify(def.id?'Ο δείκτης ενημερώθηκε.':'Ο νέος δείκτης δημιουργήθηκε.','success')
 }

 async function deleteCustom(item){
  const ok=await confirm({title:'Διαγραφή δείκτη',message:`Ο δείκτης «${item.titleEl}» θα διαγραφεί. Η ενέργεια δεν επηρεάζει τις πρωτογενείς καταγραφές.`,confirmLabel:'Διαγραφή',danger:true})
  if(!ok)return
  saveCustomIndicators(loadCustomIndicators().filter(x=>x.id!==item.id))
  setSelected(null);setRevision(x=>x+1);notify('Ο δείκτης διαγράφηκε.','success')
 }

 return <Page fill title={t('indicators')} subtitle="Δείκτες που υπολογίζονται από τις λειτουργικές καταγραφές του Limoxis, με τεκμηριωμένη πηγή και μέθοδο." actions={<RecordActions actions={[UI_ACTIONS.CREATE,UI_ACTIONS.PRINT,UI_ACTIONS.EXPORT]} resourceCapability={CAPABILITIES.VIEW_INDICATORS} actionCapabilities={{[UI_ACTIONS.CREATE]:CAPABILITIES.MANAGE_INDICATORS,[UI_ACTIONS.PRINT]:CAPABILITIES.VIEW_INDICATORS,[UI_ACTIONS.EXPORT]:CAPABILITIES.VIEW_INDICATORS}} onAction={action}/>}>
  <div className="indicator-summary-strip"><Summary icon={Activity} value={allRows.length} label="Ενεργοί δείκτες"/><Summary icon={CheckCircle2} value={onTarget} label="Εντός στόχου"/><Summary icon={Target} value={attention} label="Χρειάζονται προσοχή"/><Summary icon={TrendingUp} value={allRows.filter(x=>x.calculation==='auto').length} label="Αυτόματος υπολογισμός"/></div>
  <div className="workspace-fill indicator-workspace indicator-registry">
   <FilterBar query={query} onQueryChange={setQuery} placeholder="Αναζήτηση δείκτη ή πηγής..." activeAdvancedCount={category!=='all'?1:0} onClear={()=>{setQuery('');setCategory('all')}}><FilterSelect label="Κατηγορία" value={category} onChange={setCategory}><option value="all">Όλες</option>{categories.map(x=><option key={x} value={x}>{indicatorCategoryLabels[x]||x}</option>)}</FilterSelect></FilterBar>
   <div className="surface indicator-table-surface"><div className="scroll-table"><table className="data-table sticky-table indicator-click-table"><thead><tr><th>Δείκτης</th><th>Κατηγορία</th><th>Αποτέλεσμα</th><th>Στόχος</th><th>Πηγή</th><th>Κατάσταση</th></tr></thead><tbody>{rows.map(x=><tr key={x.id} tabIndex="0" role="button" onClick={()=>setSelected(x)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(x)}}}><td><strong>{greek?x.titleEl:x.titleEn}</strong><small>{x.evidence}</small></td><td>{indicatorCategoryLabels[x.category]||x.category}</td><td className="indicator-result-cell"><strong>{x.value??'—'}</strong><small>{greek?x.unit:x.unitEn}</small></td><td>{formatTarget(x)}</td><td>{x.source}</td><td><span className={`indicator-status ${x.status}`}>{statusLabel[x.status]}</span></td></tr>)}</tbody></table></div></div>
  </div>
  {selected&&<IndicatorDialog item={selected} greek={greek} canManage={canManage} onClose={()=>setSelected(null)} onEdit={()=>setEditor({mode:'edit',item:selected})} onDelete={()=>deleteCustom(selected)}/>}
  {editor&&<IndicatorEditorDialog initial={editor.item} onClose={()=>setEditor(null)} onSave={saveCustom}/>}
 </Page>
}

function formatTarget(x){if(x.target==null)return '—';return `${x.direction==='higher'?'≥':x.direction==='lower'?'≤':''} ${x.target}${x.unit==='%'?'%':''}`}
function Summary({icon:Icon,value,label}){return <div><span className="indicator-summary-icon"><Icon size={15}/></span><strong>{value}</strong><small>{label}</small></div>}

function IndicatorDialog({item,greek,canManage,onClose,onEdit,onDelete}){
 const isCustom=String(item.id||'').startsWith('CUSTOM-')
 const metricLabel=key=>indicatorMetricCatalog.find(x=>x.key===key)?.label||key||'—'
 return <ObserverDialog eyebrow="Δείκτης" title={greek?item.titleEl:item.titleEn} subtitle={isCustom?'Προσαρμοσμένος δείκτης νοσοκομείου':'Βασικός δείκτης Limoxis'} width="wide" onClose={onClose} footer={<>
   {isCustom&&canManage&&<Button variant="secondary" onClick={onEdit}>Επεξεργασία</Button>}
   {isCustom&&canManage&&<Button className="danger" variant="secondary" onClick={onDelete}>Διαγραφή</Button>}
   <Button onClick={onClose}>Κλείσιμο</Button>
  </>}>
  <div className="indicator-view-form">
   <div className="indicator-view-grid">
    <div className="indicator-view-field entry-span-2"><span>Ονομασία δείκτη</span><strong>{greek?item.titleEl:item.titleEn}</strong></div>
    <div className="indicator-view-field"><span>Κατηγορία</span><strong>{indicatorCategoryLabels[item.category]||item.category}</strong></div>
    <div className="indicator-view-field"><span>Μονάδα</span><strong>{greek?item.unit:item.unitEn}</strong></div>
   </div>

   <div className="indicator-view-section">
    <div className="indicator-view-section-head"><Calculator size={15}/><div><strong>{item.calculation==='manual'?'Χειροκίνητος δείκτης':'Αυτόματος δείκτης'}</strong><span>{item.calculation==='manual'?'Η τιμή καταχωρείται από εξωτερική ή μη συνδεδεμένη πηγή.':'Ο δείκτης υπολογίζεται από δεδομένα που υπάρχουν ήδη στο Limoxis.'}</span></div></div>
    {item.calculation==='auto'?<div className="indicator-view-grid">
      <div className="indicator-view-field"><span>Αριθμητής</span><strong>{metricLabel(item.numerator)}</strong><small>{item.numerator??'—'}</small></div>
      <div className="indicator-view-field"><span>Παρονομαστής</span><strong>{item.denominator?metricLabel(item.denominator):'Χωρίς παρονομαστή'}</strong><small>{item.denominator||'—'}</small></div>
      <div className="indicator-view-field"><span>Πολλαπλασιαστής</span><strong>{item.multiplier}</strong></div>
      <div className="indicator-view-preview"><span>Τρέχων υπολογισμός</span><strong>{item.numerator??'—'}{item.denominator?` ÷ ${item.denominator}`:''} × {item.multiplier}</strong></div>
     </div>:<div className="indicator-view-grid">
      <div className="indicator-view-field"><span>Τρέχουσα τιμή</span><strong>{item.value??'—'} {greek?item.unit:item.unitEn}</strong></div>
      <div className="indicator-view-field"><span>Πηγή / τεκμηρίωση</span><strong>{item.source}</strong></div>
     </div>}
   </div>

   <div className="indicator-view-grid">
    <div className="indicator-view-field"><span>Στόχος</span><strong>{formatTarget(item)}</strong></div>
    <div className="indicator-view-field"><span>Επιθυμητή κατεύθυνση</span><strong>{item.direction==='higher'?'Υψηλότερο = καλύτερο':item.direction==='lower'?'Χαμηλότερο = καλύτερο':'Χωρίς αξιολόγηση στόχου'}</strong></div>
    <div className="indicator-view-field"><span>Τρέχουσα τιμή</span><strong>{item.value??'—'}</strong><small>{greek?item.unit:item.unitEn}</small></div>
    <div className="indicator-view-field"><span>Κατάσταση</span><strong><span className={`indicator-status ${item.status}`}>{statusLabel[item.status]}</span></strong></div>
   </div>

   <div className="indicator-view-note"><Database size={15}/><div><strong>Πηγή δεδομένων</strong><span>{item.source} · {item.evidence}</span></div></div>
   {!isCustom&&<div className="indicator-view-system-note"><Info size={14}/><span>Ο δείκτης αυτός είναι βασικός δείκτης του Limoxis και δεν διαγράφεται από την καθημερινή οθόνη. Οι προσαρμοσμένοι δείκτες του νοσοκομείου διαθέτουν Επεξεργασία και Διαγραφή.</span></div>}
  </div>
 </ObserverDialog>
}

function IndicatorEditorDialog({initial,onClose,onSave}){
 const [draft,setDraft]=useState(initial?{...initial,target:initial.target??'',manualValue:initial.manualValue??'',denominator:initial.denominator??''}:{titleEl:'',category:'prevention',unit:'%',source:'',calculation:'auto',numerator:'',denominator:'',multiplier:100,target:'',direction:'higher',manualValue:''})
 const set=(k,v)=>setDraft(x=>({...x,[k]:v}))
 const sourceForMetric=key=>indicatorMetricCatalog.find(x=>x.key===key)?.source||''
 const valid=draft.titleEl?.trim()&&(draft.calculation==='manual'||draft.numerator)
 function save(){
  if(!valid)return
  const source=draft.calculation==='auto'?(sourceForMetric(draft.numerator)||draft.source||'Limoxis'):(draft.source||'Χειροκίνητη καταχώρηση')
  onSave({...draft,id:initial?.id||null,titleEl:draft.titleEl.trim(),titleEn:draft.titleEn||draft.titleEl.trim(),source,numerator:draft.calculation==='auto'?draft.numerator:'manual_value',denominator:draft.calculation==='auto'?(draft.denominator||null):null,multiplier:Number(draft.multiplier||1),version:initial?.version||'custom-1',target:draft.target===''?null:Number(draft.target),manualValue:draft.calculation==='manual'?Number(draft.manualValue||0):null,active:true,createdAt:initial?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()})
 }
 return <ObserverDialog title={initial?'Επεξεργασία δείκτη':'Νέος δείκτης'} subtitle={initial?'Αλλαγή ορισμού, στόχου ή πηγής του προσαρμοσμένου δείκτη.':'Ορίστε τον δείκτη και συνδέστε τον με διαθέσιμα δεδομένα του Limoxis.'} width="wide" onClose={onClose} footer={<DialogActions onCancel={onClose} onSave={save} saveLabel={initial?'Αποθήκευση':'Δημιουργία δείκτη'} disabled={!valid}/>}>
  <div className="indicator-create-form">
   <label><span>Ονομασία δείκτη *</span><input value={draft.titleEl} onChange={e=>set('titleEl',e.target.value)}/></label>
   <div className="indicator-create-grid"><label><span>Κατηγορία</span><select value={draft.category} onChange={e=>set('category',e.target.value)}><option value="surveillance">Επιτήρηση</option><option value="prevention">Πρόληψη</option><option value="workforce">Προσωπικό</option><option value="quality">Ποιότητα</option><option value="other">Άλλο</option></select></label><label><span>Μονάδα</span><input value={draft.unit} onChange={e=>set('unit',e.target.value)} placeholder="%, /1.000 ασθενείς-ημέρες, συμβάντα..."/></label></div>
   <div className="indicator-create-mode"><button type="button" className={draft.calculation==='auto'?'active':''} onClick={()=>set('calculation','auto')}><Calculator size={15}/><div><strong>Αυτόματος</strong><span>Υπολογισμός από δεδομένα Limoxis</span></div></button><button type="button" className={draft.calculation==='manual'?'active':''} onClick={()=>set('calculation','manual')}><Plus size={15}/><div><strong>Χειροκίνητος</strong><span>Τιμή από εξωτερική / μη συνδεδεμένη πηγή</span></div></button></div>
   {draft.calculation==='auto'?<><div className="indicator-create-grid"><label><span>Αριθμητής *</span><select value={draft.numerator} onChange={e=>{set('numerator',e.target.value);set('source',sourceForMetric(e.target.value))}}><option value="">Επιλογή διαθέσιμου δεδομένου...</option>{indicatorMetricCatalog.map(x=><option key={x.key} value={x.key}>{x.label} · {x.source}</option>)}</select></label><label><span>Παρονομαστής</span><select value={draft.denominator||''} onChange={e=>set('denominator',e.target.value)}><option value="">Χωρίς παρονομαστή</option>{indicatorMetricCatalog.map(x=><option key={x.key} value={x.key}>{x.label} · {x.source}</option>)}</select></label></div><div className="indicator-create-grid"><label><span>Πολλαπλασιαστής</span><input type="number" value={draft.multiplier} onChange={e=>set('multiplier',e.target.value)}/></label><div className="indicator-create-preview"><span>Τύπος</span><strong>{draft.numerator||'Αριθμητής'}{draft.denominator?` ÷ ${draft.denominator}`:''} × {draft.multiplier||1}</strong></div></div></>:<div className="indicator-create-grid"><label><span>Τρέχουσα τιμή</span><input type="number" value={draft.manualValue} onChange={e=>set('manualValue',e.target.value)}/></label><label><span>Πηγή / τεκμηρίωση</span><input value={draft.source} onChange={e=>set('source',e.target.value)} placeholder="π.χ. Εξωτερική αναφορά"/></label></div>}
   <div className="indicator-create-grid"><label><span>Στόχος</span><input type="number" value={draft.target} onChange={e=>set('target',e.target.value)} placeholder="Προαιρετικό"/></label><label><span>Επιθυμητή κατεύθυνση</span><select value={draft.direction} onChange={e=>set('direction',e.target.value)}><option value="higher">Υψηλότερο = καλύτερο</option><option value="lower">Χαμηλότερο = καλύτερο</option><option value="context">Χωρίς αξιολόγηση στόχου</option></select></label></div>
  </div>
 </ObserverDialog>
}
