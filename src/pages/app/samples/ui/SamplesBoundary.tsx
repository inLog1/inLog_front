import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { samplesMode } from '../../../../entities/sample'
import { useRequestOrganizations } from '../../../../features/org-project-selector/model/useRequestOrganizations'
import { PageState, WorkPage } from '../../../../shared/ui/page'

const mode = samplesMode(import.meta.env.VITE_API_MODE)

export function SamplesBoundary({ children }: { children: ReactNode }) {
  if (mode === 'unavailable') return <SamplesUnavailable />
  return <SampleOrganizationGate>{children}</SampleOrganizationGate>
}

function SampleOrganizationGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const choice = useRequestOrganizations()
  if (choice.hold) {
    return (
      <WorkPage>
        <PageState kind="loading" description={t('samples.loading')} />
      </WorkPage>
    )
  }
  return children
}

function SamplesUnavailable() {
  const { t } = useTranslation()
  return (
    <WorkPage width="form">
      <div role="status">
        <h1 className="text-lg font-semibold text-foreground">{t('samples.unavailable-title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('samples.unavailable-body')}</p>
      </div>
    </WorkPage>
  )
}
