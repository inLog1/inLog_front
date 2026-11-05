import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  REQUEST_TITLE_MAX,
  useUpdateRequestMutation,
  type RequestListItem,
} from '../../../../entities/request'
import { Button } from '../../../../shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../../shared/ui/dialog'
import { Input } from '../../../../shared/ui/input'
import { Label } from '../../../../shared/ui/label'
import { formatRequestWhen, requestFailureCode, requestLabel } from '../model/display'
import { RequestStatusBadge } from './RequestStatusBadge'

export function RequestDetailDialog({
  request,
  organizationId,
  canUpdate,
  onClose,
}: {
  request: RequestListItem | null
  organizationId: number
  canUpdate: boolean
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const [updateRequest, updateState] = useUpdateRequestMutation()
  const mark = request ? `${request.id}:${request.revision}` : ''
  const [seen, setSeen] = useState(mark)
  const [title, setTitle] = useState(request?.title ?? '')
  if (mark !== seen) {
    setSeen(mark)
    setTitle(request?.title ?? '')
  }
  const dash = t('requests.dash')
  const editable = request?.status === 'draft' && canUpdate
  const trimmed = title.trim()
  const changed = request != null && trimmed !== request.title.trim()
  const close = (next: boolean) => {
    if (!next && !updateState.isLoading) onClose()
  }
  const save = async () => {
    if (!request || !editable || !changed || trimmed.length > REQUEST_TITLE_MAX) return
    try {
      await updateRequest({
        requestId: request.id,
        organizationId,
        expectedRevision: request.revision,
        title: trimmed,
      }).unwrap()
      toast.success(t('requests.saved'))
    } catch (error) {
      const code = requestFailureCode(error)
      toast.error(t(`requests.errors.${code ?? 'generic'}`, { defaultValue: t('requests.errors.generic') }))
    }
  }
  const when = (value: string) => requestLabel(formatRequestWhen(value, i18n.language), dash)

  return (
    <Dialog open={request != null} onOpenChange={close}>
      <DialogContent>
        {request ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('requests.detail-title', { number: request.number })}</DialogTitle>
            </DialogHeader>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-4 sm:gap-y-3">
              <dt className="text-muted-foreground">{t('requests.field-number')}</dt>
              <dd className="font-medium text-foreground">{request.number}</dd>
              <dt className="text-muted-foreground sm:pt-2">{t('requests.field-title')}</dt>
              <dd>
                {editable ? (
                  <div className="space-y-1">
                    <Label htmlFor="request-detail-title" className="sr-only">{t('requests.field-title')}</Label>
                    <Input
                      id="request-detail-title"
                      value={title}
                      maxLength={REQUEST_TITLE_MAX}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                  </div>
                ) : (
                  <span className="text-foreground">{requestLabel(request.title, dash)}</span>
                )}
              </dd>
              <dt className="text-muted-foreground">{t('requests.field-customer')}</dt>
              <dd className="text-foreground">{requestLabel(request.customerShortName, dash)}</dd>
              <dt className="text-muted-foreground">{t('requests.columns.executor')}</dt>
              <dd className="text-foreground">{requestLabel(request.executorShortName, dash)}</dd>
              <dt className="text-muted-foreground">{t('requests.field-status')}</dt>
              <dd><RequestStatusBadge status={request.status} /></dd>
              <dt className="text-muted-foreground">{t('requests.field-author')}</dt>
              <dd className="text-foreground">{requestLabel(request.authorName, dash)}</dd>
              <dt className="text-muted-foreground">{t('requests.field-created')}</dt>
              <dd className="text-foreground">{when(request.createdAt)}</dd>
              <dt className="text-muted-foreground">{t('requests.field-updated')}</dt>
              <dd className="text-foreground">{when(request.updatedAt)}</dd>
            </dl>
            {editable ? (
              <DialogFooter>
                <Button type="button" variant="outline" disabled={updateState.isLoading} onClick={onClose}>
                  {t('requests.create-cancel')}
                </Button>
                <Button type="button" disabled={updateState.isLoading || !changed || !trimmed} onClick={() => void save()}>
                  {t('requests.save')}
                </Button>
              </DialogFooter>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
