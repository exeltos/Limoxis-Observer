import { SearchableSelect, type SearchableSelectProps } from './SearchableSelect'

// A field with a choice of values (priority, status, type…): one house select,
// never a row of buttons. A yes / no flag is a CheckboxField instead.
type ChoiceFieldProps<V extends string | number> = Omit<SearchableSelectProps<V>, 'options' | 'onChange'> & {
  options?: Array<{ value: V; label: string }>
  onChange?: (value: V | string) => void
}

export function ChoiceField<V extends string | number = string>({
  label,
  value,
  options = [],
  onChange,
  disabled = false,
  className = '',
  placeholder = '',
  ...fieldProps
}: ChoiceFieldProps<V>) {
  return (
    <SearchableSelect
      {...fieldProps}
      className={className}
      label={label}
      value={value ?? ''}
      disabled={disabled}
      placeholder={placeholder}
      options={options.map(option => ({ value: option.value, label: option.label }))}
      onChange={next => next != null && onChange?.(next)}
    />
  )
}
