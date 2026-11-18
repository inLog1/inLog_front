import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FileText, Image as ImageIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  displayAttachmentType,
  useLazyGetSampleDocumentContentQuery,
  type Sample,
  type SampleDocumentView,
} from '../../../../entities/sample'
import { Button } from '../../../../shared/ui/button'
import { SAMPLE_ATTACHMENT_MESSAGE_KEY } from '../model/labels'
import { formatSampleEventWhen, sampleDay } from '../model/display'

export function SampleDocuments({
  organizationId,
  sampleId,
  documents,
  loading,
  failed,
  samples,
  hrefFor,
}: {
  organizationId: number
  sampleId: string
  documents: SampleDocumentView[]
  loading: boolean
  failed: boolean
  samples: readonly Sample[]
  hrefFor: (id: string) => string
}) {
  const { t, i18n } = useTranslation()
  const [loadContent] = useLazyGetSampleDocumentContentQuery()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const dash = t('samples.dash')

  async function take(file: SampleDocumentView, open: boolean) {
    if (pendingId) return
    setPendingId(file.id)
    try {
      const blob = await loadContent({ organizationId, sampleId, fileId: file.id }).unwrap()
      const url = URL.createObjectURL(blob)
      if (open) {
        window.open(url, '_blank', 'noopener,noreferrer')
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      } else {
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = file.filename
        anchor.rel = 'noopener'
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
      }
    } catch {
      toast.error(t('samples.errors.download'))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section aria-labelledby="sample-files-title">
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <h2 id="sample-files-title" className="text-base font-semibold">{t('samples.documents.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('samples.documents.lead')}</p>
      </div>
      <div className="px-5 py-5 sm:px-6">
        {failed ? <p className="text-sm text-destructive" role="alert">{t('samples.documents.error')}</p> : null}
        {loading ? <p className="text-sm text-muted-foreground" role="status">{t('samples.documents.loading')}</p> : null}
        {!failed && !loading && documents.length === 0 ? <p className="text-sm text-muted-foreground">{t('samples.documents.empty')}</p> : null}
        {!failed && !loading && documents.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('samples.documents.file')}</th>
                  <th className="px-3 py-2 font-medium">{t('samples.documents.related')}</th>
                  <th className="px-3 py-2 font-medium"><span className="sr-only">{t('samples.documents.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {documents.map((file) => {
                  const related = samples.filter((item) => file.sampleIds.includes(item.id))
                  const typeKey = SAMPLE_ATTACHMENT_MESSAGE_KEY[file.type]
                  const typeLabel = typeKey ? t(typeKey) : displayAttachmentType(file.type)
                  const canOpen = file.mimeType === 'application/pdf' || file.mimeType.startsWith('image/')
                  return (
                    <tr key={file.id} className="border-t border-border align-top">
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <span className="mt-0.5 text-muted-foreground">
                            {file.mimeType.startsWith('image/') ? <ImageIcon className="h-4 w-4" aria-hidden /> : <FileText className="h-4 w-4" aria-hidden />}
                          </span>
                          <div className="min-w-0">
                            <p className="break-all font-medium">{file.filename}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {typeLabel}
                              {file.documentNumber.trim() ? ` · ${t('samples.documents.number', { number: file.documentNumber })}` : ''}
                              {file.documentDate.trim() ? ` · ${sampleDay(file.documentDate, dash)}` : ''}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatSampleEventWhen(file.uploadedAt, i18n.language)}
                              {' · '}
                              {formatFileSize(file.size, t)}
                              {file.uploadedBy.trim() ? ` · ${file.uploadedBy}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-xs text-muted-foreground">{t('samples.documents.count', { total: file.sampleIds.length })}</p>
                        <ul className="mt-2 space-y-1">
                          {related.map((item) => (
                            <li key={item.id}>
                              {item.id === sampleId ? (
                                <span className="text-xs">{item.code} · {t('samples.documents.current')}</span>
                              ) : (
                                <Link className="text-xs text-primary underline-offset-4 hover:underline" to={hrefFor(item.id)}>{item.code}</Link>
                              )}
                            </li>
                          ))}
                          {related.length < file.sampleIds.length ? <li className="text-xs text-muted-foreground">{t('samples.documents.missing')}</li> : null}
                        </ul>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap justify-end gap-1">
                          {canOpen ? (
                            <Button type="button" size="sm" variant="ghost" disabled={pendingId === file.id} onClick={() => void take(file, true)}>
                              {t('samples.documents.open')}
                            </Button>
                          ) : null}
                          <Button type="button" size="sm" variant="ghost" disabled={pendingId === file.id} onClick={() => void take(file, false)}>
                            <Download className="h-4 w-4" aria-hidden />
                            {t('samples.documents.download')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function formatFileSize(size: number, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (size < 1024 * 1024) return t('samples.documents.kilobytes', { amount: Math.max(1, Math.ceil(size / 1024)) })
  return t('samples.documents.megabytes', { amount: (size / (1024 * 1024)).toFixed(1) })
}
