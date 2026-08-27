import { ClipboardCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { useTenant } from '../../core/tenant/TenantContext'
import { CAPABILITIES, can } from '../../core/permissions/roles'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { demoControls } from './controlsDemoData'

export function ControlsPage(){
  const {role,membership}=useTenant()
  const {t,language,locale}=useLanguage()
  const navigate=useNavigate()
  const registry=useRegistryMemory('controls')
  const addOns=membership?.capabilities??[]
  const canManage=can(role,CAPABILITIES.MANAGE_CONTROLS,addOns)
  const fmt=value=>new Intl.DateTimeFormat(locale).format(new Date(`${value}T12:00:00`))
  return <Page fill title={t('controls')} subtitle={canManage?t('controlsPanel.controlsManageSubtitle'):t('controlsPanel.controlsAssignedSubtitle')}>
    <section className="surface controls-surface workspace-fill workspace-column">
      <div className="section-toolbar"><div><h2>{canManage?t('controlsPanel.activeAssignments'):t('controlsPanel.toExecute')}</h2><p>{t('controlsPanel.controlsTrackingHint')}</p></div>{canManage&&<button className="button button-primary">+ {t('controlsPanel.newControl')}</button>}</div>
      <div className="control-list scroll-list" ref={registry.scrollRef}>{demoControls.map(item=><article key={item.id} {...registry.rowProps(item.id)} className={`control-row registry-row-clickable ${registry.highlightId===item.id?'registry-row-returned':''}`} onClick={()=>registry.openRecord(navigate,`/controls/${item.id}`,item.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();registry.openRecord(navigate,`/controls/${item.id}`,item.id)}}}><div className="control-icon"><ClipboardCheck size={18}/></div><div><strong>{language==='el'?item.title:item.titleEn}</strong><span>{language==='el'?item.department:item.departmentEn} · {t('deadline')} {fmt(item.due)}</span></div><span className={`status-badge ${item.status==='completed'?'active':''}`}>{t(item.status)}</span></article>)}</div>
    </section>
  </Page>
}
