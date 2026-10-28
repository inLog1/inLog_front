import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { isSectionId, type SectionStatus } from '../../../../entities/section'
import { SectionEditor } from '../../../../features/section-builder/ui/SectionEditor'
import { WorkspaceStatus } from '../../../../features/org-project-selector'
import { useHasOrganizationGrant, useOrganizationAccessReady, useWorkspaceSection } from '../../../../features/org-project-selector/model/useWorkspaceSection'
import { useWorkspaceHref } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { routes } from '../../../../shared/lib/routes'
import { Badge } from '../../../../shared/ui/badge'
import { Button } from '../../../../shared/ui/button'
import { PageHeader, WorkPage } from '../../../../shared/ui/page'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../shared/ui/alert-dialog'
import { settleSavedLeave } from '../../forms/model/leave-guard'
import { useLeaveGuard } from '../../forms/model/use-leave-guard'
import { SectionsBoundary } from './SectionsBoundary'

export function SectionCreatePage() {
  return (
    <SectionsBoundary>
      <EditorGate sectionId={null} />
    </SectionsBoundary>
  )
}

export function SectionEditorPage() {
  const { sectionId = '' } = useParams()
  return (
    <SectionsBoundary>
      <EditorGate sectionId={sectionId} />
    </SectionsBoundary>
  )
}

function EditorGate({ sectionId }: { sectionId: string | null }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const href = useWorkspaceHref()
  const [search, setSearch] = useSearchParams()
  const section = useWorkspaceSection('organization')
  const readyOrg = section.kind === 'ready' ? section.organizationId : null
  const [lockedOrg, setLockedOrg] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const saveRef = useRef<(() => Promise<boolean>) | null>(null)
  const attempt = useRef(0)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const editorKey = `${lockedOrg ?? 'pending'}:${sectionId ?? 'new'}`
  const [reported, setReported] = useState<{ key: string; status: SectionStatus | null }>({ key: editorKey, status: null })
  if (reported.key !== editorKey) setReported({ key: editorKey, status: null })
  const documentStatus = reported.key === editorKey ? reported.status : null
  const reportStatus = useCallback((status: SectionStatus | null) => {
    setReported((current) => (
      current.key === editorKey && current.status === status ? current : { key: editorKey, status }
    ))
  }, [editorKey])
  const grantOrg = lockedOrg ?? readyOrg
  const accessReady = useOrganizationAccessReady(grantOrg)
  const canCreate = useHasOrganizationGrant('sections', 'create', grantOrg)
  const canUpdate = useHasOrganizationGrant('sections', 'update', grantOrg)
  const canPublish = useHasOrganizationGrant('sections', 'publish', grantOrg)
  const urlOrg = Number(search.get('org'))
  if (readyOrg != null && lockedOrg == null) setLockedOrg(readyOrg)
  const switched = lockedOrg != null && Number.isInteger(urlOrg) && urlOrg > 0 && urlOrg !== lockedOrg
  if (switched && !dirty) setLockedOrg(urlOrg)
  const leave = useLeaveGuard(dirty)
  if (sectionId != null && !isSectionId(sectionId)) {
    return <p className="p-4 text-sm text-muted-foreground">{t('sections.errors.not_found')}</p>
  }
  if (lockedOrg == null) {
    return (
      <WorkspaceStatus
        status={section.kind === 'ready' ? 'loading' : section.status}
        reason={section.kind === 'ready' ? null : section.reason}
        onRetry={section.kind === 'ready' ? undefined : section.refetch}
      />
    )
  }
  if (!switched && section.kind !== 'ready') {
    return <WorkspaceStatus status={section.status} reason={section.reason} onRetry={section.refetch} />
  }
  if (!accessReady) return <WorkspaceStatus status="loading" reason={null} />
  if (sectionId == null ? !canCreate : !canUpdate) return <WorkspaceStatus status="forbidden" reason="missing-permission" />
  const restore = () => {
    setSearch((prev) => {
      const next = new URLSearchParams(prev)
      next.set('org', String(lockedOrg))
      return next
    }, { replace: true })
  }
  const cancelLeave = () => { attempt.current += 1 }
  const saveThen = async (after: () => void) => {
    if (saving) return
    const ticket = ++attempt.current
    setSaving(true)
    const saved = await saveRef.current?.() ?? false
    if (!mounted.current) return
    setSaving(false)
    if (settleSavedLeave({ ticket, currentTicket: attempt.current, mounted: true, saved }) !== 'navigate') return
    setDirty(false)
    after()
  }
  const pageTitle = sectionId == null ? t('sections.create') : t('sections.configure')
  return (
    <WorkPage>
      <div className="mx-auto flex w-full min-w-0 max-w-[1240px] flex-col gap-4">
        <PageHeader
          title={pageTitle}
          description={t('sections.lead')}
          breadcrumbs={[{ label: t('nav.sections'), to: href(routes.settings.sections(), 'organization') }, { label: pageTitle }]}
          actions={documentStatus ? (
            <div className="flex max-w-full flex-wrap items-center gap-2">
              <Badge variant="outline" className="h-auto max-w-full gap-1.5 py-1 font-medium whitespace-normal">
                <FileText className="size-3.5 shrink-0" aria-hidden />
                {t(`sections.status.${documentStatus}`)}
              </Badge>
              {dirty ? <span className="max-w-full text-sm text-muted-foreground">{t('sections.unsaved')}</span> : null}
            </div>
          ) : null}
        />
        <SectionEditor
          key={editorKey}
          organizationId={lockedOrg}
          sectionId={sectionId}
          canPublish={canPublish}
          previewHref={sectionId ? href(routes.settings.sectionPreview(sectionId), 'organization') : null}
          saveRef={saveRef}
          onDirty={setDirty}
          onSaved={(id) => {
            setDirty(false)
            navigate(href(routes.settings.section(id), 'organization'))
          }}
          onStatus={reportStatus}
        />
      </div>
      <AlertDialog open={leave.nextUrl != null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('forms.leave-title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('forms.leave-body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => { cancelLeave(); leave.dismiss() }}>{t('forms.leave-stay')}</Button>
            <Button type="button" variant="outline" onClick={() => {
              const next = leave.nextUrl
              cancelLeave()
              setDirty(false)
              leave.dismiss()
              if (next) navigate(next)
            }}>{t('forms.leave-discard')}</Button>
            <Button type="button" disabled={saving} onClick={() => void saveThen(() => {
              const next = leave.nextUrl
              leave.dismiss()
              if (next) navigate(next)
            })}>{t('forms.leave-save')}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={switched && dirty && leave.nextUrl == null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('forms.org-title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('forms.org-body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => { cancelLeave(); restore() }}>{t('forms.org-stay')}</Button>
            <Button type="button" variant="outline" onClick={() => { cancelLeave(); setDirty(false); setLockedOrg(urlOrg) }}>{t('forms.org-discard')}</Button>
            <Button type="button" disabled={saving} onClick={() => void saveThen(() => setLockedOrg(urlOrg))}>{t('forms.org-save')}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkPage>
  )
}
