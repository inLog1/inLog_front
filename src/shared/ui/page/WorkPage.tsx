import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

/** Full-width work surface. Forms stay narrower; lists and matrices use the area. */
export function WorkPage({ children, width = 'full' }: { children: ReactNode; width?: 'full' | 'form' }) {
  return (
    <div className={cn(
      'flex w-full min-w-0 flex-col gap-4 py-4 md:py-6',
      width === 'form' && 'mx-auto max-w-[760px]',
    )}>
      {children}
    </div>
  )
}
