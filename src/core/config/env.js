const env = import.meta.env

export const appConfig = Object.freeze({
  supabaseUrl: env.VITE_SUPABASE_URL?.trim() ?? '',
  supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY?.trim() ?? '',
  appEnv: env.VITE_APP_ENV?.trim() || 'development',
  allowDemo: (env.VITE_ALLOW_DEMO ?? 'true') !== 'false',
})

export const hasSupabaseConfig = Boolean(appConfig.supabaseUrl && appConfig.supabaseAnonKey)
