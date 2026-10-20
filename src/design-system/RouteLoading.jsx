import { PageSkeleton } from './LoadingSkeleton'

// A screen that is still loading (its page file, the role that opens it, or its
// first data): the page-shaped placeholder, at once and inside the content area.
// It used to render nothing for 150 ms and then a spinner, so every move between
// screens blinked blank → spinner → page.
export function RouteLoading(){
  return <PageSkeleton className="route-loading"/>
}
