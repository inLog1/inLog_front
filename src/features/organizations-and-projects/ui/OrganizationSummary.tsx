import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Briefcase, FlaskConical } from 'lucide-react'
import { organizationHeading } from '../../../entities/organization/model/requisites'
import type { CorporateOverviewOrganization } from '../../../entities/personnel/model/overview'
import { cn } from '../../../shared/lib/utils'
import { organizationKindLabelKey } from '../model/kind-label'

export function OrganizationSummary({
  organization,
  menu,
}: {
  organization: CorporateOverviewOrganization
  menu?: ReactNode
}) {
  const { t } = useTranslation()
  const laboratory = organization.kind === 'laboratory'
  const KindIcon = laboratory ? FlaskConical : Briefcase
  const heading = organizationHeading(organization.fullName, organization.shortName)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-stretch gap-3">
        <span className={cn(
          'flex h-24 w-24 shrink-0 items-center justify-center rounded-xl',
          laboratory ? 'bg-primary/10 text-primary' : 'bg-[oklch(0.96_0.03_75)] text-[oklch(0.42_0.09_55)]',
        )}>
          <KindIcon className="h-10 w-10" aria-hidden />
        </span>
        <div className="flex min-h-24 min-w-0 flex-1 flex-col justify-center gap-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="line-clamp-2 text-base font-semibold leading-tight">{heading}</h2>
            {menu}
          </div>
          <p className="text-sm text-muted-foreground">
            {t('corporation.requisites', {
              inn: organization.inn.trim() || '—',
              kpp: organization.kpp.trim() || '—',
            })}
          </p>
          <span className={cn(
            'inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium',
            laboratory
              ? 'bg-[oklch(0.93_0.04_168)] text-[oklch(0.32_0.07_168)]'
              : 'bg-[oklch(0.96_0.035_75)] text-[oklch(0.38_0.08_55)]',
          )}>
            {t(organizationKindLabelKey(organization.kind))}
          </span>
        </div>
      </div>
      <dl className="grid gap-2 border-t border-border pt-3 text-sm">
        <CardFact label={t('corporation.field-address')} value={organization.address} />
        <CardFact
          label={t('corporation.field-employees')}
          value={organization.employeeCount == null ? t('corporation.employees-hidden') : String(organization.employeeCount)}
        />
        <CardFact label={t('corporation.field-requests')} value={String(organization.requestCount)} />
        <CardFact label={t('corporation.field-administrator')} value={organization.administrator ?? undefined} />
      </dl>
    </div>
  )
}

function CardFact({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[14.5rem_minmax(0,1fr)] sm:items-baseline sm:gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium">{value?.trim() ? value : '—'}</dd>
    </div>
  )
}
