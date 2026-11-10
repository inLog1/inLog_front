import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Eye, FileText, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  REQUEST_BASIS_MAX_BYTES,
  requestBasisFileAllowed,
  useDeleteRequestBasisMutation,
  useUploadRequestBasisMutation,
  type RequestBasisDocument,
} from '../../../../../entities/request'
import { Button } from '../../../../../shared/ui/button'
import { requestFailureCode } from '../../model/display'
import { DraftSection } from './draft-ui'

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function BasisSection({
  organizationId,
  requestId,
  canEdit,
  basisDocument,
  sendAttempted,
}: {
  organizationId: number
  requestId: string | null
  canEdit: boolean
  basisDocument: RequestBasisDocument | null | undefined
  sendAttempted?: boolean
}) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploadBasis, uploadState] = useUploadRequestBasisMutation()
  const [deleteRequestBasis, deleteState] = useDeleteRequestBasisMutation()
  const [localError, setLocalError] = useState<string | null>(null)
  const busy = uploadState.isLoading || deleteState.isLoading

  const openContent = (download: boolean) => {
    if (!basisDocument?.url) return
    const url = `${basisDocument.url}organization=${organizationId}`
    if (download) {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = basisDocument.filename
      anchor.rel = 'noopener'
      anchor.click()
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const pickFile = async (file: File) => {
    setLocalError(null)
    if (!requestId) {
      setLocalError('save_first')
      return
    }
    const allowed = requestBasisFileAllowed(file)
    if (allowed !== 'ok') {
      setLocalError(allowed)
      return
    }
    try {
      await uploadBasis({ organizationId, requestId, file }).unwrap()
      toast.success(t('requests.draft.basis-uploaded'))
    } catch (error) {
      const code = requestFailureCode(error)
      toast.error(t(`requests.errors.${code ?? 'generic'}`, { defaultValue: t('requests.errors.generic') }))
    }
  }

  const remove = async () => {
    if (!requestId || !basisDocument) return
    setLocalError(null)
    try {
      await deleteRequestBasis({ organizationId, requestId }).unwrap()
      toast.success(t('requests.draft.basis-removed'))
    } catch (error) {
      const code = requestFailureCode(error)
      toast.error(t(`requests.errors.${code ?? 'generic'}`, { defaultValue: t('requests.errors.generic') }))
    }
  }

  const showMissing = sendAttempted && !basisDocument

  return (
    <DraftSection
      id="request-basis"
      index={4}
      title={t('requests.draft.sections.basis')}
      description={t('requests.draft.basis-lead')}
    >
      <div className="max-w-3xl space-y-4" data-field="basisDocument">
        <p className="text-sm text-muted-foreground">{t('requests.draft.basis-explain')}</p>
        {!requestId ? (
          <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-foreground">
            {t('requests.draft.basis-save-first')}
          </p>
        ) : null}
        {!basisDocument ? (
          <div className="relative rounded-lg border border-dashed border-border bg-muted/40 px-4 py-8 text-center">
            <p className="text-sm text-foreground">{t('requests.draft.basis-empty')}</p>
            {canEdit ? (
              <Button type="button" variant="outline" className="mt-4" disabled={busy || !requestId} onClick={() => inputRef.current?.click()}>
                {t('requests.draft.basis-choose')}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-medium text-foreground">{basisDocument.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(basisDocument.size)} · {basisDocument.mimeType || t('requests.dash')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => openContent(false)}>
                <Eye className="size-4" aria-hidden />
                {t('requests.draft.basis-view')}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => openContent(true)}>
                <Download className="size-4" aria-hidden />
                {t('requests.draft.basis-download')}
              </Button>
              {canEdit ? (
                <>
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
                    {t('requests.draft.basis-replace')}
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void remove()}>
                    <Trash2 className="size-4" aria-hidden />
                    {t('requests.draft.basis-delete')}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        )}
        {canEdit ? (
          <p className="text-xs text-muted-foreground">
            {t('requests.draft.basis-limit', { size: formatBytes(REQUEST_BASIS_MAX_BYTES) })}
          </p>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
          aria-label={t('requests.draft.basis-choose')}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void pickFile(file)
          }}
        />
        {localError ? (
          <p role="status" className="text-sm text-destructive">{t(`requests.draft.basis-error.${localError}`)}</p>
        ) : null}
        {showMissing ? (
          <p role="alert" className="text-sm text-destructive">{t('requests.send-gaps.basis_document')}</p>
        ) : null}
      </div>
    </DraftSection>
  )
}
