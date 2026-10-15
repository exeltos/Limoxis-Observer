import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import './SearchableSelect.css'
import './MultiSelect.css'

const normalize = value =>
  String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

// A dropdown that keeps several values. The closed field is as tall as any other
// control and says what is chosen; the open list has a search box and
// "select all / clear all" for the options the search shows. Rows toggle on click
// and carry a tick, not a checkbox. The list scrolls inside itself.
// options: [{ value, label }]
export function MultiSelect({
  label,
  options = [],
  selected = [],
  onChange,
  placeholder = '',
  searchPlaceholder = '',
  emptyLabel = '',
  selectAllLabel = '',
  clearAllLabel = '',
  countLabel = count => String(count),
  disabled = false,
  className = '',
}) {
  const baseId = useId().replace(/:/g, '')
  const buttonId = `${baseId}-button`,
    listId = `${baseId}-list`
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(''),
    [place, setPlace] = useState(null)
  const rootRef = useRef(null),
    buttonRef = useRef(null)
  const chosen = useMemo(() => new Set(selected.map(String)), [selected])
  const matches = useMemo(() => {
    const needle = normalize(query)
    return needle ? options.filter(option => normalize(option.label).includes(needle)) : options
  }, [options, query])
  const chosenLabels = options
    .filter(option => chosen.has(String(option.value)))
    .map(option => option.label)
  const summary = chosenLabels.length
    ? chosenLabels.length <= 2
      ? chosenLabels.join(', ')
      : countLabel(chosenLabels.length)
    : placeholder

  // The list floats over the page (fixed), so a scrolling table or dialog never
  // clips it. It is at least 300px wide, opens upwards when there is no room
  // below, lines up with the field's right side near the screen edge, and
  // follows the field when something scrolls.
  function measure() {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = Math.max(rect.width, 300)
    const below = window.innerHeight - rect.bottom
    const upward = below < 330 && rect.top > below
    const alignEnd = rect.left + width > window.innerWidth - 16
    setPlace({
      width,
      maxHeight: Math.min(320, (upward ? rect.top : below) - 12),
      ...(upward
        ? { top: 'auto', bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4, bottom: 'auto' }),
      ...(alignEnd
        ? { left: 'auto', right: window.innerWidth - rect.right }
        : { left: rect.left, right: 'auto' }),
    })
  }

  useEffect(() => {
    if (!open) return undefined
    const onPointer = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onMove = event => {
      if (!rootRef.current?.contains(event.target)) measure()
    }
    document.addEventListener('mousedown', onPointer)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open])

  function toggle(value) {
    const key = String(value)
    onChange?.(
      chosen.has(key) ? selected.filter(item => String(item) !== key) : [...selected, value],
    )
  }
  function selectShown() {
    const next = [...selected]
    for (const option of matches) if (!chosen.has(String(option.value))) next.push(option.value)
    onChange?.(next)
  }
  function clearShown() {
    const shown = new Set(matches.map(option => String(option.value)))
    onChange?.(selected.filter(item => !shown.has(String(item))))
  }

  return (
    <div
      ref={rootRef}
      className={`searchable-select multi-select ${className}`.trim()}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) {
          event.preventDefault()
          event.stopPropagation()
          setOpen(false)
        }
      }}
    >
      <label htmlFor={buttonId}>
        <span className="lo-field-label">{label}</span>
      </label>
      <div className="searchable-select-control">
        <button
          id={buttonId}
          ref={buttonRef}
          type="button"
          className={`multi-select-button${chosenLabels.length ? '' : ' is-placeholder'}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          title={chosenLabels.join(', ')}
          disabled={disabled}
          onClick={() => {
            if (!open) measure()
            setOpen(value => !value)
          }}
        >
          <span>{summary}</span>
        </button>
        <ChevronDown className="searchable-select-chevron" size={15} aria-hidden="true" />
      </div>
      {open && (
        <div
          className="searchable-select-list multi-select-panel"
          style={{ position: 'fixed', zIndex: 1200, margin: 0, ...place }}
        >
          <div className="multi-select-search">
            <Search size={14} aria-hidden="true" />
            <input
              type="text"
              autoFocus
              value={query}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder || label}
              onChange={event => setQuery(event.target.value)}
            />
          </div>
          {(selectAllLabel || clearAllLabel) && (
            <div className="multi-select-bulk">
              {selectAllLabel && (
                <button type="button" disabled={!matches.length} onClick={selectShown}>
                  {selectAllLabel}
                </button>
              )}
              {clearAllLabel && (
                <button type="button" disabled={!matches.length} onClick={clearShown}>
                  {clearAllLabel}
                </button>
              )}
            </div>
          )}
          <ul id={listId} role="listbox" aria-multiselectable="true" aria-label={label}>
            {matches.map(option => {
              const on = chosen.has(String(option.value))
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={on}
                  tabIndex={0}
                  className="searchable-select-option multi-select-option"
                  onClick={() => toggle(option.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      toggle(option.value)
                    }
                  }}
                >
                  <span className="searchable-select-option-label">{option.label}</span>
                  {on && <Check size={15} aria-hidden="true" />}
                </li>
              )
            })}
            {!matches.length && emptyLabel && (
              <li className="searchable-select-empty" role="presentation">
                {emptyLabel}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
