import { Suspense, lazy } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../../shared/lib/utils'
import { useWhiteboardStorage } from '../model/use-whiteboard-storage'
import type { WhiteboardProps } from '../model/types'

const WhiteboardCanvas = lazy(() =>
  import('./WhiteboardCanvas').then((module) => ({
    default: module.WhiteboardCanvas,
  })),
)

export const Whiteboard = ({ storageKey, height = 500, className }: WhiteboardProps) => {
  const { t } = useTranslation()
  const { initialData, setApi, scheduleSave, contextKey } = useWhiteboardStorage(storageKey)

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs text-muted-foreground">
        {t('whiteboard.auto-save-hint')}
      </p>

      <Suspense
        fallback={
          <div
            className="flex items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground"
            style={{ height: typeof height === 'number' ? `${height}px` : height }}
          >
            {t('whiteboard.loading')}
          </div>
        }
      >
        <WhiteboardCanvas
          key={contextKey}
          initialData={initialData}
          onApiReady={setApi}
          onChange={scheduleSave}
          height={height}
        />
      </Suspense>
    </div>
  )
}
