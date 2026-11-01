import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useGetOrganizationByIdQuery } from '../../../../entities/organization/model/organizationSlice'
import { ReferenceSection } from '../../../../features/reference'
import { parseRouteId } from '../../../../features/org-project-selector/model/workspace-context'
import { routes } from '../../../../shared/lib/routes'
import { Button } from '../../../../shared/ui/button'
import { PageHeader, PageState, WorkPage } from '../../../../shared/ui/page'

type ModuleId = 'personnel' | 'reference'

function httpStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('status' in error)) return null
  const status = (error as { status: unknown }).status
  return typeof status === 'number' ? status : null
}

export function OrganizationModulePage({ module }: { module: ModuleId }) {
  const { t } = useTranslation()
  const params = useParams()
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams()
  const parsed = parseRouteId(params.organizationId ?? null)
  const title = module === 'personnel' ? t('nav.personnel') : t('nav.reference')
  const organizationId = parsed.kind === 'id' ? parsed.id : null
  const organization = useGetOrganizationByIdQuery(organizationId ?? 0, { skip: organizationId == null })
  const loaded = organization.currentData?.id === organizationId ? organization.currentData : null
  const requestedOrg = search.get('org')
  const requested = parseRouteId(requestedOrg)
  const switching = loaded != null && requested.kind === 'id' && requested.id !== organizationId

  useEffect(() => {
    if (organizationId == null || !loaded || loaded.id !== organizationId) return
    const selected = parseRouteId(requestedOrg)
    if (selected.kind === 'id' && selected.id !== organizationId) {
      const path = module === 'personnel'
        ? routes.settings.organizationPersonnel(selected.id)
        : routes.settings.organizationReference(selected.id)
      const next = new URLSearchParams(search)
      next.set('org', String(selected.id))
      next.set('directoryOrg', String(selected.id))
      navigate({ pathname: path, search: next.toString() }, { replace: true })
      return
    }
    if (requestedOrg === String(organizationId)) return
    const next = new URLSearchParams(search)
    next.set('org', String(organizationId))
    setSearch(next, { replace: true })
  }, [loaded, module, navigate, organizationId, requestedOrg, search, setSearch])

  if (parsed.kind === 'absent') {
    return (
      <WorkPage>
        <PageHeader title={title} />
        <PageState
          kind="empty"
          description={t('settings-page.modules-choose')}
          action={(
            <Button asChild>
              <Link to={routes.settings.organizations()}>{t('nav.organizations')}</Link>
            </Button>
          )}
        />
      </WorkPage>
    )
  }
  if (parsed.kind === 'invalid') {
    return (
      <WorkPage>
        <PageHeader title={title} />
        <PageState kind="empty" description={t('settings-page.modules-invalid')} />
      </WorkPage>
    )
  }
  if (switching || organization.isLoading || organization.isUninitialized) {
    return (
      <WorkPage>
        <PageHeader title={title} />
        <PageState kind="loading" description={t('workspace.loading')} />
      </WorkPage>
    )
  }
  if (organization.isError || !loaded) {
    const status = httpStatus(organization.error)
    const description = status === 404
      ? t('settings-page.modules-missing')
      : status === 403
        ? t('settings-page.modules-forbidden')
        : t('settings-page.modules-error')
    return (
      <WorkPage>
        <PageHeader title={title} />
        <PageState
          kind={status === 404 || status === 403 ? 'empty' : 'error'}
          description={description}
          action={status === 404 || status === 403 ? undefined : (
            <Button type="button" variant="outline" onClick={() => void organization.refetch()}>
              {t('workspace.retry')}
            </Button>
          )}
        />
      </WorkPage>
    )
  }

  const scopeLabel = loaded.fullName || loaded.shortName
  if (module === 'reference') {
    return (
      <WorkPage>
        <ReferenceSection scopeLabel={scopeLabel} />
      </WorkPage>
    )
  }

  return (
    <WorkPage>
      <PageHeader title={title} description={scopeLabel} />
      <p className="text-sm text-muted-foreground">{t('settings-page.modules-later')}</p>
    </WorkPage>
  )
}
