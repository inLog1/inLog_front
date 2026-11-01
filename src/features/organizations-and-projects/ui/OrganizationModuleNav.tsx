import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { routes } from '../../../shared/lib/routes'
import { cn } from '../../../shared/lib/utils'

export function OrganizationModuleNav({ organizationId }: { organizationId: number }) {
  const { t } = useTranslation()
  const location = useLocation()
  const items = [
    {
      id: 'personnel',
      label: t('nav.personnel'),
      path: routes.settings.organizationPersonnel(organizationId),
    },
    {
      id: 'reference',
      label: t('nav.reference'),
      path: routes.settings.organizationReference(organizationId),
    },
  ]
  return (
    <nav aria-label={t('nav.organizations')} className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = location.pathname === item.path
        const search = new URLSearchParams({
          org: String(organizationId),
          directoryOrg: String(organizationId),
        })
        return (
          <Link
            key={item.id}
            to={`${item.path}?${search.toString()}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm',
              active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
