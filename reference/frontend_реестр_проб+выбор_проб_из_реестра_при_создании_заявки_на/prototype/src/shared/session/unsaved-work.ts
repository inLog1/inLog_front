import { useEffect } from 'react'

const sources = new Set<string>()

export function setUnsavedSource(id: string, dirty: boolean) {
  if (dirty) sources.add(id)
  else sources.delete(id)
}

export function hasUnsavedWork(): boolean {
  return sources.size > 0
}

export function useUnsavedSource(id: string, dirty: boolean) {
  useEffect(() => {
    setUnsavedSource(id, dirty)
    return () => setUnsavedSource(id, false)
  }, [dirty, id])
}
