export const v040Traceability = Object.freeze([
  { requirement:'Tenant-isolated patient and surveillance records', controls:['organization_id on every clinical table','RLS read boundary'], references:['ISO 7101 — documented processes, risk and safety'] },
  { requirement:'Structured HAI surveillance workflow', controls:['case lifecycle','typed surveillance events','due dates and reassessment state'], references:['WHO HAI surveillance practical handbook (2024)','WHO IPC core component 4'] },
  { requirement:'Audit-ready clinical completion', controls:['created_by','completed_by','completed_at','closed_by','closed_at'], references:['ISO 7101 — documented information and performance evaluation'] },
  { requirement:'Bilingual clinical UI', controls:['central EL/EN dictionary','el-GR/en-GB date locale','no patient/surveillance visible string outside i18n'], references:['Limoxis Observer product requirement'] },
])
