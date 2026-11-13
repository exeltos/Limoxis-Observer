import type { Tables } from '../../core/supabase/database.types'
import type { IconType } from '../../design-system/types'
import type { EmptyStateAction } from '../../design-system/RegistryEmptyState'

// The shapes of environmental surveillance and of the culture programme (the
// laboratory's samples as these screens read them, camelCase after hydration).

// A microbiology result of a sample: what the limit and the growth are read from.
export interface EnvironmentalResult {
  result?: string | null
  resultStatus?: string | null
  organism?: string | null
  cfuCount?: number | string | null
  cfuLimit?: number | string | null
}

// Where a sample sits on its culture plate («Τρυβλίο Α · Θέση 1»).
export interface PlatePlace {
  environmentalPlate?: string | null
  environmentalPosition?: string | number | null
}

// A laboratory sample of the environmental registry (laboratory_samples, hydrated).
export interface EnvironmentalSample extends PlatePlace {
  id?: string
  code?: string | null
  status?: Tables<'laboratory_samples'>['status']
  type?: string | null
  subjectType?: string | null
  department?: string | null
  departmentEn?: string | null
  departmentId?: string | null
  location?: string | null
  point?: string | null
  source?: string | null
  environmentalMethod?: string | null
  environmentalBatchId?: string | null
  collectedAt?: string | null
  requestedAt?: string | null
  result?: string | null
  microbiologyResults?: EnvironmentalResult[] | null
}

// A department to sample, as the dialog lists it.
export interface DepartmentOption { value: string, label: string, labelEn?: string }

// The prefill of a new sampling (a resample of an earlier point).
export interface EnvironmentalInitial {
  resampleOf?: string | null
  subjectType?: string
  sourceCode?: string | null
  departmentValue?: string
  location?: string
  point?: string
}

// A point of a sampling as typed in the dialog (batch mode keeps one per row).
export interface SamplingPointRow { id: number, location: string, point: string, plate: string, position: string }
// A point of the recording sheet; the sample code is known once it is saved.
export interface SheetPoint { location?: string, point?: string, plate?: string, position?: string, code?: string }
// The sampling just saved: its code (batch or sample) and points.
export interface CreatedSampling { code: string, points: SheetPoint[] }

// The empty state the Surveillance page hands to a registry.
export interface RegistryEmpty {
  title?: string
  text?: string
  filtered?: boolean
  onClear?: () => void
  icon?: IconType
  action?: EmptyStateAction | null
}

// Culture programme

// How often a control is due (control_definitions.frequency_config, a Json column).
export interface CultureFrequency { kind?: string, interval?: number | string }

// A culture control of the programme, from the controls (cloud or local).
export interface CultureControl {
  code: Tables<'control_definitions'>['code']
  title: Tables<'control_definitions'>['title']
  category?: string
  status?: string
  frequency?: CultureFrequency | null
  cultureDepartment?: string
  cultureSampleTypes?: string[]
  cultureGroup: string
  departments?: string[]
}

// One culture of the programme: a department's (with its kinds of sample) or a group's (staff, air, network water).
export interface CultureItem {
  id: string
  code: string
  title: string
  department: string
  group?: string
  sampleTypes: string[]
  // A group's: the department|kind pairs a department's culture already names.
  claimed?: string[]
  every: number
}

// An environmental (or staff screening) sample as the programme reads it; `outside` when a result is out of limit.
export interface CultureSample extends EnvironmentalSample {
  outside?: boolean
}

// The environmental samples of one department on one day.
export interface SamplingRound {
  key: string
  department: string
  day: string
  types: Set<string>
  samples: CultureSample[]
  outside: number
}

export type CultureState = '' | 'done' | 'missed' | 'due' | 'planned'
// One month of a culture's year.
export interface CultureMonth { month: number, state: CultureState, rounds: SamplingRound[] }
// A culture with its twelve months.
export interface CultureLine { item: CultureItem, months: CultureMonth[] }
// A round opened for its results (no culture when it is out of programme).
export interface OpenRound { item: CultureItem | null, round: SamplingRound }
// The programme as read: its cultures and the sampling rounds.
export interface CultureProgrammeData { items: CultureItem[], rounds: SamplingRound[] }
// A protocol limit of the laboratory (owned by the laboratory; passed through to the limit check, not read here).
export type EnvironmentalStandard = Record<string, unknown>
// A line of the results dialog: one result of a sample (none yet: null) and the limit it is held to.
export interface CultureResultRow { key: string, sample: CultureSample, result: EnvironmentalResult | null, limit: number | null }
