import { escapeHtml, printReport } from '../../core/export/reportDocument'
import { getReportBranding } from '../../core/organization/branding'

const fmt = (v, en) => {
  if (!v) return '—'
  const d = new Date(`${String(v).slice(0, 10)}T12:00:00`)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(en ? 'en-GB' : 'el-GR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
}

// The certificate as a landscape page on the shared document layout: the
// hospital's logo and name, the participant, the programme, its hours and
// dates, two signatures and the certificate number (also in the page footer).
export function certificateDocument({
  certificate,
  program,
  participantName,
  en = false,
  branding = getReportBranding(),
}) {
  const hospital = branding?.name || 'Limoxis Observer'
  const number = certificate?.id || '—'
  const facts = [
    [
      en ? 'Training date' : 'Ημερομηνία εκπαίδευσης',
      fmt(certificate?.completedDate || program?.startDate || certificate?.issuedDate, en),
    ],
    program?.durationHours
      ? [en ? 'Duration' : 'Διάρκεια', `${program.durationHours} ${en ? 'hours' : 'ώρες'}`]
      : null,
    program?.trainer ? [en ? 'Trainer' : 'Εκπαιδευτής', program.trainer] : null,
    [en ? 'Issued' : 'Ημερομηνία έκδοσης', fmt(certificate?.issuedDate, en)],
    [
      en ? 'Valid until' : 'Ισχύς έως',
      certificate?.validUntil ? fmt(certificate.validUntil, en) : en ? 'No expiry' : 'Χωρίς λήξη',
    ],
  ].filter(Boolean)
  const signature = role =>
    `<td><strong>${escapeHtml(role)}</strong><span>${en ? 'Name' : 'Ονοματεπώνυμο'}:</span><span>${en ? 'Signature' : 'Υπογραφή'}:</span></td>`
  const body = `<div class="rd-certificate">
    ${branding?.logo ? `<div class="rd-cert-logo"><img src="${escapeHtml(branding.logo)}" alt=""></div>` : ''}
    <p class="rd-cert-org">${escapeHtml(hospital)}</p>
    ${branding?.reportHeader ? `<p class="rd-cert-sub">${escapeHtml(branding.reportHeader)}</p>` : ''}
    <h1>${en ? 'Certificate of completion' : 'Βεβαίωση παρακολούθησης'}</h1>
    <p class="rd-cert-lead">${en ? 'This certifies that' : 'Βεβαιώνεται ότι ο/η'}</p>
    <p class="rd-cert-name">${escapeHtml(participantName || '—')}</p>
    <p class="rd-cert-lead">${en ? 'has successfully completed the training programme' : 'ολοκλήρωσε με επιτυχία το πρόγραμμα εκπαίδευσης'}</p>
    <p class="rd-cert-programme">${escapeHtml(program?.title || '—')}</p>
    <table class="rd-cert-facts">${facts.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td><strong>${escapeHtml(value)}</strong></td></tr>`).join('')}</table>
    <table class="rd-signatures"><tr>${signature(en ? 'Trainer' : 'Ο/Η εκπαιδευτής/τρια')}${signature(certificate?.issuer || (en ? 'For the hospital' : 'Για το νοσοκομείο'))}</tr></table>
    <p class="rd-cert-number">${en ? 'Certificate no.' : 'Αρ. βεβαίωσης'} <strong>${escapeHtml(number)}</strong></p>
  </div>`
  return {
    language: en ? 'en' : 'el',
    orientation: 'landscape',
    band: false,
    kind: en ? 'Training certificate' : 'Βεβαίωση εκπαίδευσης',
    code: number,
    title: program?.title || '',
    footer: `${en ? 'Certificate no.' : 'Αρ. βεβαίωσης'} ${number} · ${participantName || ''}`,
    body,
    filename: `${number}_${participantName || ''}`,
  }
}

// Opens the certificate for printing / «Save as PDF» (real text). Throws when
// the browser blocked the window, so the caller can say so.
export async function downloadCertificatePdf({
  certificate,
  program,
  participantName,
  en = false,
  pdf = false,
}) {
  if (!printReport(certificateDocument({ certificate, program, participantName, en }), { pdf }))
    throw new Error(
      en
        ? 'Allow pop-ups to print the certificate.'
        : 'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση της βεβαίωσης.',
    )
}
