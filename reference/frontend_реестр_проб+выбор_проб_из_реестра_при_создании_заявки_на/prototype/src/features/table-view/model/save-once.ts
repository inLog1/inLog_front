import { startSingleSave, type SingleSlot } from '../../../shared/lib/single-save'

export type { SingleSlot }

/**
 * Creates a view once. A repeat click joins that save.
 * After a success, the next save updates the same id.
 * A failure leaves the known id empty and the caller keeps the form values.
 */
export function saveViewOnce(
  slot: SingleSlot<string | null>,
  known: { id: string | null },
  write: (id: string | null) => Promise<string | null>,
): Promise<string | null> {
  return startSingleSave(slot, async () => {
    const id = await write(known.id)
    if (id) known.id = id
    return id
  })
}
