import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../breadcrumb'

export type PageCrumb = { label: string; to?: string }

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
}: {
  title: string
  description?: ReactNode
  breadcrumbs?: PageCrumb[]
  actions?: ReactNode
}) {
  return (
    <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        {breadcrumbs && breadcrumbs.length > 0 ? <PageCrumbs items={breadcrumbs} /> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? <div className="max-w-3xl text-sm text-muted-foreground">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export function PageCrumbs({ items }: { items: PageCrumb[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList className="text-xs sm:text-sm">
        {items.map((item, index) => {
          const last = index === items.length - 1
          return (
            <Fragment key={`${item.label}-${index}`}>
              {index > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem className="min-w-0">
                {last || !item.to ? (
                  <BreadcrumbPage className="max-w-[14rem] truncate sm:max-w-xs">{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={item.to} className="max-w-[10rem] truncate sm:max-w-[14rem]">{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
