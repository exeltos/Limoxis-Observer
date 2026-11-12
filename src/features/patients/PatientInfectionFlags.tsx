import { ShieldAlert } from 'lucide-react'

// Compact MDR / isolation badges for the patient registry "Flags" column.
export function PatientInfectionFlags({ flags, t, fmtDate }) {
  if (!flags?.resistance && !flags?.isolation) return null
  const resistance = flags.resistance
  const resistanceTitle = resistance ? [t('infectionFlags.resistanceTitle'), resistance.organism, resistance.since ? fmtDate(resistance.since) : ''].filter(Boolean).join(' · ') : ''
  const isolationTitle = flags.isolation ? [t('infectionFlags.isolationTitle'), flags.isolation.since ? fmtDate(flags.isolation.since) : ''].filter(Boolean).join(' · ') : ''
  return <span className="patient-infection-flags">
    {resistance && <span className="status-badge danger" title={resistanceTitle} aria-label={resistanceTitle}>{resistance.classification}</span>}
    {flags.isolation && <span className="status-badge temporary patient-isolation-flag" title={isolationTitle} aria-label={isolationTitle}><ShieldAlert size={12}/>{t('infectionFlags.isolation')}</span>}
  </span>
}
