import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { formsMode } from '../../../../entities/form'

const mode = formsMode(import.meta.env.VITE_API_MODE)

export function FormsBoundary({ children }: { children: ReactNode }) {
  if (mode === 'unavailable') return <FormsUnavailable />
  return children
}

function FormsUnavailable() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-xl p-6" role="status">
      <h2 className="text-lg font-semibold">{t('forms.unavailable-title')}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t('forms.unavailable-body')}</p>
    </div>
  )
}
