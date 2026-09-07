import { Children, Fragment, isValidElement } from 'react'
import { ChevronLeft,ChevronRight } from 'lucide-react'
import { useLocation,useNavigate } from 'react-router-dom'
import { useLanguage } from '../core/i18n/LanguageContext'
import { useContextualNavigation } from '../core/navigation/useContextualNavigation'
import { registryStorageKey } from '../core/navigation/useRegistryMemory'
import { readSessionJson,writeSessionValue } from '../core/storage/browserStorage'
import { BackButton } from './BackButton'
import { IconButton } from './IconButton'
import { OverflowMenu } from './OverflowMenu'

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

  const rawGeneralActions=isPlatformOwnerRecord?[]:flattenActions(headerActions)
  const generalMenuItems=rawGeneralActions.map((action,index)=>toOverflowItem(action,index,en)).filter(Boolean)
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
      {primaryTabActive&&generalMenuItems.length>0&&<div className="entity-record-general-actions" aria-label={en?'Record actions':'Ενέργειες εγγραφής'}><OverflowMenu label={en?'Record actions':'Ενέργειες εγγραφής'} items={generalMenuItems}/></div>}
      {children}
    </section>
  </div>
}
