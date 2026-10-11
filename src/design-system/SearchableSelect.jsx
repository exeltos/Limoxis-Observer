import { useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import './SearchableSelect.css'

const normalize = value =>
  String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

// A select the user can type into: the options narrow to those whose label,
// description or keywords contain the text (accents and case ignored). Follows the
// WAI-ARIA combobox pattern: Arrow keys move through the list, Enter picks,
// Escape closes and restores the current choice.
// options: [{ value, label, description?, keywords? }]
export function SearchableSelect({
  label,
  value,
  options = [],
  onChange,
  placeholder = '',
  emptyLabel = '',
  clearLabel = '',
  className = '',
}) {
  const baseId = useId().replace(/:/g, '')
  const inputId = `${baseId}-input`,
    listId = `${baseId}-list`
  const selected = options.find(option => String(option.value) === String(value)) || null
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(null),
    [activeIndex, setActiveIndex] = useState(-1)
  const listRef = useRef(null)
  const text = query ?? selected?.label ?? ''
  const matches = useMemo(() => {
    const needle = normalize(query)
    if (!needle) return options
    return options.filter(option =>
      normalize(
        `${option.label} ${option.description || ''} ${option.keywords || ''} ${option.value}`,
      ).includes(needle),
    )
  }, [options, query])
  const optionId = index => `${baseId}-option-${index}`

  function close() {
    setOpen(false)
    setQuery(null)
    setActiveIndex(-1)
  }
  function choose(option) {
    onChange?.(option.value)
    close()
  }
  function move(step) {
    if (!matches.length) return
    const next = open ? (activeIndex + step + matches.length) % matches.length : 0
    setOpen(true)
    setActiveIndex(next)
    listRef.current?.querySelector(`#${optionId(next)}`)?.scrollIntoView?.({ block: 'nearest' })
  }
  function onKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      move(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      move(-1)
    } else if (event.key === 'Enter') {
      if (open && matches[activeIndex]) {
        event.preventDefault()
        choose(matches[activeIndex])
      }
    } else if (event.key === 'Escape') {
      if (open || query !== null) {
        event.preventDefault()
        event.stopPropagation()
        close()
      }
    }
  }

  return (
    <div className={`searchable-select ${className}`.trim()}>
      <label htmlFor={inputId}>
        <span>{label}</span>
      </label>
      <div className="searchable-select-control">
        <input
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          value={text}
          placeholder={placeholder}
          onChange={event => {
            setQuery(event.target.value)
            setOpen(true)
            setActiveIndex(event.target.value ? 0 : -1)
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={close}
          onKeyDown={onKeyDown}
        />
        {selected && clearLabel ? (
          <button
            type="button"
            className="searchable-select-clear"
            aria-label={clearLabel}
            title={clearLabel}
            onMouseDown={event => event.preventDefault()}
            onClick={() => {
              onChange?.('')
              close()
            }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        ) : (
          <ChevronDown className="searchable-select-chevron" size={15} aria-hidden="true" />
        )}
      </div>
      <ul
        id={listId}
        ref={listRef}
        role="listbox"
        aria-label={label}
        className="searchable-select-list"
        hidden={!open}
      >
        {matches.map((option, index) => (
          <li
            key={option.value}
            id={optionId(index)}
            role="option"
            aria-selected={String(option.value) === String(value)}
            className={`searchable-select-option${index === activeIndex ? ' active' : ''}`}
            onMouseDown={event => event.preventDefault()}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => choose(option)}
          >
            <span className="searchable-select-option-label">{option.label}</span>
            {option.description && (
              <small className="searchable-select-option-description">{option.description}</small>
            )}
          </li>
        ))}
        {!matches.length && emptyLabel && (
          <li className="searchable-select-empty" role="presentation">
            {emptyLabel}
          </li>
        )}
      </ul>
    </div>
  )
}
