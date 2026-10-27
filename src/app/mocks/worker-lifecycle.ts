const MOCK_WORKER = 'mockServiceWorker.js'

export async function stopOwnMockWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map(async (registration) => {
    const script = registration.active?.scriptURL
      ?? registration.waiting?.scriptURL
      ?? registration.installing?.scriptURL
      ?? ''
    if (script.includes(MOCK_WORKER)) await registration.unregister()
  }))
}
