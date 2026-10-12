import type { ReactNode } from 'react'
import { useMediaQuery } from '../lib/hooks/use-media-query'
import { cn } from '../lib/utils'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './resizable'

type MobilePane = 'stack' | 'aside' | 'main'

interface ResponsiveSplitProps {
  aside: ReactNode
  main: ReactNode
  /** stack shows both panes; aside/main shows one full-height pane. */
  mobile?: MobilePane
  className?: string
  asideClassName?: string
  mainClassName?: string
  asideDefaultSize?: number | string
  asideMinSize?: number | string
  asideMaxSize?: number | string
  mainDefaultSize?: number | string
  mainMinSize?: number | string
}

const DESKTOP_QUERY = '(min-width: 1024px)'

export function ResponsiveSplit({
  aside,
  main,
  mobile = 'stack',
  className,
  asideClassName,
  mainClassName,
  asideDefaultSize = '32%',
  asideMinSize,
  asideMaxSize,
  mainDefaultSize = '68%',
  mainMinSize,
}: ResponsiveSplitProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)

  if (!isDesktop) {
    return (
      <div className={cn('flex h-full min-h-0 w-full flex-col', className)}>
        <div
          className={cn(
            'min-h-0 min-w-0',
            mobile === 'main' && 'hidden',
            mobile === 'stack' && 'max-h-[45%] shrink-0 overflow-y-auto',
            mobile === 'aside' && 'min-h-0 flex-1 overflow-y-auto',
            asideClassName,
          )}
        >
          {aside}
        </div>
        <div
          className={cn(
            'min-h-0 min-w-0',
            mobile === 'aside' && 'hidden',
            mobile === 'stack' && 'min-h-0 flex-1 overflow-y-auto border-t border-border',
            mobile === 'main' && 'min-h-0 flex-1 overflow-y-auto',
            mainClassName,
          )}
        >
          {main}
        </div>
      </div>
    )
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className={cn('h-full min-h-0', className)}>
      <ResizablePanel defaultSize={asideDefaultSize} minSize={asideMinSize} maxSize={asideMaxSize}>
        <div className={cn('h-full min-h-0 min-w-0', asideClassName)}>{aside}</div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={mainDefaultSize} minSize={mainMinSize} className="min-w-0">
        <div className={cn('h-full min-h-0 min-w-0', mainClassName)}>{main}</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
