import './patientsScreens.css'
import { ShieldAlert } from 'lucide-react'
import type { InfectionFlags } from './patientInfectionFlagsService'

// Compact MDR / isolation badges for the patient registry "Flags" column.
export function PatientInfectionFlags({ flags, t, fmtDate }: { flags?: InfectionFlags | null, t: (key: string) => string, fmtDate: (value: string) => string }) {
  if (!flags?.resistance && !flags?.isolation && !flags?.organism) return null
  const resistance = flags.resistance
  const resistanceTitle = resistance ? [t('infectionFlags.resistanceTitle'), resistance.organism, resistance.since ? fmtDate(resistance.since) : ''].filter(Boolean).join(' · ') : ''
  const isolationTitle = flags.isolation ? [t('infectionFlags.isolationTitle'), flags.isolation.since ? fmtDate(flags.isolation.since) : ''].filter(Boolean).join(' · ') : ''
  return <span className="patient-infection-flags">
    {/* The latest organism of a positive culture, resistant or not (owner, 19/11/2026). */}
    {flags.organism && <span className="patient-infection-organism" title={[flags.organism.name, flags.organism.since ? fmtDate(flags.organism.since) : ''].filter(Boolean).join(' · ')}>{flags.organism.name}</span>}
    {resistance && <span className="status-badge danger" title={resistanceTitle} aria-label={resistanceTitle}>{resistance.classification}</span>}
    {flags.isolation && <span className="status-badge temporary patient-isolation-flag" title={isolationTitle} aria-label={isolationTitle}><ShieldAlert size={12}/>{t('infectionFlags.isolation')}</span>}
  </span>
}
