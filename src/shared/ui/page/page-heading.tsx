import { useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { PageHeadingContext } from './page-heading-context'

export function PageHeadingProvider({ children }: { children: ReactNode }) {
  const [label, setLabel] = useState<string | null>(null)
  const value = useMemo(() => ({ label, setLabel }), [label])
  return <PageHeadingContext.Provider value={value}>{children}</PageHeadingContext.Provider>
}

/** Puts the loaded page name into the shell breadcrumb without a second data request. */
export function PageHeading({ children }: { children: string }) {
  const setLabel = useContext(PageHeadingContext)?.setLabel
  useEffect(() => {
    setLabel?.(children)
    return () => setLabel?.(null)
  }, [children, setLabel])
  return null
}
