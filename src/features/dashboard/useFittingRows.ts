import { useLayoutEffect, useRef, useState } from 'react'

// How many lines of a fixed height fit in a list's box (the box shares its card's height).
export function useFittingRows(rowHeight: number, fallback = 8) {
  const ref = useRef<HTMLDivElement>(null)
  const [rows, setRows] = useState(fallback)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return undefined
    const measure = () => { if (element.clientHeight > 0) setRows(Math.max(1, Math.floor(element.clientHeight / rowHeight))) }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    measure()
    return () => observer.disconnect()
  }, [rowHeight])
  return [ref, rows] as const
}
