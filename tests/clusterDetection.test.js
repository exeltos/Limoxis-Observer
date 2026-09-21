import { describe, expect, it } from 'vitest'
import { detectOrganismClusters, clusterAlertId } from '../src/features/surveillance/clusterDetection'

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
