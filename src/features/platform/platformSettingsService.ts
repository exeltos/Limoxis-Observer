import { supabase as configuredClient, type Cloud } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isOwnerPreview,previewPlatformSettings } from '../../core/preview/ownerPreview'
import type { Tables } from '../../core/supabase/database.types'

// The calls below run with a configured client: the demo and an unconfigured build return before them.
const supabase = configuredClient as Cloud

// The platform settings as the screens keep them (the one platform_settings row, id «global»).
export interface PlatformSettings {
  id: string
  supportEmail: string
  defaultDemoDurationDays: number
  demoAutoPurgeAfterDays: number
  organizationDeletionGraceDays: number
  maxDemoUsers: number
  maintenanceNoticeEnabled: boolean
  maintenanceNoticeEl: string
  maintenanceNoticeEn: string
  // Η δημόσια «Σελίδα παρουσίασης» (πριν τη σύνδεση): εταιρεία, email, τηλέφωνο, ιστοσελίδα.
  publicName: string
  publicEmail: string
  publicPhone: string
  publicWebsite: string
  updatedAt: string | null
}
// What updatePlatformSettings saves: the settings as edited (a number field holds the text typed in it until saved).
export type PlatformSettingsInput = { [K in keyof PlatformSettings]?: PlatformSettings[K] | string | null }
type PlatformSettingsRow = Omit<Tables<'platform_settings'>, 'updated_by'>

const fallback: PlatformSettings={
  id:'global',
  supportEmail:'',
  defaultDemoDurationDays:30,
  demoAutoPurgeAfterDays:14,
  organizationDeletionGraceDays:30,
  maxDemoUsers:5,
  maintenanceNoticeEnabled:false,
  maintenanceNoticeEl:'',
  maintenanceNoticeEn:'',
  publicName:'',
  publicEmail:'',
  publicPhone:'',
  publicWebsite:'',
  updatedAt:null,
}

function mapRow(row: PlatformSettingsRow | null): PlatformSettings{
  if(!row)return fallback
  return {
    id:row.id||'global',
    supportEmail:row.support_email||'',
    defaultDemoDurationDays:Number(row.default_demo_duration_days)||30,
    demoAutoPurgeAfterDays:row.demo_auto_purge_after_days==null?14:Number(row.demo_auto_purge_after_days),
    organizationDeletionGraceDays:Number(row.organization_deletion_grace_days)||30,
    maxDemoUsers:Number(row.max_demo_users)||5,
    maintenanceNoticeEnabled:Boolean(row.maintenance_notice_enabled),
    maintenanceNoticeEl:row.maintenance_notice_el||'',
    maintenanceNoticeEn:row.maintenance_notice_en||'',
    publicName:row.public_name||'',
    publicEmail:row.public_email||'',
    publicPhone:row.public_phone||'',
    publicWebsite:row.public_website||'',
    updatedAt:row.updated_at||null,
  }
}

export async function getPlatformSettings(): Promise<PlatformSettings>{
  if(isOwnerPreview())return previewPlatformSettings()
  if(!hasSupabaseConfig||!supabase)return fallback
  const {data,error}=await supabase
    .from('platform_settings')
    .select('id,support_email,default_demo_duration_days,demo_auto_purge_after_days,organization_deletion_grace_days,max_demo_users,maintenance_notice_enabled,maintenance_notice_el,maintenance_notice_en,public_name,public_email,public_phone,public_website,updated_at')
    .eq('id','global')
    .single()
  if(error)throw error
  return mapRow(data)
}

export async function updatePlatformSettings(values: PlatformSettingsInput){
  if(!hasSupabaseConfig||!supabase)throw new Error('SUPABASE_NOT_CONFIGURED')
  const payload={
    support_email:String(values.supportEmail||'').trim()||null,
    default_demo_duration_days:Math.min(365,Math.max(1,Number(values.defaultDemoDurationDays)||30)),
    // 0 = expired Demos are never deleted automatically.
    demo_auto_purge_after_days:Math.min(365,Math.max(0,Math.round(Number(values.demoAutoPurgeAfterDays??14)))),
    organization_deletion_grace_days:Math.min(365,Math.max(1,Math.round(Number(values.organizationDeletionGraceDays)||30))),
    max_demo_users:Math.min(20,Math.max(1,Math.round(Number(values.maxDemoUsers)||5))),
    maintenance_notice_enabled:Boolean(values.maintenanceNoticeEnabled),
    maintenance_notice_el:String(values.maintenanceNoticeEl||'').trim(),
    maintenance_notice_en:String(values.maintenanceNoticeEn||'').trim(),
    // Σελίδα παρουσίασης: μόνο όταν η φόρμα τα έχει (ένα κενό πεδίο = η σελίδα δείχνει την αρχική τιμή του κώδικα).
    ...('publicName' in values?{
      public_name:String(values.publicName||'').trim()||null,
      public_email:String(values.publicEmail||'').trim()||null,
      public_phone:String(values.publicPhone||'').trim()||null,
      public_website:String(values.publicWebsite||'').trim()||null,
    }:{}),
  }
  const {data,error}=await supabase
    .from('platform_settings')
    .update(payload)
    .eq('id','global')
    .select('id,support_email,default_demo_duration_days,demo_auto_purge_after_days,organization_deletion_grace_days,max_demo_users,maintenance_notice_enabled,maintenance_notice_el,maintenance_notice_en,public_name,public_email,public_phone,public_website,updated_at')
    .single()
  if(error)throw error
  return mapRow(data)
}
