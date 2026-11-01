import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../../shared/ui/page'

/**
 * Reference catalogs as their own section.
 * Hosts place it inside their navigation. This view does not render tabs or breadcrumbs.
 */
export function ReferenceSection({ scopeLabel }: { scopeLabel?: string }) {
  const { t } = useTranslation()
  return (
    <section className="space-y-4">
      <PageHeader title={t('nav.reference')} description={scopeLabel} />
      <p className="text-sm text-muted-foreground">{t('settings-page.modules-later')}</p>
    </section>
  )
}
