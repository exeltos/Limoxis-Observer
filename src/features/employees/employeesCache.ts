// The employee list, shared by the screens that use it (pickers, registers,
// the record): about fifteen of them used to read the whole table each time
// they opened. One read per organization serves them for EMPLOYEES_CACHE_MS;
// every save of an employee (employeeService, the photo) clears it, and a
// screen's explicit reload() always reads again.
export const EMPLOYEES_CACHE_MS = 5 * 60 * 1000
const cache = new Map<string, { promise: Promise<unknown>, expires: number }>()

export function cachedEmployees<T>(organizationId: string | null | undefined, load: () => T | PromiseLike<T>, { fresh = false, now = Date.now() } = {}): Promise<T> {
  const key = organizationId || ''
  const hit = cache.get(key)
  if (!fresh && hit && hit.expires > now) return hit.promise as Promise<T>
  const promise = Promise.resolve().then(load)
  cache.set(key, { promise, expires: now + EMPLOYEES_CACHE_MS })
  promise.catch(() => { if (cache.get(key)?.promise === promise) cache.delete(key) })
  return promise
}

export function invalidateEmployeesCache(organizationId?: string | null) {
  if (organizationId === undefined) cache.clear()
  else cache.delete(organizationId || '')
}
