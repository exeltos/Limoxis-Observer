import { supabase } from '../../../core/supabase/client'
import { isDemoDataEnvironment } from '../../../core/data/dataEnvironment'
import { loadCertificates } from '../../employees/employeeRecordsService'

// Who holds an auditor certificate or finished an auditor training («Επιθεωρητής»):
// the competence check of an audit team reads these. A role that may not read the
// staff's certificates gets nothing, and the check only warns.

const AUDITOR_FILTER = 'title.ilike.%επιθεωρ%,title.ilike.%auditor%,title_en.ilike.%auditor%'

export async function loadAuditorCompetence(organizationId) {
  if (isDemoDataEnvironment()) {
    const certificates = (loadCertificates() || []).map(item => ({ employeeId: item.employeeId, title: item.titleEl || item.title || '', titleEn: item.titleEn || '', validUntil: item.validUntil || '' }))
    return { certificates, assignments: [], programs: [] }
  }
  if (!supabase || !organizationId) return { certificates: [], assignments: [], programs: [] }
  const [certificates, programs] = await Promise.all([
    supabase.from('employee_certificates').select('employee_id,title,title_en,valid_until').eq('organization_id', organizationId).or(AUDITOR_FILTER),
    supabase.from('training_programs').select('id,title,title_en,category').eq('organization_id', organizationId).or(AUDITOR_FILTER),
  ])
  const programRows = programs.data || []
  const assignments = programRows.length
    ? (await supabase.from('training_assignments').select('employee_id,program_id,status,completed_date').eq('organization_id', organizationId).in('program_id', programRows.map(item => item.id))).data || []
    : []
  return {
    certificates: (certificates.data || []).map(item => ({ employeeId: item.employee_id, title: item.title || '', titleEn: item.title_en || '', validUntil: item.valid_until || '' })),
    programs: programRows.map(item => ({ id: item.id, title: item.title || '', titleEn: item.title_en || '', category: item.category || '' })),
    assignments: assignments.map(item => ({ employeeId: item.employee_id, programId: item.program_id, status: item.status, completedDate: item.completed_date })),
  }
}
