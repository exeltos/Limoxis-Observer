import './platformScreens.css'
import { useEffect,useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { getPlatformSettings,type PlatformSettings } from './platformSettingsService'
import { PlatformSettingsForm,type PlatformSettingsKind } from './PlatformSettingsForm'
import './platformSettings.css'

// Ρυθμίσεις › Ρυθμίσεις πλατφόρμας (owner, 21/11/2026): the platform's own settings on one screen that fills the page —
// Οργανισμοί and Demo side by side, Σελίδα παρουσίασης across under them — each with its own «Αποθήκευση».
const KINDS: PlatformSettingsKind[]=['organizations','demo','presentation']

export function PlatformSettingsPage(){
  const {language}=useLanguage()
  const en=language==='en'
  const tx=(elText: string,enText: string)=>en?enText:elText
  const [settings,setSettings]=useState<PlatformSettings|null>(null)
  const [error,setError]=useState(false)
  useEffect(()=>{let active=true;getPlatformSettings().then(value=>{if(active)setSettings(value)}).catch(()=>{if(active)setError(true)});return()=>{active=false}},[])
  return <Page title={tx('Ρυθμίσεις πλατφόρμας','Platform settings')} subtitle={tx('Ισχύουν για όλη την εγκατάσταση· κάθε αλλαγή καταγράφεται στο Ιστορικό & Υγεία.','They apply to the whole installation; every change is recorded in History & Health.')}>
    <div className="platform-settings-screen">
      {error?<div className="data-access-state warning"><AlertTriangle size={16}/><span>{tx('Δεν ήταν δυνατή η φόρτωση των ρυθμίσεων.','The settings could not be loaded.')}</span></div>
      :!settings?<div className="inline-empty">{tx('Φόρτωση…','Loading…')}</div>
      :KINDS.map(kind=><PlatformSettingsForm key={kind} kind={kind} settings={settings} language={language} onSaved={setSettings}/>)}
    </div>
  </Page>
}
