import { createContext, useContext } from 'react'

export type HeadingValue = {
  label: string | null
  setLabel: (label: string | null) => void
}

export const PageHeadingContext = createContext<HeadingValue | null>(null)

export function usePageHeading(): string | null {
  return useContext(PageHeadingContext)?.label ?? null
}
