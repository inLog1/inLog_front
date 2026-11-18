import type { ReactNode } from 'react'

/** Save row in the page flow, same width as the other cards. */
export function EditorActions({ children, notice }: { children: ReactNode; notice?: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      {notice ? <div className="mb-2 text-sm">{notice}</div> : null}
      <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  )
}
