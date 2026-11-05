import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { requestsMode } from '../../../../entities/request'
import { WorkPage } from '../../../../shared/ui/page'

const mode = requestsMode(import.meta.env.VITE_API_MODE)

export function RequestsBoundary({ children }: { children: ReactNode }) {
  if (mode === 'unavailable') return <RequestsUnavailable />
  return children
}

function RequestsUnavailable() {
  const { t } = useTranslation()
  return (
    <WorkPage width="form">
      <div role="status">
        <h1 className="text-lg font-semibold text-foreground">{t('requests.unavailable-title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('requests.unavailable-body')}</p>
      </div>
    </WorkPage>
  )
}
