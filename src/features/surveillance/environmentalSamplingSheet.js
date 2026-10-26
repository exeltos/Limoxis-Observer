// «Φύλλο καταγραφής σημείων δειγματοληψίας»: the sheet a sampler fills in the field and hands
// to the laboratory with the plates. One row per point, with the plate («τρυβλίο») and the spot on
// it («θέση»). Pure: the dialog prints it (reportDocument.printReport) and the test reads it.

// «Τρυβλίο Α · Θέση 1» for a sample, from whichever of the two it has.
export function environmentalPlateText(sample, t) {
  return [
    sample?.environmentalPlate && `${t('clinicalRecords.envPlate')} ${sample.environmentalPlate}`,
    sample?.environmentalPosition && `${t('clinicalRecords.envPosition')} ${sample.environmentalPosition}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

// points: [{ location, point, plate, position, code? }]; the sample codes are known once the points are saved.
export function environmentalSheetDocument({ language = 'el', t, department = '', date = '', typeLabel = '', methodLabel = '', points = [], notes = '', code = '' }) {
  const withCodes = points.some(point => point.code)
  const columns = [
    '#',
    t('locationArea'),
    t('samplingPoint'),
    t('clinicalRecords.envPlate'),
    t('clinicalRecords.envPosition'),
    ...(withCodes ? [t('sampleCode')] : []),
    t('notes'),
  ]
  const rows = points.map((point, index) => [
    String(index + 1),
    point.location || '',
    point.point || '',
    { text: point.plate || '', align: 'center' },
    { text: point.position || '', align: 'center' },
    ...(withCodes ? [point.code || ''] : []),
    '',
  ])
  return {
    language,
    kind: t('clinicalRecords.envSheetKind'),
    title: t('clinicalRecords.envSheetTitle'),
    code,
    orientation: 'landscape',
    meta: [
      [t('department'), department],
      [t('samplingDate'), date],
      [t('sampleType'), typeLabel],
      [t('samplingMethod'), methodLabel],
    ].filter(([, value]) => value),
    sections: [
      { title: t('clinicalRecords.envSheetPoints'), table: { columns, rows } },
      notes ? { title: t('notes'), text: notes } : null,
    ].filter(Boolean),
    signatures: [t('clinicalRecords.envSheetSampler'), t('clinicalRecords.envSheetLab')],
    filename: `${code || 'sampling-sheet'}`,
  }
}
