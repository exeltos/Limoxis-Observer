// Τύποι της ενότητας δεικτών. Οι ορισμοί υπάρχουν σε δύο μορφές: οι γραμμές της
// βάσης (snake_case, IndicatorDefinitionRow / IndicatorSnapshotRow) και το
// αντικείμενο της οθόνης (camelCase, IndicatorDefinition). Οι υπολογισμένοι
// δείκτες (OperationalIndicator → CalculatedIndicator) και η γραμμή της λίστας
// (IndicatorRow) κλείνουν το σύνολο.

// Το κείμενο ορισμού αριθμητή/παρονομαστή (json με ένα πεδίο περιγραφής).
export interface IndicatorTextDefinition { description?: string }

// Το αντικείμενο ορισμού δείκτη όπως το κρατούν οι οθόνες (toDefinition / φόρμα).
export interface IndicatorDefinition {
  id: string | null
  organizationId?: string | null
  system: boolean
  key: string
  version: string
  titleEl: string
  titleEn?: string
  category: string
  numeratorDefinition: IndicatorTextDefinition
  denominatorDefinition: IndicatorTextDefinition
  numeratorMetric: string
  denominatorMetric: string
  multiplier: number
  unit: string
  sourceAuthority: string
  source?: string
  effectiveFrom: string
  effectiveTo: string
  status: string
  calculationType: string
  targetValue: string
  direction: string
  approvedAt?: string | null
  visibleDepartmentIds: string[]
}

// Μια γραμμή ορισμού δείκτη της βάσης (ή demo): τα πεδία διαβάζονται με Number/String/|| ,
// γι' αυτό είναι χαλαρά, ώστε να δέχονται και τις γραμμές της Supabase και τις demo.
export interface IndicatorDefinitionRow {
  id: string
  organization_id?: string | null
  indicator_key: string
  version?: string | null
  title_el?: string | null
  title_en?: string | null
  category?: string | null
  numerator_definition?: unknown
  denominator_definition?: unknown
  numerator_metric?: string | null
  denominator_metric?: string | null
  multiplier?: number | string | null
  unit?: string | null
  unit_en?: string | null
  source_authority?: string | null
  effective_from?: string | null
  effective_to?: string | null
  status?: string | null
  calculation_type?: string | null
  target_value?: number | string | null
  direction?: string | null
  approved_at?: string | null
  approved_by?: string | null
  created_by?: string | null
  visible_department_ids?: unknown
}

// Μια γραμμή στιγμιότυπου δείκτη (indicator_snapshots), όσο τη διαβάζουν οι οθόνες.
export interface IndicatorSnapshotRow {
  id: string
  organization_id?: string | null
  indicator_key?: string | null
  definition_id?: string | null
  department_id?: string | null
  period_start?: string | null
  period_end?: string | null
  value?: number | string | null
  numerator?: number | string | null
  denominator?: number | string | null
  unit?: string | null
  target_value?: number | string | null
  direction?: string | null
  calculation_type?: string | null
  source_snapshot?: unknown
  status?: string | null
  calculated_at?: string | null
  calculated_by?: string | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  notes?: string | null
  created_at?: string | null
  updated_at?: string | null
}

// Ο λειτουργικός ορισμός δείκτη (mapOperationalDefinition): numerator/denominator είναι κλειδιά μετρικών.
export interface OperationalIndicator {
  definitionId: string
  id: string
  version?: string | null
  titleEl: string
  titleEn: string
  category: string
  numerator?: string | null
  denominator?: string | null
  multiplier: number
  unit: string
  unitEn: string
  source: string
  calculation: string
  target: number | null
  direction: string
  numeratorDefinition: IndicatorTextDefinition
  denominatorDefinition: IndicatorTextDefinition
  visibleDepartmentIds: string[]
  manualValue?: string
}

// Ό,τι χρειάζεται ο υπολογισμός ενός δείκτη (calculateCloudDefinition): τον δέχονται και
// οι ορισμοί της Ποιότητας (PlatformIndicatorDef), που έχουν λιγότερα πεδία.
export interface IndicatorCalculationInput {
  numerator?: string | null
  denominator?: string | null
  multiplier?: number | null
  calculation: string
  manualValue?: string | number | null
  target: number | null
  direction: string
}
// Ο υπολογισμένος δείκτης: numerator/denominator γίνονται αριθμοί (κλειδί που δεν
// αναφέρθηκε διαβάζεται όπως το null από όλους τους αναγνώστες).
export type CalculatedIndicatorOf<T extends IndicatorCalculationInput> = Omit<T, 'numerator' | 'denominator'> & {
  numerator: number | null
  denominator: number | null
  value: number | null
  status: string
  evidence: string
}
export type CalculatedIndicator = CalculatedIndicatorOf<OperationalIndicator>

// Η γραμμή της λίστας δεικτών (υπολογισμένος δείκτης ή δείκτης μητρώου).
export interface IndicatorRow {
  id: string
  definitionId?: string
  registerId?: string
  indicatorKey?: string
  titleEl?: string | null
  titleEn?: string | null
  category?: string | null
  source?: string
  value: number | null
  unit?: string | null
  unitEn?: string | null
  status: string
  target?: number | string | null
  direction?: string
  evidence?: string
  calculation?: string
  manualValue?: string
}

// Ένα τμήμα, όσο το διαβάζουν οι οθόνες δεικτών.
export interface IndicatorDepartmentRow { id: string, name?: string, nameEn?: string, is_active?: boolean }

// Ένας στόχος ποιότητας (quality objectives), όσο τον διαβάζουν οι οθόνες δεικτών.
export interface IndicatorObjectiveRow {
  id: string
  year?: number | string
  status?: string
  code?: string
  title?: string
  titleEn?: string
  target?: number | string | null
  direction?: string
  ownerLabel?: string
  registerId?: string | null
  indicatorKey?: string
  platformIndicatorKey?: string
}

// Ένας στόχος επιτροπής (committee_plan_items με σύνδεση committee), για έναν δείκτη.
export interface CommitteeObjectiveRow {
  id: string
  title?: string | null
  baseline?: string | null
  target?: string | null
  owner_label?: string | null
  due_date?: string | null
  status?: string | null
  committee?: { code?: string | null, name?: string | null } | null
}
