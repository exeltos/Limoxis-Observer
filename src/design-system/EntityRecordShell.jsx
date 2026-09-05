import { ChevronLeft,ChevronRight } from 'lucide-react'
import { useLanguage } from '../core/i18n/LanguageContext'
import { useContextualNavigation } from '../core/navigation/useContextualNavigation'
import { BackButton } from './BackButton'

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
  const handleBack=onBack||goBack
  const primaryTabId=tabs[0]?.id||null
  const primaryTabActive=!primaryTabId||!activeTab||activeTab===primaryTabId
  const recordTabClass=primaryTabActive?'record-general-tab-active':'record-secondary-tab-active'
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
        {recordNavigation&&<div className="entity-record-sequence" aria-label={en?'Record navigation':'Πλοήγηση εγγραφών'}>
          <button type="button" className="entity-record-icon-button" disabled={!recordNavigation.hasPrevious} onClick={recordNavigation.previous} title={en?'Previous record':'Προηγούμενη εγγραφή'} aria-label={en?'Previous record':'Προηγούμενη εγγραφή'}><ChevronLeft size={16}/></button>
          {recordNavigation.position&&recordNavigation.total>0&&<span>{recordNavigation.position}/{recordNavigation.total}</span>}
          <button type="button" className="entity-record-icon-button" disabled={!recordNavigation.hasNext} onClick={recordNavigation.next} title={en?'Next record':'Επόμενη εγγραφή'} aria-label={en?'Next record':'Επόμενη εγγραφή'}><ChevronRight size={16}/></button>
        </div>}
        {headerActions}
      </div>
    </header>
    <nav className="entity-record-tabs surface" role="tablist">
      {tabs.map(({id,label,icon:Icon,disabled=false,lockedLabel})=><button key={id} role="tab" aria-selected={activeTab===id} aria-disabled={disabled} disabled={disabled} title={disabled?(lockedLabel||t('locked')):undefined} className={`${activeTab===id?'active':''} ${disabled?'locked':''}`.trim()} onClick={()=>!disabled&&onTabChange(id)}>{Icon&&<Icon size={16}/>}<span>{label}</span>{disabled&&<small className="tab-lock">🔒</small>}</button>)}
    </nav>
    <section className="entity-record-body surface">{children}</section>
  </div>
}
