import { useMemo, useState } from 'react'
import { BookOpen, Search, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { helpSections, glossary } from './helpContent'
import { useLanguage } from '../i18n/LanguageContext'
import { useTenant } from '../tenant/TenantContext'
import { navigationFor } from '../../app/navigation'

export function HelpCenter({ open, onClose }) {
  const { pathname } = useLocation(); const { language, t } = useLanguage(); const { role, membership } = useTenant(); const [tab, setTab] = useState('context'); const [query, setQuery] = useState('')
  const item = helpSections[pathname] ?? helpSections[Object.keys(helpSections).find((key) => key !== '/' && pathname.startsWith(key))] ?? helpSections['/']
  const nav = navigationFor({ role, addOns: membership?.capabilities ?? [], customCapabilities: membership?.customCapabilities ?? [], hasAssignments: Boolean(membership?.assignments?.length) })
  const visibleHelp = nav.map((entry) => ({ ...entry, help: helpSections[entry.to] })).filter((entry) => entry.help)
  const terms = useMemo(() => glossary.filter((g) => `${g.term} ${g.el} ${g.en}`.toLowerCase().includes(query.toLowerCase())), [query])
  if (!open) return null
  return <div className="help-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><aside className="help-drawer"><header><div><BookOpen size={19}/><strong>{t('helpCenter')}</strong></div><button onClick={onClose}><X size={18}/></button></header><div className="tabs"><button className={`tab ${tab==='context'?'active':''}`} onClick={() => setTab('context')}>{t('thisSection')}</button><button className={`tab ${tab==='guide'?'active':''}`} onClick={() => setTab('guide')}>{t('myGuide')}</button><button className={`tab ${tab==='glossary'?'active':''}`} onClick={() => setTab('glossary')}>{t('glossary')}</button></div>{tab==='context' && <div className="help-content"><h2>{item.title[language==='el'?0:1]}</h2><p>{item.body[language==='el'?0:1]}</p><div className="help-tip">{t('helpPermissionTip')}</div></div>}{tab==='guide' && <div className="help-content"><p>{t('roleGuideIntro')}</p>{visibleHelp.map((entry) => <section key={entry.to}><h3>{entry.help.title[language==='el'?0:1]}</h3><p>{entry.help.body[language==='el'?0:1]}</p></section>)}</div>}{tab==='glossary' && <div className="help-content"><label className="clinical-search"><Search size={15}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder={t('searchGlossary')}/></label><div className="glossary-list">{terms.map((g)=><div key={g.term}><strong>{g.term}</strong><span>{language==='el'?g.el:g.en}</span></div>)}</div></div>}</aside></div>
}
