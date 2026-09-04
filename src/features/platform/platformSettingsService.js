import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'

const fallback={
  id:'global',
  supportEmail:'',
  defaultDemoDurationDays:30,
  maintenanceNoticeEnabled:false,
  maintenanceNoticeEl:'',
  maintenanceNoticeEn:'',
  updatedAt:null,
}

function mapRow(row){
  if(!row)return fallback
  return {
    id:row.id||'global',
    supportEmail:row.support_email||'',
    defaultDemoDurationDays:Number(row.default_demo_duration_days)||30,
    maintenanceNoticeEnabled:Boolean(row.maintenance_notice_enabled),
    maintenanceNoticeEl:row.maintenance_notice_el||'',
    maintenanceNoticeEn:row.maintenance_notice_en||'',
    updatedAt:row.updated_at||null,
  }
}

export async function getPlatformSettings(){
  if(!hasSupabaseConfig||!supabase)return fallback
  const {data,error}=await supabase
    .from('platform_settings')
    .select('id,support_email,default_demo_duration_days,maintenance_notice_enabled,maintenance_notice_el,maintenance_notice_en,updated_at')
    .eq('id','global')
    .single()
  if(error)throw error
  return mapRow(data)
}

export async function updatePlatformSettings(values){
  if(!hasSupabaseConfig||!supabase)throw new Error('SUPABASE_NOT_CONFIGURED')
  const payload={
    support_email:String(values.supportEmail||'').trim()||null,
    default_demo_duration_days:Math.min(365,Math.max(1,Number(values.defaultDemoDurationDays)||30)),
    maintenance_notice_enabled:Boolean(values.maintenanceNoticeEnabled),
    maintenance_notice_el:String(values.maintenanceNoticeEl||'').trim(),
    maintenance_notice_en:String(values.maintenanceNoticeEn||'').trim(),
  }
  const {data,error}=await supabase
    .from('platform_settings')
    .update(payload)
    .eq('id','global')
    .select('id,support_email,default_demo_duration_days,maintenance_notice_enabled,maintenance_notice_el,maintenance_notice_en,updated_at')
    .single()
  if(error)throw error
  return mapRow(data)
}
