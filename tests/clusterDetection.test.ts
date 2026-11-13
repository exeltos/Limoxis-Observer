import { describe, expect, it } from 'vitest'
import { detectOrganismClusters, clusterAlertId } from '../src/features/surveillance/clusterDetection'
import { isSkinFloraOrganism, SKIN_FLORA_PATTERN_SOURCE } from '../src/features/surveillance/skinFloraOrganisms'
import { readSource } from './helpers/readSource'

describe('detectOrganismClusters', () => {
  it('flags the tightest run of same-organism, same-department cases within the window', () => {
    const records = [
      { organism: 'Klebsiella pneumoniae', department: 'ΜΕΘ', date: '2026-08-16', resistance: 'MDR' },
      { organism: 'Klebsiella pneumoniae', department: 'ΜΕΘ', date: '2026-08-21', resistance: 'MDR' },
      { organism: 'Klebsiella pneumoniae', department: 'ΜΕΘ', date: '2026-08-27', resistance: 'MDR' },
      { organism: 'Escherichia coli', department: 'Παθολογική', date: '2026-05-18', resistance: 'ESBL' },
    ]
    const clusters = detectOrganismClusters(records, { windowDays: 14, threshold: 3 })
    expect(clusters).toHaveLength(1)
    expect(clusters[0]).toMatchObject({ department: 'ΜΕΘ', organism: 'Klebsiella pneumoniae', count: 3, firstDate: '2026-08-16', lastDate: '2026-08-27' })
    expect(clusters[0].resistanceLabels).toEqual(['MDR'])
  })

  it('reports count and dates from the same densest window when the group spans months', () => {
    const dates = ['2025-05-25', '2025-05-27', '2025-05-30', '2025-06-02', '2025-06-07', '2025-08-10', '2025-09-15', '2025-11-02']
    const records = dates.map(date => ({ organism: 'Acinetobacter baumannii', department: 'Αιμοκάθαρση', date }))
    const [cluster] = detectOrganismClusters(records, { windowDays: 14, threshold: 3 })
    expect(cluster).toMatchObject({ count: 5, firstDate: '2025-05-25', lastDate: '2025-06-07' })
    expect(cluster.lastEventDate).toBe('2025-11-02')
  })

  it('does not flag cases of the same organism spread across different departments', () => {
    const records = [
      { organism: 'Pseudomonas aeruginosa', department: 'ΜΕΘ', date: '2026-08-01' },
      { organism: 'Pseudomonas aeruginosa', department: 'Χειρουργική', date: '2026-08-05' },
      { organism: 'Pseudomonas aeruginosa', department: 'Παθολογική', date: '2026-08-08' },
    ]
    expect(detectOrganismClusters(records, { windowDays: 14, threshold: 3 })).toEqual([])
  })

  it('does not flag cases outside the rolling window even if the same organism/department recurs', () => {
    const records = [
      { organism: 'Acinetobacter baumannii', department: 'ΜΕΘ', date: '2026-01-10' },
      { organism: 'Acinetobacter baumannii', department: 'ΜΕΘ', date: '2026-04-06' },
      { organism: 'Acinetobacter baumannii', department: 'ΜΕΘ', date: '2026-08-22' },
    ]
    expect(detectOrganismClusters(records, { windowDays: 14, threshold: 3 })).toEqual([])
  })

  it('requires at least the threshold count to flag a cluster', () => {
    const records = [
      { organism: 'Staphylococcus aureus', department: 'Ορθοπαιδική', date: '2026-07-14' },
      { organism: 'Staphylococcus aureus', department: 'Ορθοπαιδική', date: '2026-07-16' },
    ]
    expect(detectOrganismClusters(records, { windowDays: 14, threshold: 3 })).toEqual([])
  })

  it('ignores records missing organism, department or date', () => {
    const records = [
      { organism: null, department: 'ΜΕΘ', date: '2026-08-16' },
      { organism: 'Klebsiella pneumoniae', department: null, date: '2026-08-21' },
      { organism: 'Klebsiella pneumoniae', department: 'ΜΕΘ', date: null },
    ]
    expect(detectOrganismClusters(records, { windowDays: 14, threshold: 3 })).toEqual([])
  })

  it('builds a stable, unique alert id per cluster', () => {
    const cluster = { department: 'ΜΕΘ', organism: 'Klebsiella pneumoniae', firstDate: '2026-08-16' }
    expect(clusterAlertId(cluster)).toBe('CLUSTER-ΜΕΘ-klebsiella_pneumoniae-2026-08-16')
  })
})

