import { Children, Fragment, cloneElement, isValidElement } from 'react'
import { ChevronLeft,ChevronRight } from 'lucide-react'
import { useLocation,useNavigate } from 'react-router-dom'
import { useLanguage } from '../core/i18n/LanguageContext'
import { useContextualNavigation } from '../core/navigation/useContextualNavigation'
import { registryStorageKey } from '../core/navigation/useRegistryMemory'
import { readSessionJson,writeSessionValue } from '../core/storage/browserStorage'
import { ActionButton } from './ActionButton'
import { BackButton } from './BackButton'
import { IconButton } from './IconButton'

function flattenActions(node,result=[]){
  Children.forEach(node,child=>{
    if(!isValidElement(child))return
    if(child.type===Fragment){flattenActions(child.props.children,result);return}
    if(recordActionKind(child)){result.push(child);return}
    if(child.props?.children)flattenActions(child.props.children,result)
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
  const className=`${action.props.className||''} record-crud-action record-crud-${kind}`.trim()
  const tone=kind==='delete'?'danger':'edit'
  const label=action.props['aria-label']||action.props.title||(kind==='delete'?'Delete':'Edit')
  const explicitDestructive=kind==='delete'
  if(action.type===ActionButton){
    const children=explicitDestructive?<>{action.props.children}<span>{label}</span></>:action.props.children
    return cloneElement(action,{tone,iconOnly:!explicitDestructive,className,label},children)
  }
  if(action.type===IconButton&&!explicitDestructive)return cloneElement(action,{tone,className,label})
  const {children,title:actionTitle,className:ignoredClassName,...props}=action.props
  return <ActionButton key={action.key||`${kind}-${label}`} label={label} tone={tone} iconOnly={!explicitDestructive} className={className} title={actionTitle||label} {...props}>{children}{explicitDestructive&&<span>{label}</span>}</ActionButton>
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
  const isPlatformOwnerRecord=String(className||'').includes('platform-owner-record-shell')

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

  const generalActions=isPlatformOwnerRecord?[]:flattenActions(headerActions).map(normalizeGeneralAction).filter(Boolean)
  const ownerHeaderActions=isPlatformOwnerRecord?headerActions:null
  const secondaryBodyStyle=primaryTabActive?undefined:{display:'flex',flexDirection:'column',minHeight:0}

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
          <IconButton size="sm" disabled={!effectiveRecordNavigation.hasPrevious} onClick={effectiveRecordNavigation.previous} label={en?'Previous record':'Προηγούμενη εγγραφή'}><ChevronLeft size={16}/></IconButton>
          {effectiveRecordNavigation.position&&effectiveRecordNavigation.total>0&&<span>{effectiveRecordNavigation.position}/{effectiveRecordNavigation.total}</span>}
          <IconButton size="sm" disabled={!effectiveRecordNavigation.hasNext} onClick={effectiveRecordNavigation.next} label={en?'Next record':'Επόμενη εγγραφή'}><ChevronRight size={16}/></IconButton>
        </div>}
        {ownerHeaderActions}
      </div>
    </header>
    <nav className="entity-record-tabs surface" role="tablist">
      {tabs.map(({id,label,icon:Icon,disabled=false,lockedLabel})=><button key={id} role="tab" aria-selected={activeTab===id} aria-disabled={disabled} disabled={disabled} title={disabled?(lockedLabel||t('locked')):undefined} className={`${activeTab===id?'active':''} ${disabled?'locked':''}`.trim()} onClick={()=>!disabled&&onTabChange(id)}>{Icon&&<Icon size={16}/>}<span>{label}</span>{disabled&&<small className="tab-lock">🔒</small>}</button>)}
    </nav>
    <section className="entity-record-body surface" style={secondaryBodyStyle}>
      {primaryTabActive&&generalActions.length>0&&<div className="record-inline-actions entity-record-general-actions" aria-label={en?'Record actions':'Ενέργειες εγγραφής'}>{generalActions}</div>}
      {children}
    </section>
  </div>
}
