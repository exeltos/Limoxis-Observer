// Γενικές βελτιώσεις τύπων για όλο το src (μόνο τύποι, κανένας κώδικας).

// `list.filter(Boolean)` αφήνει έξω τα null/undefined/false/''/0 και ο τύπος
// του αποτελέσματος το ξέρει (όπως το ts-reset).
interface Array<T> {
  filter(predicate: BooleanConstructor, thisArg?: unknown): Exclude<T, false | 0 | '' | null | undefined | 0n>[]
}
interface ReadonlyArray<T> {
  filter(predicate: BooleanConstructor, thisArg?: unknown): Exclude<T, false | 0 | '' | null | undefined | 0n>[]
}
