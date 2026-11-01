import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('mock service worker keepalive', () => {
  it('registers the open page again after the worker process restarts', () => {
    const source = readFileSync('public/mockServiceWorker.js', 'utf8')
    const start = source.indexOf("case 'KEEPALIVE_REQUEST'")
    const end = source.indexOf("case 'INTEGRITY_CHECK_REQUEST'")
    const keepalive = source.slice(start, end)
    expect(keepalive).toContain('activeClientIds.add(clientId)')
  })
})
