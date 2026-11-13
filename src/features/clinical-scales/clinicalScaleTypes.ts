import type { Tables } from '../../core/supabase/database.types'
import type { ScaleParts, ScaleValues } from './clinicalScaleEngine'

// How a scale is scored and shown (the definition's json).
export type ScaleDefinitionDetails = { scoringStatus?: string, scoreRange?: number[], threshold?: number, decisionSupportOnly?: boolean, [key: string]: unknown }
// A scale of the library, with the hospital's own setting (the Demo's definitions leave out the dates).
export type ScaleDefinition = Omit<Tables<'clinical_scale_definitions'>, 'created_at' | 'updated_at' | 'definition'> & {
  definition?: ScaleDefinitionDetails
  created_at?: string
  updated_at?: string
  orgSetting?: Partial<Pick<Tables<'clinical_scale_org_settings'>, 'enabled' | 'availability' | 'reassessment_hours'>> | null
}
// What an assessment keeps of its scale for the report.
export type ScaleReportSnapshot = { scaleNameEl?: string, scaleNameEn?: string, sourceAuthority?: string | null, sourceReference?: string | null, [key: string]: unknown }
// An assessment as the record reads it: the row, its scale's names and its answers.
export type ScaleAssessment = Omit<Partial<Tables<'patient_clinical_scale_assessments'>>, 'answers' | 'score_parts' | 'report_snapshot' | 'score'> & {
  id: string
  scale_key: string
  scale_definition_id: string
  patient_id: string
  assessed_at: string
  score?: number | null
  answers?: ScaleValues
  score_parts?: ScaleParts
  report_snapshot?: ScaleReportSnapshot | null
  scale?: { name_el?: string, name_en?: string, category?: string, scale_key?: string } | null
  name_el?: string
  name_en?: string
  risk?: string | null
  delta?: number | null
}
// A scale in the patient's record: its definition, the latest assessments and what is due.
export type ScaleContextRow = ScaleDefinition & { recommended: boolean, reason: string | null, availability: string, latest: ScaleAssessment | null, previous: ScaleAssessment | null, dueAt: string | null, state: string, delta: number | null }
// What the scales read of the patient's admission (the care setting decides which apply).
export type ScaleAdmission = { id?: string | null, care_setting?: string | null, setting?: string | null, department_type?: string | null, department_name?: string | null, department?: { name?: string | null, type?: string | null } | null }
// What the scales read of the patient (the Demo knows them by their code).
export type ScalePatient = { id?: string, recordId?: string | null, dateOfBirth?: string | null }
