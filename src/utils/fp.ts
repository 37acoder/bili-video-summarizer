/** Pick a random element. Ported from BibiGPT-v1 `utils/fp.ts`. */
export function sample<T>(arr: readonly T[] | null | undefined = []): T | undefined {
  const list = arr ?? []
  return list.length ? list[Math.floor(Math.random() * list.length)] : undefined
}

/** Find the first item whose `key` equals the given value. */
export function find<T>(list: readonly T[] = [], args: Partial<T>): T | undefined {
  const keys = Object.keys(args)
  if (keys.length === 0) {
    return undefined
  }
  const key = keys[0] as keyof T
  return list.find((item) => item[key] === args[key])
}

/** Normalize a `string | string[]` config value into an array. */
export function toStringArray(value: string | string[] | undefined | null): string[] {
  if (value === undefined || value === null) {
    return []
  }
  if (Array.isArray(value)) {
    return value
  }
  return value.split(',').filter(Boolean)
}
