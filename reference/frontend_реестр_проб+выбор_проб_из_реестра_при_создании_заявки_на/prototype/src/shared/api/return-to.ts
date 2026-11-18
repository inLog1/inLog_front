export function sanitizeReturnTo(input: string | null | undefined): string | null {
  if (!input) return null
  const value = input.trim()
  if (!value.startsWith('/')) return null
  if (value.startsWith('//') || value.startsWith('/\\')) return null
  if (value.includes('://') || value.includes('\\')) return null
  if (value.includes('\n') || value.includes('\r') || value.includes('\0')) return null

  const path = value.split('?')[0]?.split('#')[0] ?? value
  if (
    path === '/login'
    || path.startsWith('/login/')
    || path === '/register'
    || path.startsWith('/register/')
    || path.startsWith('/auth/')
    || path.startsWith('/recovery')
  ) {
    return null
  }
  return value
}
