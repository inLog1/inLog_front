const encoder = new TextEncoder()

/**
 * Salted SHA-256 from Web Crypto.
 * This is a verification value for the mock, not a password and not a production store.
 */
export async function digestPassword(password: string, salt: string): Promise<string> {
  const bytes = encoder.encode(`${salt}\0${password}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return hex(new Uint8Array(digest))
}

export function createSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return hex(bytes)
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('')
}
