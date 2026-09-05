import { Children, Fragment, cloneElement, isValidElement } from 'react'
import { ChevronLeft,ChevronRight } from 'lucide-react'
import { useLocation,useNavigate } from 'react-router-dom'
import { useLanguage } from '../core/i18n/LanguageContext'
import { useContextualNavigation } from '../core/navigation/useContextualNavigation'
import { registryStorageKey } from '../core/navigation/useRegistryMemory'
import { readSessionJson,writeSessionValue } from '../core/storage/browserStorage'
import { BackButton } from './BackButton'

function flattenActions(node,result=[]){
  Children.forEach(node,child=>{
    if(!isValidElement(child))return
    if(child.type===Fragment){flattenActions(child.props.children,result);return}
    result.push(child)
  })
  return result
}

function recordActionKind(action){
  if(!isValidElement(action))return null
  const className=String(action.props.className||'').toLowerCase()
  const aria=String(action.props['aria-label']||'').toLowerCase()
  const title=String(action.props.title||'').toLowerCase()
  const destructive=className.includes('danger')||className.includes('delete')||className.includes('archive')||
    aria.startsWith('delete')||aria.startsWith('διαγραφ')||aria.startsWith('archive')||aria.startsWith('αρχειοθέτ')||aria.startsWith('void')||aria.startsWith('ακύρ')||
    title.startsWith('delete')||title.startsWith('διαγραφ')||title.startsWith('archive')||title.startsWith('αρχειοθέτ')||title.startsWith('void')||title.startsWith('ακύρ')
  if(destructive)return 'delete'
  const edit=className.includes('edit')||aria.startsWith('edit')||aria.startsWith('επεξεργ')||title==='edit'||title==='επεξεργασία'||title.startsWith('correct')||title.startsWith('διόρθ')
  return edit?'edit':null
}

function normalizeGeneralAction(action){
  const kind=recordActionKind(action)
  if(!kind)return null
  return cloneElement(action,{className:`${action.props.className||''} record-crud-action record-crud-${kind}`.trim()})
}

export function EntityRecordShell({
  avatar,
  eyebrow,
  title,
  subtitle,
  status,
  headerActions,
  recordNavigation,
  tabs=[],
  activeTab,
  onTabChange,
  onBack,
  backLabel,
  children,
  className='',
}) {
  const { t,language }=useLanguage();const en=language==='en'
  const { goBack }=useContextualNavigation('/')
  const navigate=useNavigate();const location=useLocation()
  const handleBack=onBack||goBack
  const primaryTabId=tabs[0]?.id||null
  const primaryTabActive=!primaryTabId||!activeTab||activeTab===primaryTabId
  const recordTabClass=primaryTabActive?'record-general-tab-active':'record-secondary-tab-active'

  const sourceRegistry=typeof location.state?.limoxisFrom?.registry==='string'?location.state.limoxisFrom.registry:null
  const currentRecordId=eyebrow==null?'':String(eyebrow)
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

  // Record cards deliberately expose only the canonical edit/destructive pair.
  // Print, export, download and workflow buttons belong to their module/list or tab content,
  // never to the record header. This keeps every record visually identical to Employee.
  const generalActions=flattenActions(headerActions).map(normalizeGeneralAction).filter(Boolean)

  return <div className={`entity-record-shell canonical-detail-screen ${recordTabClass} ${className}`.trim()}>
    <header className="entity-record-header surface">
      <BackButton className="entity-record-back-left" onClick={handleBack} label={backLabel||t('back')}/>
      <div className="entity-record-avatar">{avatar}</div>
      <div className="entity-record-identity">
        {eyebrow&&<span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {subtitle&&<p>{subtitle}</p>}
      </div>
      <div className="entity-record-header-actions">
        {status}
        {effectiveRecordNavigation&&<div className="entity-record-sequence" aria-label={en?'Record navigation':'Πλοήγηση εγγραφών'}>
          <button type="button" className="entity-record-icon-button" disabled={!effectiveRecordNavigation.hasPrevious} onClick={effectiveRecordNavigation.previous} title={en?'Previous record':'Προηγούμενη εγγραφή'} aria-label={en?'Previous record':'Προηγούμενη εγγραφή'}><ChevronLeft size={16}/></button>
          {effectiveRecordNavigation.position&&effectiveRecordNavigation.total>0&&<span>{effectiveRecordNavigation.position}/{effectiveRecordNavigation.total}</span>}
          <button type="button" className="entity-record-icon-button" disabled={!effectiveRecordNavigation.hasNext} onClick={effectiveRecordNavigation.next} title={en?'Next record':'Επόμενη εγγραφή'} aria-label={en?'Next record':'Επόμενη εγγραφή'}><ChevronRight size={16}/></button>
        </div>}
      </div>
    </header>
    <nav className="entity-record-tabs surface" role="tablist">
      {tabs.map(({id,label,icon:Icon,disabled=false,lockedLabel})=><button key={id} role="tab" aria-selected={activeTab===id} aria-disabled={disabled} disabled={disabled} title={disabled?(lockedLabel||t('locked')):undefined} className={`${activeTab===id?'active':''} ${disabled?'locked':''}`.trim()} onClick={()=>!disabled&&onTabChange(id)}>{Icon&&<Icon size={16}/>}<span>{label}</span>{disabled&&<small className="tab-lock">🔒</small>}</button>)}
    </nav>
    <section className="entity-record-body surface">
      {primaryTabActive&&generalActions.length>0&&<div className="record-inline-actions entity-record-general-actions" aria-label={en?'Record actions':'Ενέργειες εγγραφής'}>{generalActions}</div>}
      {children}
    </section>
  </div>
}
