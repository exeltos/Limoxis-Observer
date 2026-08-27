import { createClient } from '@supabase/supabase-js'
import { appConfig, hasSupabaseConfig } from '../config/env'

export const supabase = hasSupabaseConfig
  ? createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
