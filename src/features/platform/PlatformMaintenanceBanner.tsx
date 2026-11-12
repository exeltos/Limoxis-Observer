import { useEffect,useState } from 'react'
import { AlertTriangle,X } from 'lucide-react'
import { IconButton } from '../../design-system/IconButton'
import { supabase as configuredClient, type Cloud } from '../../core/supabase/client'
import { useAuth } from '../../core/auth/AuthContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import type { AnyRecord } from '../../types/featureTypes'

// The calls below run with a configured client: the demo and an unconfigured build return before them.
const supabase = configuredClient as Cloud

export function PlatformMaintenanceBanner(){
  const {profile}=useAuth()
  const {language}=useLanguage()
  const [notice,setNotice]=useState<AnyRecord | null>(null)
  const [dismissed,setDismissed]=useState(false)

  useEffect(()=>{
    let active=true
    if(!profile||!supabase){setNotice(null);return()=>{active=false}}
    ;(async()=>{
      try{
        const {data,error}=await supabase.rpc('get_platform_maintenance_notice')
        if(error)throw error
        if(active)setNotice((data||null) as AnyRecord|null)
      }catch{
        if(active)setNotice(null)
      }
    })()
    return()=>{active=false}
  },[profile])

  useEffect(()=>{setDismissed(false)},[notice?.updated_at])

  if(!profile||dismissed||!notice?.enabled)return null
  const preferred=language==='en'?notice.message_en:notice.message_el
  const fallback=language==='en'?notice.message_el:notice.message_en
  const message=String(preferred||'').trim()||String(fallback||'').trim()
  if(!message)return null

  const dismissLabel=language==='en'?'Dismiss notice':'Κλείσιμο ανακοίνωσης'
  return <div className="platform-maintenance-banner" role="status" aria-live="polite">
    <AlertTriangle size={16}/>
    <span>{message}</span>
    <IconButton label={dismissLabel} size="sm" onClick={()=>setDismissed(true)}><X size={15}/></IconButton>
  </div>
}
