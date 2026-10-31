// Shared by the organization record and its tabs (the regions, the roles a user can hold,
// the form section and the organization draft).

export const GREEK_REGIONS = [
  'Ανατολική Μακεδονία και Θράκη',
  'Κεντρική Μακεδονία',
  'Δυτική Μακεδονία',
  'Ήπειρος',
  'Θεσσαλία',
  'Ιόνια Νησιά',
  'Δυτική Ελλάδα',
  'Στερεά Ελλάδα',
  'Αττική',
  'Πελοπόννησος',
  'Βόρειο Αιγαίο',
  'Νότιο Αιγαίο',
  'Κρήτη',
]
export const HEALTH_REGIONS = [
  '1η ΥΠΕ Αττικής',
  '2η ΥΠΕ Πειραιώς και Αιγαίου',
  '3η ΥΠΕ Μακεδονίας',
  '4η ΥΠΕ Μακεδονίας και Θράκης',
  '5η ΥΠΕ Θεσσαλίας και Στερεάς Ελλάδας',
  '6η ΥΠΕ Πελοποννήσου, Ιονίων Νήσων, Ηπείρου και Δυτικής Ελλάδας',
  '7η ΥΠΕ Κρήτης',
]
export const ROLES = [
  'hospital_admin',
  'infection_control_lead',
  'infection_control_member',
  'department_manager',
  'department_user',
  'laboratory',
  'committee_secretariat',
  'hr_office',
  'pharmacy',
  'occupational_physician',
  'doctor_reviewer',
  'quality_manager',
  'hospital_director',
  'link_nurse',
  'staff_user',
]

export function FormSection({ title, subtitle, actions, children }) {
  return (
    <section className="platform-form-section">
      <header>
        <div>
          <strong>{title}</strong>
          {subtitle && <span>{subtitle}</span>}
        </div>
        {actions && <div className="platform-form-section-actions">{actions}</div>}
      </header>
      {children}
    </section>
  )
}

export function toDraft(org) {
  return {
    id: org.id,
    name: org.name || '',
    code: org.code || '',
    type: org.type || 'hospital',
    status: org.status || 'active',
    region: org.region || '',
    healthRegion: org.health_region || '',
    city: org.city || '',
    country: org.country || '',
    contactEmail: org.contact_email || '',
    contactPhone: org.contact_phone || '',
    bedCapacity: org.bed_capacity ?? '',
  }
}
export function organizationTypeLabel(type, language = 'el') {
  const labels = {
    hospital: { el: 'Νοσοκομείο', en: 'Hospital' },
    clinic: { el: 'Κλινική', en: 'Clinic' },
    group: { el: 'Όμιλος', en: 'Group' },
    other: { el: 'Άλλο', en: 'Other' },
  }
  return labels[type]?.[language === 'en' ? 'en' : 'el'] || type || '—'
}
