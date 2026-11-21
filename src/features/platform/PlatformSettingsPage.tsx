import './platformScreens.css'
import { useEffect,useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle,Building2,FlaskConical,Globe } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { ModuleTabs } from '../../design-system/ModuleTabs'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { getPlatformSettings,type PlatformSettings } from './platformSettingsService'
import { PlatformSettingsForm,type PlatformSettingsKind } from './PlatformSettingsForm'
import './platformSettings.css'

// Ρυθμίσεις › Ρυθμίσεις πλατφόρμας (owner, 21/11/2026): the platform's own settings in three tabs, Οργανισμοί, Demo
// and Σελίδα παρουσίασης, each with its own «Αποθήκευση». /platform/settings?tab=demo opens a tab directly.
const TABS: PlatformSettingsKind[]=['organizations','demo','presentation']

export function PlatformSettingsPage(){
  const {language}=useLanguage()
  const en=language==='en'
  const tx=(elText: string,enText: string)=>en?enText:elText
  const [params,setParams]=useSearchParams()
  const tab=(TABS as (string|null)[]).includes(params.get('tab'))?params.get('tab') as PlatformSettingsKind:'organizations'
  const [settings,setSettings]=useState<PlatformSettings|null>(null)
  const [error,setError]=useState(false)
  useEffect(()=>{let active=true;getPlatformSettings().then(value=>{if(active)setSettings(value)}).catch(()=>{if(active)setError(true)});return()=>{active=false}},[])
  return <Page title={tx('Ρυθμίσεις πλατφόρμας','Platform settings')} subtitle={tx('Ισχύουν για όλη την εγκατάσταση· κάθε αλλαγή καταγράφεται στο Ιστορικό & Υγεία.','They apply to the whole installation; every change is recorded in History & Health.')}>
    <ModuleTabs
      className="platform-settings-tabs"
      activeId={tab}
      onChange={id=>setParams(id==='organizations'?{}:{tab:id},{replace:true})}
      ariaLabel={tx('Ρυθμίσεις πλατφόρμας','Platform settings')}
      tabs={[
        {id:'organizations',label:tx('Οργανισμοί','Organizations'),icon:Building2},
        {id:'demo',label:'Demo',icon:FlaskConical},
        {id:'presentation',label:tx('Σελίδα παρουσίασης','Presentation page'),icon:Globe},
      ]}
    />
    <div className="platform-settings-screen">
      {error?<div className="data-access-state warning"><AlertTriangle size={16}/><span>{tx('Δεν ήταν δυνατή η φόρτωση των ρυθμίσεων.','The settings could not be loaded.')}</span></div>
      :!settings?<div className="inline-empty">{tx('Φόρτωση…','Loading…')}</div>
      :<PlatformSettingsForm key={tab} kind={tab} settings={settings} language={language} onSaved={setSettings}/>}
    </div>
  </Page>
}
