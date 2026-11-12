// Κοινοί τύποι για τις ενότητες (src/features) στη μετάβαση σε TypeScript.

// Εγγραφή που δεν έχει ακόμα δικό της τύπο: γραμμή πίνακα, εγγραφή Demo ή
// φόρμα με πολλά πεδία. Νέος κώδικας προτιμά τον τύπο της βάσης
// (Tables<'…'> από το core/supabase/database.types) ή δικό του interface.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- εγγραφές διαφόρων πινάκων και φορμών
export type AnyRecord = Record<string, any>

// Το συνηθισμένο `tx('ελληνικά', 'English')` των οθονών.
export type Translate = (el: string, en: string) => string
