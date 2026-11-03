import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useGetOrganizationByIdQuery } from '../../../../entities/organization/model/organizationSlice'
import { ReferenceSection } from '../../../../features/reference'
import { getApiMode } from '../../../../shared/config/runtime'
import { PersonnelSection } from '../../../../features/personnel'
import { parseRouteId } from '../../../../features/org-project-selector/model/workspace-context'
import { routes } from '../../../../shared/lib/routes'
import { Button } from '../../../../shared/ui/button'
import { PageState, WorkPage } from '../../../../shared/ui/page'

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
      next.delete('employee')
      next.delete('directory')
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
        <PageState
          kind="empty"
          description={t('settings-page.modules-choose')}
          action={(
            <Button asChild>
              <Link to={routes.settings.organizations()}>{t('nav.corporation')}</Link>
            </Button>
          )}
        />
      </WorkPage>
    )
  }
  if (parsed.kind === 'invalid') {
    return (
      <WorkPage>
        <PageState kind="empty" description={t('settings-page.modules-invalid')} />
      </WorkPage>
    )
  }
  if (switching || organization.isLoading || organization.isUninitialized) {
    return (
      <WorkPage>
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

  const scopeLabel = loaded.fullName || loaded.shortName || String(loaded.id)
  if (getApiMode() !== 'mock') {
    return (
      <WorkPage>
        <PageState kind="empty" description={t('personnel.unavailable')} />
      </WorkPage>
    )
  }
  if (module === 'reference') {
    return (
      <WorkPage>
        <ReferenceSection organizationId={loaded.id} scopeLabel={scopeLabel} />
      </WorkPage>
    )
  }

  return (
    <WorkPage>
      <PersonnelSection organizationId={loaded.id} organizationName={scopeLabel} />
    </WorkPage>
  )
}
