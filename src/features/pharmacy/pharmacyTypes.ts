import type { Tables } from '../../core/supabase/database.types'

// The antibiotics dispensed to a department (or the whole hospital) in a period, as the screens keep them.
export type DispensingRecord = {
  id: string
  // «2026-07», or «2026-07 – 2026-09» for a range.
  period: string
  periodStart: string
  periodEnd: string
  departmentScope: string
  departmentEl: string
  departmentEn: string
  product: string
  productEn: string
  antibioticItemId: string
  productCode: string
  quantityGrams: number
  method: string
  referenceNumber: string
  responsible: string
  notes: string
  createdAt?: string | null
  createdById?: string | null
  updatedAt?: string | null
  updatedById?: string | null
}
// The form: a month or a range kept as it was, the quantity as typed.
export type DispensingDraft = Partial<Omit<DispensingRecord, 'quantityGrams'>> & { quantityGrams?: number | string, periodKind?: string }

// A row of antibiotic_dispensing_periods with its department and antibiotic.
export type DispensingRow = Tables<'antibiotic_dispensing_periods'> & { department?: { name: string } | null, antibiotic_item?: { name_el: string, name_en: string | null, code: string | null } | null }

// An antimicrobial therapy waiting for (or given) stewardship approval.
export interface TherapyApproval { id: string, caseId: string, patientCode: string, department: string, departmentEn: string, antimicrobial: string, dose: string, route: string, indication: string, startedAt: string | null, approvalStatus: string, status: string }
