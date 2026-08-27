export const GOVERNANCE_SOURCES = Object.freeze([
  {
    id: 'iso-7101-2023',
    authority: 'ISO',
    title: 'ISO 7101:2023 - Healthcare organization management - Management systems for quality in healthcare organizations',
    themes: ['leadership', 'risk', 'patient-safety', 'workforce-safety', 'documented-processes', 'measurement', 'continual-improvement'],
    implementation: 'Design control: workflows must be traceable, measurable and auditable. This registry is not a certification claim.',
  },
  {
    id: 'jci-hospital-8',
    authority: 'JCI',
    title: 'Joint Commission International Accreditation Standards for Hospitals, 8th Edition',
    themes: ['patient-safety', 'quality', 'infection-prevention', 'technology', 'cybersecurity', 'event-reporting'],
    implementation: 'Design reference only. Formal compliance requires licensed standards review and hospital-specific evidence.',
  },
  {
    id: 'who-ipc-core',
    authority: 'WHO',
    title: 'Core components for infection prevention and control programmes',
    themes: ['ipc-programme', 'guidelines', 'training', 'hai-surveillance', 'multimodal-strategy', 'monitoring-feedback'],
    implementation: 'Used to shape IPC workflows, surveillance, education and monitoring capabilities.',
  },
  {
    id: 'nhs-nipcm',
    authority: 'NHS England',
    title: 'National Infection Prevention and Control Manual - Standard Infection Control Precautions',
    themes: ['standard-precautions', 'risk-assessment', 'ppe', 'environment', 'transmission-prevention'],
    implementation: 'Used as a practical cross-check for IPC task and control design.',
  },
  {
    id: 'gr-ipc-regulation',
    authority: 'Hellenic Ministry of Health',
    title: 'Greek regulatory framework for prevention and control of healthcare-associated infections',
    themes: ['infection-control-committee', 'internal-regulation', 'indicators', 'management-accountability', 'surveillance'],
    implementation: 'National requirements take precedence where applicable; exact legal mapping is maintained per released workflow.',
  },
])

export const RELEASE_GOVERNANCE_CHECKS = Object.freeze([
  'Least-privilege UI and backend access agree',
  'Organization and department scope are explicit',
  'Sensitive employee-health data are separated from HR data',
  'Clinical completion/approval actions are auditable',
  'Destructive actions are limited and traceable',
  'Required indicators can be derived from structured data',
  'Workflow status changes preserve history',
  'Role-specific help and notifications do not leak inaccessible data',
])
