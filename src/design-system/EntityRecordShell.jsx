import { Children, Fragment, cloneElement, isValidElement, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { ChevronLeft,ChevronRight } from 'lucide-react'
import { useLocation,useNavigate } from 'react-router-dom'
import { useLanguage } from '../core/i18n/LanguageContext'
import { formatDateTime } from '../core/i18n/formatDay'
import { DEMO_REPORT_MARK_EL,DEMO_REPORT_MARK_EN,getReportBranding } from '../core/organization/branding'
import { useContextualNavigation } from '../core/navigation/useContextualNavigation'
import { useTabStrip } from './useTabStrip'
import { registryStorageKey } from '../core/navigation/useRegistryMemory'
import { readSessionJson,writeSessionValue } from '../core/storage/browserStorage'
import { BackButton } from './BackButton'
import { IconButton } from './IconButton'
import { OverflowMenu } from './OverflowMenu'
import { ExportMenu } from './ExportMenu'
import { RecordReportPrint } from './RecordReportPrint'

// Header actions come in three kinds: edit and delete go to the record's «…»
// menu; the record's own commands (e.g. «Καταγραφή ελέγχου») and the export
// control (ExportMenu «Εξαγωγή ▾», always last) stay visible next to the status.
function flattenActions(node,result=[],utilities=[]){
  Children.forEach(node,child=>{
    if(!isValidElement(child))return
    if(child.type===Fragment){flattenActions(child.props.children,result,utilities);return}
    if(isUtilityAction(child)){utilities.push(child);return}
    if(recordActionKind(child)){result.push(child);return}
    if(child.props?.onClick){utilities.push(child);return}
    if(child.props?.children)flattenActions(child.props.children,result,utilities)
  })
  return result
}

const UTILITY_PREFIXES=['print','εκτύπ','export','εξαγωγ','download','λήψη','word','pdf']
function isUtilityAction(action){
  if(!isValidElement(action))return false
  if(action.type===ExportMenu||action.props.utility)return true
  if(typeof action.type==='string')return false
  const semantic=String(action.props.label||action.props['aria-label']||action.props.title||'').toLowerCase().trim()
  return UTILITY_PREFIXES.some(prefix=>semantic.startsWith(prefix))
}

function recordActionKind(action){
  if(!isValidElement(action))return null
  const className=String(action.props.className||'').toLowerCase()
  const aria=String(action.props['aria-label']||'').toLowerCase()
  const title=String(action.props.title||'').toLowerCase()
  const label=String(action.props.label||'').toLowerCase()
  const tone=String(action.props.tone||'').toLowerCase()
  const semanticText=`${aria} ${title} ${label}`.trim()
  const destructive=tone==='danger'||className.includes('danger')||className.includes('delete')||className.includes('archive')||
    semanticText.startsWith('delete')||semanticText.startsWith('διαγραφ')||semanticText.startsWith('archive')||semanticText.startsWith('αρχειοθέτ')||semanticText.startsWith('void')||semanticText.startsWith('ακύρ')
  if(destructive)return 'delete'
  const edit=tone==='edit'||className.includes('edit')||semanticText.startsWith('edit')||semanticText.startsWith('επεξεργ')||semanticText.startsWith('correct')||semanticText.startsWith('διόρθ')
  return edit?'edit':null
}

function actionLabel(action,kind,en){
  return action.props.label||action.props['aria-label']||action.props.title||(kind==='delete'?(en?'Delete':'Διαγραφή'):(en?'Edit':'Επεξεργασία'))
}

function actionIcon(action){
  const children=Children.toArray(action.props.children)
  const icon=children.find(child=>isValidElement(child)&&typeof child.type!=='string')
  return icon?.type||null
}

function toOverflowItem(action,index,en){
  const kind=recordActionKind(action)
  if(!kind)return null
  const label=actionLabel(action,kind,en)
  return {
    id:action.key||`${kind}-${index}`,
    label,
    icon:actionIcon(action),
    tone:kind==='delete'?'danger':undefined,
    separatorBefore:kind==='delete',
    disabled:action.props.disabled,
    onClick:action.props.onClick,
  }
}

export function EntityRecordShell({
  avatar,
  eyebrow,
  recordId,
  title,
  subtitle,
  context,
  // A full-width line under the header row (e.g. the origin and risk factors of an episode).
  headerNote,
  status,
  headerActions,
  recordNavigation,
  tabs=[],
  activeTab,
  onTabChange,
  onBack,
  backLabel,
  // (tabId) => that tab's content. With it, printing the record («Εξαγωγή › Εκτύπωση»
  // or the browser's own print) puts every tab in sequence, one after the other,
  // instead of only the tab on screen.
  renderTab,
  // The record's printed report as data (see recordReport.js), or a function returning it
  // (built only when printing). With it the print is a clinical document instead of the
  // screen's tabs; without it, the tabs print in the same plain style.
  printReport,
  children,
  className='',
}) {
  const { t,language }=useLanguage();const en=language==='en'
  // Print mode: a clean printed record — hospital header, record title and code,
  // print date, every tab's content, and on each page «Εκτυπώθηκε από …» with the
  // page number; the on-screen controls are hidden by print.css.
  const [printedAt,setPrintedAt]=useState(null)
  const printing=Boolean(printedAt)
  useEffect(()=>{
    const before=()=>flushSync(()=>setPrintedAt(current=>current||new Date()))
    const after=()=>setPrintedAt(null)
    window.addEventListener('beforeprint',before)
    window.addEventListener('afterprint',after)
    return()=>{window.removeEventListener('beforeprint',before);window.removeEventListener('afterprint',after)}
  },[])
  function printRecord(){
    flushSync(()=>setPrintedAt(new Date()))
    // Tabs that load their content (documents, history) get a moment before the snapshot.
    setTimeout(()=>window.print(),400)
  }
  const { goBack }=useContextualNavigation('/')
  const navigate=useNavigate();const location=useLocation()
  const handleBack=onBack||goBack
  const hasTabs=Array.isArray(tabs)&&tabs.length>0
  const tabStripRef=useTabStrip(activeTab)
  const primaryTabId=hasTabs?tabs[0]?.id:null
  // A tab marked `sheet` (e.g. a record's Assessment) reads as a details sheet, like the first tab.
  const primaryTabActive=!primaryTabId||!activeTab||activeTab===primaryTabId||Boolean(tabs.find(tab=>tab.id===activeTab)?.sheet)
  const recordTabClass=primaryTabActive?'record-general-tab-active':'record-secondary-tab-active'
  const paneClass=hasTabs?'record-tabbed-screen':'record-single-pane-screen'
  const isPlatformOwnerRecord=String(className||'').includes('platform-owner-record-shell')

  const contextualRegistry=typeof location.state?.limoxisFrom?.registry==='string'?location.state.limoxisFrom.registry:null
  const inferredRegistry=!contextualRegistry&&location.pathname.startsWith('/training/')?'training-programs':null
  const sourceRegistry=contextualRegistry||inferredRegistry
  const currentRecordId=(recordId??eyebrow)==null?'':String(recordId??eyebrow)
  const fallbackIds=sourceRegistry?readSessionJson(registryStorageKey(sourceRegistry,'sequence'),[]):[]
  const fallbackSequence=Array.isArray(fallbackIds)?fallbackIds.map(String):[]
  const fallbackIndex=currentRecordId?fallbackSequence.indexOf(currentRecordId):-1
  function moveFallback(nextIndex){
    const id=fallbackSequence[nextIndex]
    if(!sourceRegistry||!id)return
    writeSessionValue(registryStorageKey(sourceRegistry,'selected'),id)
    const segments=location.pathname.split('/').filter(Boolean)
    if(!segments.length)return
    segments[segments.length-1]=encodeURIComponent(id)
    navigate(`/${segments.join('/')}${location.search||''}${location.hash||''}`,{replace:true,state:location.state})
  }
  const fallbackNavigation=fallbackIndex>=0&&fallbackSequence.length>1?{
    position:fallbackIndex+1,
    total:fallbackSequence.length,
    hasPrevious:fallbackIndex>0,
    hasNext:fallbackIndex<fallbackSequence.length-1,
    previous:()=>moveFallback(fallbackIndex-1),
    next:()=>moveFallback(fallbackIndex+1),
  }:null
  const effectiveRecordNavigation=recordNavigation||fallbackNavigation

  const utilityActions=[]
  const rawGeneralActions=isPlatformOwnerRecord?[]:flattenActions(headerActions,[],utilityActions)
  // «Εξαγωγή» after the other utilities, and the page's main action (tone primary) last at the right, as on the Quality Center page.
  const utilityRank=action=>action.props?.tone==='primary'?2:action.type===ExportMenu?1:0
  utilityActions.sort((a,b)=>utilityRank(a)-utilityRank(b))
  const printAllTabs=hasTabs&&typeof renderTab==='function'
  // The record's «Εκτύπωση» prints the whole record (every tab), not the screen as it is.
  const shownUtilities=utilityActions.map(action=>(printAllTabs||printReport)&&action.type===ExportMenu&&action.props.onPrint?cloneElement(action,{onPrint:printRecord}):action)
  const branding=getReportBranding()
  const printedLine=printedAt?[`${en?'Printed by':'Εκτυπώθηκε από'} ${branding?.printedBy||'—'}`,formatDateTime(printedAt,language)].join(' · '):''
  const cssText=value=>JSON.stringify(String(value||'')).replace(/</g,'\\3c ')
  const printedTabs=printing&&printAllTabs?tabs.filter(tab=>!tab.disabled):null
  const reportDescription=printing&&printReport?(typeof printReport==='function'?printReport():printReport):null
  const generalMenuItems=rawGeneralActions.map((action,index)=>toOverflowItem(action,index,en)).filter(Boolean)
  const ownerHeaderActions=isPlatformOwnerRecord?headerActions:null
  const actionClass=generalMenuItems.length?'record-has-general-actions':'record-no-general-actions'
  const secondaryBodyStyle=primaryTabActive?undefined:{display:'flex',flexDirection:'column',minHeight:0}

  if(reportDescription)return <div className={`entity-record-shell record-printing record-report-mode ${className}`.trim()}>
    <RecordReportPrint report={reportDescription} branding={branding} printedAt={printedAt} printedBy={branding?.printedBy} language={language} fmtDateTime={value=>formatDateTime(value,language)}/>
  </div>
  return <div className={`entity-record-shell canonical-detail-screen ${recordTabClass} ${paneClass} ${actionClass} ${printing?'record-printing':''} ${className}`.trim()}>
    {printing&&<style>{`@media print{@page{margin:14mm 12mm 16mm;@bottom-left{content:${cssText(printedLine)};font:9px Inter,Arial,sans-serif;color:#5d7083}@bottom-right{content:counter(page) " / " counter(pages);font:9px Inter,Arial,sans-serif;color:#5d7083}}}`}</style>}
    <div className="record-print-header" aria-hidden="true">
      {branding?.logo&&<img src={branding.logo} alt=""/>}
      <div className="record-print-hospital">
        <strong>{branding?.name||''}</strong>
        {branding?.reportHeader&&<span>{branding.reportHeader}</span>}
        {branding?.demo&&<span className="record-print-demo">{en?DEMO_REPORT_MARK_EN:DEMO_REPORT_MARK_EL}</span>}
      </div>
      <div className="record-print-date">{en?'Print date':'Ημερομηνία εκτύπωσης'}: {printedAt?formatDateTime(printedAt,language):''}</div>
    </div>
    <header className="entity-record-header surface">
      <BackButton className="entity-record-back-left" onClick={handleBack} label={backLabel||t('back')}/>
      <div className="entity-record-avatar">{avatar}</div>
      <div className="entity-record-identity">
        {eyebrow&&<span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {subtitle&&<p>{subtitle}</p>}
        {context&&<div className="entity-record-context">{context}</div>}
      </div>
      <div className="entity-record-header-actions">
        {status}
        {shownUtilities.length>0&&<div className="record-utility-actions entity-record-utilities">{shownUtilities.map((action,index)=><Fragment key={action.key||index}>{action}</Fragment>)}</div>}
        {effectiveRecordNavigation&&<div className="entity-record-sequence" aria-label={en?'Record navigation':'Πλοήγηση εγγραφών'}>
          <IconButton size="sm" disabled={!effectiveRecordNavigation.hasPrevious} onClick={effectiveRecordNavigation.previous} label={en?'Previous record':'Προηγούμενη εγγραφή'}><ChevronLeft size={16}/></IconButton>
          {effectiveRecordNavigation.position&&effectiveRecordNavigation.total>0&&<span>{effectiveRecordNavigation.position}/{effectiveRecordNavigation.total}</span>}
          <IconButton size="sm" disabled={!effectiveRecordNavigation.hasNext} onClick={effectiveRecordNavigation.next} label={en?'Next record':'Επόμενη εγγραφή'}><ChevronRight size={16}/></IconButton>
        </div>}
        {ownerHeaderActions}
      </div>
      {headerNote&&<div className="entity-record-note">{headerNote}</div>}
    </header>
    {hasTabs&&<nav ref={tabStripRef} className="entity-record-tabs surface" role="tablist">
      {tabs.map(({id,label,icon:Icon,disabled=false,lockedLabel})=><button key={id} role="tab" aria-selected={activeTab===id} aria-disabled={disabled} disabled={disabled} title={disabled?(lockedLabel||t('locked')):undefined} className={`${activeTab===id?'active':''} ${disabled?'locked':''}`.trim()} onClick={()=>!disabled&&onTabChange?.(id)}>{Icon&&<Icon size={16}/>}<span>{label}</span>{disabled&&<small className="tab-lock">🔒</small>}</button>)}
    </nav>}
    <section className="entity-record-body surface" style={secondaryBodyStyle}>
      {/* The record's «…» (edit, archive, delete) is the law of every record: the top right corner of the record card, never the header. */}
      {generalMenuItems.length>0&&<div className="entity-record-general-actions" aria-label={en?'Record actions':'Ενέργειες εγγραφής'}><OverflowMenu label={en?'Record actions':'Ενέργειες εγγραφής'} items={generalMenuItems}/></div>}
      {printedTabs?printedTabs.map(tab=><section key={tab.id} className="record-print-section" data-print-tab={tab.id}>
        <h3 className="record-print-section-title">{tab.label}</h3>
        {renderTab(tab.id)}
      </section>):children}
    </section>
    {printing&&<p className="record-print-footer">{printedLine}</p>}
  </div>
}
