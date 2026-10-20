import { useEffect, useState } from 'react'
import { DEMO_REPORT_MARK_EL, DEMO_REPORT_MARK_EN } from '../core/organization/branding'
import { cloudAttachmentsEnabled, loadAttachments } from '../core/attachments/attachmentService'
import { CONFIDENTIAL_LINE, eventLine, normalizeReport, pageLabel } from './recordReport'
import '../styles/record-report.css'

// The printed record as a clinical report: letterhead, title, summary and numbered
// sections, black on white, serif, no controls. The record page supplies the
// description (see recordReport.js); this component only lays it out.
const cssString = value => JSON.stringify(String(value || '')).replace(/</g, '\\3c ')

function Pairs({ pairs }) {
  if (!pairs.length) return null
  return <dl className="record-report-pairs">{pairs.map(([label, value], index) => <div key={`${label}-${index}`}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}

// The documents of a record as a plain list of file names (their descriptions beside them).
function Documents({ source, empty }) {
  const cloud = cloudAttachmentsEnabled() && source.organizationId && source.entityType && source.entityId
  const [loaded, setLoaded] = useState([])
  useEffect(() => {
    if (!cloud) return undefined
    let alive = true
    loadAttachments(source.organizationId, source.entityType, source.entityId).then(rows => { if (alive) setLoaded(rows) }).catch(() => {})
    return () => { alive = false }
  }, [cloud, source.organizationId, source.entityType, source.entityId])
  const files = cloud ? loaded : Array.isArray(source.value) ? source.value : []
  if (!files.length) return <p className="record-report-empty">{empty}</p>
  return <ul className="record-report-list">{files.map((file, index) => <li key={file.id || index}>{[file.name, file.description].filter(Boolean).join(' · ')}</li>)}</ul>
}

export function RecordReportPrint({ report, branding, printedAt, printedBy, language = 'el', fmtDateTime }) {
  const en = language === 'en'
  const doc = normalizeReport(report, { en })
  const L = (el, enText) => (en ? enText : el)
  const printedOn = printedAt ? fmtDateTime(printedAt) : ''
  const printedLine = `${L('Εκτυπώθηκε από', 'Printed by')} ${printedBy || '—'} · ${printedOn}`
  const headerLine = [branding?.name, [doc.kind, doc.code].filter(Boolean).join(' ')].filter(Boolean).join(' · ')
  const pageRules = `@media print{@page{size:A4;margin:22mm 20mm 20mm;@top-left{content:${cssString(headerLine)};font:9pt Georgia,"Times New Roman",serif;color:#000}@top-right{content:${cssString(printedOn)};font:9pt Georgia,"Times New Roman",serif;color:#000}@bottom-left{content:${cssString(CONFIDENTIAL_LINE(en))};font:9pt Georgia,"Times New Roman",serif;color:#000}@bottom-right{content:${cssString(pageLabel(en))} " " counter(page) " ${en ? 'of' : 'από'} " counter(pages);font:9pt Georgia,"Times New Roman",serif;color:#000}}@page :first{@top-left{content:none}@top-right{content:none}}}`
  return <article className="record-report" lang={en ? 'en' : 'el'} data-record-report="">
    <style>{pageRules}</style>
    <header className="record-report-letterhead">
      {branding?.logo && String(branding.logo).startsWith('data:') && <img src={branding.logo} alt="" />}
      <div className="record-report-org">
        <p className="record-report-org-name">{branding?.name || ''}</p>
        {branding?.reportHeader && <p>{branding.reportHeader}</p>}
        {branding?.demo && <p className="record-report-demo">{en ? DEMO_REPORT_MARK_EN : DEMO_REPORT_MARK_EL}</p>}
      </div>
      <dl className="record-report-meta">
        {doc.kind && <div><dt>{L('Είδος εγγραφής', 'Record type')}:</dt><dd>{doc.kind}</dd></div>}
        {doc.code && <div><dt>{L('Κωδικός', 'Code')}:</dt><dd>{doc.code}</dd></div>}
        <div><dt>{L('Ημερομηνία εκτύπωσης', 'Print date')}:</dt><dd>{printedOn}</dd></div>
        <div><dt>{L('Εκτυπώθηκε από', 'Printed by')}:</dt><dd>{printedBy || '—'}</dd></div>
      </dl>
    </header>
    <h1 className="record-report-title">{doc.title}</h1>
    {doc.subtitle && <p className="record-report-subtitle">{doc.subtitle}</p>}
    {doc.status && <p className="record-report-status">{doc.statusLabel || L('Κατάσταση', 'Status')}: {doc.status}</p>}
    {(doc.summaryText || doc.summaryPairs.length > 0) && <section className="record-report-summary" aria-label={L('Περίληψη', 'Summary')}>
      <h2>{L('Περίληψη', 'Summary')}</h2>
      {doc.summaryText && <p>{doc.summaryText}</p>}
      <Pairs pairs={doc.summaryPairs} />
    </section>}
    {doc.sections.map(section => <section className="record-report-section" key={section.id} data-report-section={section.id}>
      <h2>{section.number}. {section.title}</h2>
      {section.intro && <p>{section.intro}</p>}
      <Pairs pairs={section.pairs} />
      {section.text && <p>{section.text}</p>}
      {section.list.length > 0 && <ul className="record-report-list">{section.list.map((line, index) => <li key={index}>{line}</li>)}</ul>}
      {section.items.map((item, index) => <div className="record-report-item" key={index}>
        {item.title && <p className="record-report-item-title"><strong>{item.title}</strong>{item.meta ? ` · ${item.meta}` : ''}</p>}
        <div className="record-report-item-body">
          <Pairs pairs={item.pairs} />
          {item.text && <p>{item.text}</p>}
          {item.list.length > 0 && <ul className="record-report-list">{item.list.map((line, lineIndex) => <li key={lineIndex}>{line}</li>)}</ul>}
          {item.table.length > 0 && <dl className="record-report-antibiogram">{item.table.map(([drug, result], rowIndex) => <div key={rowIndex}><dt>{drug}</dt><dd>{result}</dd></div>)}</dl>}
        </div>
      </div>)}
      {section.events.length > 0 && <ul className="record-report-list record-report-events">{section.events.map((event, index) => <li key={index}>{eventLine(event)}</li>)}</ul>}
      {section.documents && <Documents source={section.documents} empty={section.documentsEmpty} />}
      {section.empty && <p className="record-report-empty">{section.empty}</p>}
    </section>)}
    <footer className="record-report-end">
      <p>{printedLine}</p>
      <p>{CONFIDENTIAL_LINE(en)}</p>
    </footer>
  </article>
}