describe('skin flora rule', () => {
  const single = ['2026-08-01', '2026-08-03', '2026-08-05'].map((date, i) => ({ organism: 'Staphylococcus epidermidis', department: 'ΜΕΘ', date, patientId: `P${i}`, sampleId: `S${i}` }))

  it('does not flag skin flora seen once in each of several patients', () => {
    expect(detectOrganismClusters(single, { windowDays: 14, threshold: 3 })).toEqual([])
  })

  it('counts only patients with 2+ distinct samples, then counts patients', () => {
    const twice = ['P0', 'P1', 'P2', 'P3'].flatMap((patientId, i) => [
      { organism: 'Coagulase-negative staphylococci (CoNS)', department: 'ΜΕΘ', date: `2026-08-0${i + 1}`, patientId, sampleId: `${patientId}-a` },
      { organism: 'Coagulase-negative staphylococci (CoNS)', department: 'ΜΕΘ', date: `2026-08-0${i + 2}`, patientId, sampleId: `${patientId}-b` },
    ])
    const once = { organism: 'Coagulase-negative staphylococci (CoNS)', department: 'ΜΕΘ', date: '2026-08-03', patientId: 'P9', sampleId: 'P9-a' }
    const [cluster] = detectOrganismClusters([...twice, once], { windowDays: 14, threshold: 3 })
    expect(cluster).toMatchObject({ count: 4, skinFloraRule: true })
  })

  it('leaves pathogens counted per isolate and marks them without the rule', () => {
    const [cluster] = detectOrganismClusters(single.map(r => ({ ...r, organism: 'Staphylococcus aureus' })), { windowDays: 14, threshold: 3 })
    expect(cluster).toMatchObject({ count: 3, skinFloraRule: false })
  })

  it('recognises skin flora but not the pathogenic relatives', () => {
    for (const name of ['Staphylococcus epidermidis', 'Staphylococcus haemolyticus', 'Coagulase-negative staphylococci (CoNS)', 'Corynebacterium striatum', 'Bacillus cereus', 'Micrococcus luteus', 'Cutibacterium acnes', 'Viridans streptococci', 'Streptococcus sanguinis']) expect(isSkinFloraOrganism(name)).toBe(true)
    for (const name of ['Staphylococcus aureus', 'Corynebacterium diphtheriae', 'Bacillus anthracis', 'Staphylococcus saprophyticus', 'Streptococcus pyogenes', 'Escherichia coli', '']) expect(isSkinFloraOrganism(name)).toBe(false)
  })

  it('keeps the SQL function pattern identical to the JS list', () => {
    const sql = readSource('supabase/migrations/20261205200000_cluster_skin_flora_rule.sql')
    expect(sql).toContain(`'${SKIN_FLORA_PATTERN_SOURCE}'`)
  })
})

describe('clusters count patients', () => {
  it('counts a patient with repeated cultures once, however many isolates share a day', async () => {
    const { detectOrganismClusters } = await import('../src/features/surveillance/clusterDetection')
    const records = []
    for (const patientId of ['p1', 'p2', 'p3', 'p4']) for (const day of ['2025-10-16', '2025-10-16', '2025-10-20']) records.push({ organism: 'Staphylococcus aureus', department: 'Χειρουργική', date: day, patientId, sampleId: `${patientId}-${day}-${records.length}` })
    const [cluster] = detectOrganismClusters(records, { windowDays: 14, threshold: 3 })
    expect(cluster.count).toBe(4)
    expect(cluster.sampleCount).toBe(12)
  })
  it('starts each database window on a distinct day and counts distinct patients', () => {
    const sql = readSource('supabase/migrations/20261231220200_cluster_count_patients.sql')
    expect(sql).toContain('select distinct i.department_id, i.department_name, lower(i.organism) as org_key, i.event_date as window_start')
    expect(sql).toContain("count(*) filter (where not p.is_flora or p.n_samples >= 2)::bigint as window_count")
    expect(sql).toContain(`'${SKIN_FLORA_PATTERN_SOURCE}'`)
  })
})

describe('clusters of patients only', () => {
  it('leaves out the contaminated cultures and pins the rule to the database', async () => {
    const { isContaminationNote, CONTAMINATION_PATTERN_SOURCE } = await import('../src/features/surveillance/skinFloraOrganisms')
    expect(isContaminationNote('Αναπτύχθηκαν 3 είδη μικροβίων >= 10^5 cfu/ml - επιμόλυνση')).toBe(true)
    expect(isContaminationNote('ΑΝΑΠΤΥΞΗ 3 ΕΙΔΩΝ ΜΙΚΡΟΒΙΩΝ')).toBe(true)
    expect(isContaminationNote('Staphylococcus aureus')).toBe(false)
    const records = ['p1', 'p2', 'p3'].map(patientId => ({ organism: 'ΑΝΑΠΤΥΞΗ 3 ΕΙΔΩΝ ΜΙΚΡΟΒΙΩΝ', department: 'Παθολογική', date: '2025-07-23', patientId }))
    expect(detectOrganismClusters(records)).toEqual([])
    const sql = readSource('supabase/migrations/20261231220300_cluster_patients_only.sql')
    expect(sql).toContain(`m.organism !~* '${CONTAMINATION_PATTERN_SOURCE}'`)
    expect(sql).toContain("and l.patient_id is not null")
    expect(sql).toContain("not in ('surface', 'water', 'equipment', 'air', 'environment')")
  })
})
