import { useEffect,useState } from 'react'
import { AlertTriangle,X } from 'lucide-react'
import { supabase } from '../../core/supabase/client'
import { useAuth } from '../../core/auth/AuthContext'
import { useLanguage } from '../../core/i18n/LanguageContext'

export function PlatformMaintenanceBanner(){
  const {profile}=useAuth()
  const {language}=useLanguage()
  const [notice,setNotice]=useState(null)
  const [dismissed,setDismissed]=useState(false)

  useEffect(()=>{
    let active=true
    if(!profile||!supabase){setNotice(null);return()=>{active=false}}
    ;(async()=>{
      try{
        const {data,error}=await supabase.rpc('get_platform_maintenance_notice')
        if(error)throw error
        if(active)setNotice(data||null)
      }catch{
        if(active)setNotice(null)
      }
    })()
    return()=>{active=false}
  },[profile])

  useEffect(()=>{setDismissed(false)},[notice?.updated_at])

  if(!profile||dismissed||!notice?.enabled)return null
  const message=language==='en'?notice.message_en:notice.message_el
  if(!String(message||'').trim())return null

  return <div className="platform-maintenance-banner" role="status" aria-live="polite">
    <AlertTriangle size={16}/>
    <span>{message}</span>
    <button type="button" onClick={()=>setDismissed(true)} aria-label={language==='en'?'Dismiss notice':'Κλείσιμο ανακοίνωσης'} title={language==='en'?'Dismiss notice':'Κλείσιμο ανακοίνωσης'}><X size={15}/></button>
  </div>
}
