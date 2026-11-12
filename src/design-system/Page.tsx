import { createContext, useContext, type ReactNode } from 'react'
import { SectionTabStrip, SectionTabsProvider, useSectionTabs } from './SectionTabs'

// A screen shown as a tab of another page (e.g. the indicators list in the
// Management Center) keeps its actions and content but not its own heading.
const PageEmbedContext = createContext(false)
// Whether the screen is shown inside another page (it then leaves out its own heading).
export const usePageEmbedded = () => useContext(PageEmbedContext)
export function PageEmbedProvider({ children }: { children?: ReactNode }) {
  return <PageEmbedContext.Provider value={true}>{children}</PageEmbedContext.Provider>
}

// `icon` gives the page the record header: a white card with the icon (as on a supplier's
// page), for screens opened from a record list (e.g. a list's renewals or templates).
interface PageProps {
  navigation?: ReactNode
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  fill?: boolean
  className?: string
  icon?: ReactNode
}

export function Page({navigation,title,subtitle,actions,children,fill=false,className='',icon=null}: PageProps) {
  // Inside a merged section the page carries the section's name and tabs; pages nested in it do not repeat them.
  const section=useSectionTabs()
  const embedded=useContext(PageEmbedContext)
  if(embedded)return (
    <div className={`page-embedded ${className}`.trim()}>
      {actions&&<div className="page-embedded-actions">{actions}</div>}
      {children}
    </div>
  )
  return (
    <section className={`page ${fill?'page-fill':''} ${className}`.trim()}>
      {icon&&!section?<header className="entity-record-header surface page-record-header">
        {navigation}
        <div className="entity-record-avatar">{icon}</div>
        <div className="entity-record-identity">
          <h1>{title}</h1>
          {subtitle&&<p>{subtitle}</p>}
        </div>
        {actions&&<div className="entity-record-header-actions">{actions}</div>}
      </header>:<header className="page-header">
        <div className="page-heading-group">
          {navigation&&<div className="page-navigation">{navigation}</div>}
          <div className="page-heading-copy">
            <h1>{section?.title||title}</h1>
            {subtitle&&<p>{subtitle}</p>}
          </div>
        </div>
        {actions&&<div className="page-actions">{actions}</div>}
      </header>}
      {section?<><SectionTabStrip section={section}/><SectionTabsProvider value={null}>{children}</SectionTabsProvider></>:children}
    </section>
  )
}
