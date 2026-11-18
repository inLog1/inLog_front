import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { sectionsMode } from '../../../../entities/section'

const mode = sectionsMode(import.meta.env.VITE_API_MODE)

export function SectionsBoundary({ children }: { children: ReactNode }) {
  if (mode === 'unavailable') return <SectionsUnavailable />
  return children
}

function SectionsUnavailable() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-xl p-6" role="status">
      <h2 className="text-lg font-semibold">{t('sections.unavailable-title')}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t('sections.unavailable-body')}</p>
    </div>
  )
}
