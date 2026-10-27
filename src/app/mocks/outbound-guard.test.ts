import { describe, expect, it } from 'vitest'
import { classifyMockTraffic, guardOutboundRequest } from './outbound-guard'

const live = 'http://localhost:8000/'
const appOrigin = 'http://127.0.0.1:5173'

describe('mock outbound guard', () => {
  it('blocks the known live origin and an arbitrary absolute API url without calling fetch', async () => {
    const calls: string[] = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = ((input: RequestInfo | URL) => {
      calls.push(String(input))
      return Promise.reject(new Error('network must not be called'))
    }) as typeof fetch

    const liveResponse = guardOutboundRequest(new Request('http://localhost:8000/users/me/'), {
      liveApiBase: live,
      appOrigin,
    })
    const randomResponse = guardOutboundRequest(new Request('https://api.example.test/projects/project/'), {
      liveApiBase: live,
      appOrigin,
    })
    expect(liveResponse?.status).toBe(501)
    expect(randomResponse?.status).toBe(501)
    expect(await liveResponse?.json()).toMatchObject({ code: 'mock_upstream_blocked' })
    expect(await randomResponse?.json()).toMatchObject({ code: 'mock_upstream_blocked' })
    expect(calls).toEqual([])
    globalThis.fetch = originalFetch
  })

  it('keeps same-origin modules, asset destinations, and HMR sockets', () => {
    expect(classifyMockTraffic({
      url: new URL('http://127.0.0.1:5173/src/main.tsx'),
      destination: 'script',
      liveApiBase: live,
      appOrigin,
    })).toBe('passthrough')
    expect(classifyMockTraffic({
      url: new URL('http://127.0.0.1:5173/@vite/client'),
      destination: '',
      liveApiBase: live,
      appOrigin,
    })).toBe('passthrough')
    expect(classifyMockTraffic({
      url: new URL('https://fonts.example.test/css?family=Inter'),
      destination: 'style',
      liveApiBase: live,
      appOrigin,
    })).toBe('passthrough')
    expect(classifyMockTraffic({
      url: new URL('ws://127.0.0.1:5173/'),
      destination: '',
      liveApiBase: live,
      appOrigin,
    })).toBe('passthrough')
    expect(guardOutboundRequest(new Request('http://127.0.0.1:5173/src/main.tsx'), {
      liveApiBase: live,
      appOrigin,
    })).toBeNull()
  })
})
