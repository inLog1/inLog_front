export type SingleSlot<T> = { pending: Promise<T> | null }

/** A second caller waits for the save already running. It does not start another. */
export function startSingleSave<T>(slot: SingleSlot<T>, run: () => Promise<T>): Promise<T> {
  if (slot.pending) return slot.pending
  const pending = run().then(
    (value) => {
      if (slot.pending === pending) slot.pending = null
      return value
    },
    (error: unknown) => {
      if (slot.pending === pending) slot.pending = null
      throw error
    },
  )
  slot.pending = pending
  return pending
}
