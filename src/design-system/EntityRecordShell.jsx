import { ArrowLeft } from 'lucide-react'
import { useLanguage } from '../core/i18n/LanguageContext'
import { useContextualNavigation } from '../core/navigation/useContextualNavigation'

export function EntityRecordShell({
  avatar,
  eyebrow,
  title,
  subtitle,
  status,
  headerActions,
  tabs=[],
  activeTab,
  onTabChange,
  onBack,
  backLabel,
  children,
  className='',
}) {
  const { t }=useLanguage()
  const { goBack }=useContextualNavigation('/')
  const handleBack=onBack||goBack
  return <div className={`entity-record-shell ${className}`.trim()}>
    <header className="entity-record-header surface">
      <div className="entity-record-avatar">{avatar}</div>
      <div className="entity-record-identity">
        {eyebrow&&<span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {subtitle&&<p>{subtitle}</p>}
      </div>
      <div className="entity-record-header-actions">
        {status}
        {headerActions}
        <button className="entity-record-icon-button back" onClick={handleBack} title={backLabel||t('back')} aria-label={backLabel||t('back')}><ArrowLeft size={16}/></button>
      </div>
    </header>
    <nav className="entity-record-tabs surface" role="tablist">
      {tabs.map(({id,label,icon:Icon})=><button key={id} role="tab" aria-selected={activeTab===id} className={activeTab===id?'active':''} onClick={()=>onTabChange(id)}>{Icon&&<Icon size={16}/>}<span>{label}</span></button>)}
    </nav>
    <section className="entity-record-body surface">{children}</section>
  </div>
}
