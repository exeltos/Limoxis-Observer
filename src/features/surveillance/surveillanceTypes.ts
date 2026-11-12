// Shared types of the Surveillance screens (TypeScript migration).
import type { Dispatch, SetStateAction } from 'react'

// A callback prop of a screen (onSave, onClose, run, …): each one passes its own arguments.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- callbacks of the screens take different arguments
export type Handler = (...args: any[]) => any

// A state setter handed to a part of a split screen (ClinicalJourney.tsx and its parts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the parts receive setters of different states
export type StateSetter = Dispatch<SetStateAction<any>>
