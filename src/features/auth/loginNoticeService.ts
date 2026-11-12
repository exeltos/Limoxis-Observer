import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'

export interface LoginNotice { noticeEl?: string | null, noticeEn?: string | null, supportEmail?: string | null }

// Public fields shown before sign-in: maintenance notice (only when enabled)
// and support e-mail. Failures never block the login form.
export async function loadLoginNotice(): Promise<LoginNotice | null>{
  if(!hasSupabaseConfig||!supabase)return null
  try{
    const {data,error}=await supabase.rpc('public_login_notice')
    if(error)return null
    return (data as LoginNotice | null)||null
  }catch{return null}
}
