import type { ReactNode } from 'react'

/** Compact row for filter, sort and list actions. The caller owns the controls. */
export function ListToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
  )
}
