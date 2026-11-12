import type { ComponentType, ReactNode } from 'react'

// Τύποι που μοιράζονται τα στοιχεία του design-system.

// Ένα εικονίδιο (lucide-react ή δικό μας) που το στοιχείο σχεδιάζει μόνο του.
export type IconType = ComponentType<{ size?: number | string; className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>

// Ο χρωματισμός μιας κατάστασης (StatusBadge, MetricCard, Meter…).
export type Tone = 'neutral' | 'success' | 'info' | 'warning' | 'danger'

// Μια επιλογή λίστας (ChoiceField, MultiSelect, SearchableSelect).
export interface SelectOption<V = string> {
  value: V
  label: string
}

// Τα props που δίνει το useFormValidation σε ένα πεδίο: `{...form.field('key')}`.
export interface ValidatedFieldProps {
  required?: boolean
  error?: string
  hint?: ReactNode
  fieldKey?: string
}

// The hospital band of printed documents (core/organization/branding: getReportBranding).
export interface ReportBranding {
  name?: string
  logo?: string
  reportHeader?: string
  demo?: boolean
  printedBy?: string
}
