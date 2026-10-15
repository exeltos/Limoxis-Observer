import { SectionHeader } from './SectionHeader'

// One tab of a record (assessments, surveillance, documents, history), laid
// out like the registry lists: one surface, the same header row (title,
// optional one-line subtitle, actions on the right), content that fills the
// height and scrolls inside, and an optional footer (pagination) kept at the
// bottom. Tables inside run edge to edge, without a card of their own.
export function RecordTabPanel({title,subtitle,actions,footer,children,className=''}){
  return <section className={`record-tab-panel ${className}`.trim()}>
    <SectionHeader className="record-tab-panel-header" title={title} subtitle={subtitle} actions={actions}/>
    <div className="record-tab-panel-body">{children}</div>
    {footer}
  </section>
}
