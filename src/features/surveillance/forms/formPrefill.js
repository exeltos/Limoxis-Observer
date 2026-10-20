import { athensHour, athensToday, shiftForHour } from './formStatus'

// What every form opened from an episode already knows: patient, admission, episode. Built
// once here, so the bundle, the incident report, the notifiable report and the exposure
// record start from the same values (the PrefilledList shows them locked).
export function patientDisplayName(ctx) {
  const { patient, record, language } = ctx
  return language === 'en'
    ? patient?.nameEn || record?.patientEn || patient?.name || record?.patient || ''
    : patient?.name || record?.patient || ''
}

export function episodeContext(ctx, episode = ctx.record) {
  const { patient, admission, fmtDate, language } = ctx
  const en = language === 'en'
  const department = (en ? episode?.departmentEn : episode?.department) || episode?.department || admission?.department || patient?.department || ''
  const admissionDate = admission?.admissionDate || episode?.admissionDate || patient?.admissionDate || ''
  const name = patientDisplayName(ctx)
  const code = patient?.id || episode?.patientId || ''
  return {
    patientRecordId: patient?.recordId || episode?.patientRecordId || '',
    patientCode: code,
    patientName: name,
    patientLabel: [code, name].filter(Boolean).join(' · '),
    admissionId: admission?.id || episode?.admissionId || '',
    admissionLabel: [department, admissionDate && fmtDate(admissionDate)].filter(Boolean).join(' · '),
    episodeId: episode?.id || '',
    episodeRecordId: episode?.recordId || episode?.id || '',
    episodeLabel: episode ? [episode.id, episode.startedAt && fmtDate(episode.startedAt)].filter(Boolean).join(' · ') : '',
    departmentId: episode?.departmentId || admission?.departmentId || '',
    departmentName: department,
  }
}

// The state a form page needs to send the user back to this tab.
export function episodeReturn(ctx) {
  return {
    returnTo: ctx.returnPath,
    returnState: { openTab: 'episodeForms', ...(ctx.admission?.id && ctx.patientMode ? { admissionId: ctx.admission.id } : {}) },
  }
}

export function buildBundlePrefill({ ctx, device, episode, info, now = new Date() }) {
  const base = episodeContext(ctx, episode)
  const en = ctx.language === 'en'
  return {
    surveillanceCaseId: base.episodeRecordId,
    surveillanceDeviceId: device.id,
    patientRecordId: base.patientRecordId,
    patientLabel: base.patientLabel,
    admissionLabel: base.admissionLabel,
    episodeLabel: base.episodeLabel,
    deviceLabel: [en ? device.nameEn || device.name : device.name, en ? device.siteEn || device.site : device.site].filter(Boolean).join(' · '),
    deviceDay: info.deviceDay,
    departmentId: base.departmentId,
    departmentName: base.departmentName,
    bundleKeys: info.bundleKeys,
    date: athensToday(now),
    shift: shiftForHour(athensHour(now)),
  }
}
