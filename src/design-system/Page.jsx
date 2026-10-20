import { createContext, useContext } from 'react'
import { SectionTabStrip, SectionTabsProvider, useSectionTabs } from './SectionTabs'

// A screen shown as a tab of another page (e.g. the indicators list in the
// Management Center) keeps its actions and content but not its own heading.
const PageEmbedContext = createContext(false)
export function PageEmbedProvider({ children }) {
  return <PageEmbedContext.Provider value={true}>{children}</PageEmbedContext.Provider>
}

export function Page({navigation,title,subtitle,actions,children,fill=false,className=''}) {
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
      <header className="page-header">
        <div className="page-heading-group">
          {navigation&&<div className="page-navigation">{navigation}</div>}
          <div className="page-heading-copy">
            <h1>{section?.title||title}</h1>
            {subtitle&&<p>{subtitle}</p>}
          </div>
        </div>
        {actions&&<div className="page-actions">{actions}</div>}
      </header>
      {section?<><SectionTabStrip section={section}/><SectionTabsProvider value={null}>{children}</SectionTabsProvider></>:children}
    </section>
  )
}
