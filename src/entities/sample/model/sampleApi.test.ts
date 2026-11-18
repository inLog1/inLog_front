import { configureStore } from '@reduxjs/toolkit'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { sampleApi } from './sampleApi'
import { samplesMode } from './availability'

const server = setupServer(
  http.get(/\/samples\/(?:\?|$)/, ({ request }) => {
    const organization = new URL(request.url).searchParams.get('organization')
    if (organization === '102') return HttpResponse.json({ code: 'forbidden' }, { status: 403 })
    listCalls += 1
    return HttpResponse.json({ samples: listed, organizationKind: 'laboratory' })
  }),
  http.post(/\/samples\/$/, async ({ request }) => {
    const body = await request.json() as { field?: string }
    listed = [{ id: 'created', code: 'PRB-2026-000009', field: body.field ?? '' }]
    return HttpResponse.json({ sample: listed[0] }, { status: 201 })
  }),
  http.get(/\/samples\/created\/(?:\?|$)/, () => {
    cardCalls += 1
    return HttpResponse.json({ sample: listed[0] })
  }),
  http.patch(/\/samples\/created\/status\/$/, () => {
    listed = [{ ...listed[0], field: 'После статуса' }]
    return HttpResponse.json({ sample: listed[0] })
  }),
)

let listCalls = 0
let cardCalls = 0
let listed: Array<{ id: string; code: string; field?: string }> = []

function createStore() {
  return configureStore({
    reducer: { [sampleApi.reducerPath]: sampleApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(sampleApi.middleware),
  })
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  listCalls = 0
  cardCalls = 0
  listed = []
})
afterAll(() => server.close())

describe('sample RTK query', () => {
  it('marks live mode unavailable and mock mode ready', () => {
    expect(samplesMode('mock')).toBe('mock')
    expect(samplesMode('live')).toBe('unavailable')
    expect(samplesMode(undefined)).toBe('unavailable')
  })

  it('loads, reports an error, and refreshes the list and card after a mutation', async () => {
    const store = createStore()
    const list = store.dispatch(sampleApi.endpoints.getSamples.initiate({ organizationId: 101 }))
    expect(sampleApi.endpoints.getSamples.select({ organizationId: 101 })(store.getState()).isLoading).toBe(true)
    await list
    expect(listCalls).toBe(1)
    expect(sampleApi.endpoints.getSamples.select({ organizationId: 101 })(store.getState()).data?.samples).toEqual([])

    const denied = store.dispatch(sampleApi.endpoints.getSamples.initiate({ organizationId: 102 }))
    await denied
    const failed = sampleApi.endpoints.getSamples.select({ organizationId: 102 })(store.getState())
    expect(failed.isError).toBe(true)
    expect(failed.isLoading).toBe(false)
    expect(failed.data).toBeUndefined()

    await store.dispatch(sampleApi.endpoints.createSample.initiate({
      organizationId: 101,
      sampleType: 'Керн',
      field: 'Северное',
      well: '1',
      receivedAt: '2026-11-17',
      location: 'Склад',
    })).unwrap()
    await vi.waitFor(() => expect(listCalls).toBe(2))
    expect(sampleApi.endpoints.getSamples.select({ organizationId: 101 })(store.getState()).data?.samples).toEqual([
      expect.objectContaining({ id: 'created', code: 'PRB-2026-000009' }),
    ])

    const card = store.dispatch(sampleApi.endpoints.getSample.initiate({ organizationId: 101, sampleId: 'created' }))
    await card
    expect(cardCalls).toBe(1)
    await store.dispatch(sampleApi.endpoints.updateSampleStatus.initiate({
      organizationId: 101,
      sampleId: 'created',
      stage: 'На хранении',
    })).unwrap()
    await vi.waitFor(() => expect(cardCalls).toBe(2))
    expect(sampleApi.endpoints.getSample.select({ organizationId: 101, sampleId: 'created' })(store.getState()).data?.sample.field).toBe('После статуса')
    list.unsubscribe()
    card.unsubscribe()
  })
})
