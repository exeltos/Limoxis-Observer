// Ο συνδεδεμένος χρήστης: η συνεδρία (Supabase, ή η τοπική του δείγματος και της
// προεπισκόπησης στο Κέντρο βοήθειας) και το προφίλ του (profiles).
export interface AuthUser {
  id: string
  email?: string | null
}

export interface AuthSession {
  access_token: string
  user: AuthUser
}

// Μια γραμμή του current_demo_access: οι ημερομηνίες και η κατάσταση του Demo ενός αξιολογητή.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- απάντηση jsonb του current_demo_access
export type DemoAccess = Record<string, any>

export interface Profile {
  id: string
  email?: string | null
  fullName?: string | null
  username?: string | null
  contactEmail?: string | null
  phone?: string | null
  jobTitle?: string | null
  isPlatformOwner?: boolean | null
  // Η είσοδος «Demo» του browser (νοσοκομείο-δείγμα), όχι οργανισμός Demo.
  isDemo: boolean
  role?: string
  demoEntitlementId?: string | null
  demoAccess?: DemoAccess[]
  // Προσωρινός κωδικός: αλλάζει πριν ανοίξει η εφαρμογή.
  mustChangePassword?: boolean
}

// Η τιμή του AuthContext (AuthProvider).
export interface AuthContextValue {
  session: AuthSession | null
  user: AuthUser | null
  profile: Profile | null
  loading: boolean
  isAuthenticated: boolean
  isDemoSession: boolean
  hasSupabaseConfig: boolean
  allowDemo: boolean
  login: (identifier: string, password: string) => Promise<unknown>
  loginDemo: () => void
  logout: () => Promise<void>
  markPasswordChanged: () => void
}
