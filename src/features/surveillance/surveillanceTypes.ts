// Shared types of the Surveillance screens (TypeScript migration).
import type { Dispatch, SetStateAction } from 'react'

// A callback prop of a screen (onSave, onClose, run, …): each one passes its own arguments.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- callbacks of the screens take different arguments
export type Handler = (...args: any[]) => any

// A date as the records keep it: an ISO text, a timestamp or a Date (empty when not set).
export type DateValue = string | number | Date | null | undefined

// A state setter of a known state, handed to a part of a split screen.
export type Setter<T> = Dispatch<SetStateAction<T>>
