import { describe, expect, it } from 'vitest'
import { saveViewOnce, type SingleSlot } from './save-once'

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  let reject: (error: unknown) => void = () => undefined
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('view create from the leave dialog', () => {
  it('creates one document, then the caller can navigate, and a second click does not create another', async () => {
    const slot: SingleSlot<string | null> = { pending: null }
    const known = { id: null as string | null }
    const created: string[] = []
    const updated: string[] = []
    const gate = deferred<string>()
    const write = (id: string | null) => {
      if (id == null) {
        created.push('new')
        return gate.promise
      }
      updated.push(id)
      return Promise.resolve(id)
    }
    const first = saveViewOnce(slot, known, write)
    const second = saveViewOnce(slot, known, write)
    expect(created).toEqual(['new'])
    gate.resolve('view-1')
    await expect(first).resolves.toBe('view-1')
    await expect(second).resolves.toBe('view-1')
    expect(known.id).toBe('view-1')
    await expect(saveViewOnce(slot, known, write)).resolves.toBe('view-1')
    expect(created).toEqual(['new'])
    expect(updated).toEqual(['view-1'])
  })

  it('keeps the empty id and the form when the create fails', async () => {
    const slot: SingleSlot<string | null> = { pending: null }
    const known = { id: null as string | null }
    const values = { title: 'Реестр образцов' }
    let attempts = 0
    const write = async (id: string | null) => {
      expect(id).toBeNull()
      attempts += 1
      if (attempts === 1) return null
      return 'view-2'
    }
    await expect(saveViewOnce(slot, known, write)).resolves.toBeNull()
    expect(known.id).toBeNull()
    expect(values.title).toBe('Реестр образцов')
    await expect(saveViewOnce(slot, known, write)).resolves.toBe('view-2')
    expect(attempts).toBe(2)
    expect(known.id).toBe('view-2')
  })
})
