import { describe, expect, it } from 'vitest'
import { releaseQuerySubscriptions } from './query-subscriptions'

describe('query subscriptions', () => {
  it('unsubscribes each initiate result once', () => {
    const calls: string[] = []
    const subscriptions = [
      { unsubscribe: () => calls.push('installation') },
      { unsubscribe: () => calls.push('profile') },
    ]
    releaseQuerySubscriptions(subscriptions)
    releaseQuerySubscriptions(subscriptions)
    expect(calls).toEqual(['installation', 'profile'])
    expect(subscriptions).toHaveLength(0)
  })
})
