import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../../shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../../shared/ui/dialog'
import { Textarea } from '../../../../shared/ui/textarea'
import { DraftField } from './draft/draft-ui'

export type ReviewDialogKind = 'return' | 'reject' | 'withdraw' | 'derive' | 'program-return'

export function RequestReviewDialog({
  kind,
  busy,
  onClose,
  onConfirm,
}: {
  kind: ReviewDialogKind | null
  busy: boolean
  onClose: () => void
  onConfirm: (reason?: string) => void
}) {
  const { t } = useTranslation()
  const field = useRef<HTMLTextAreaElement>(null)
  const [reason, setReason] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [seen, setSeen] = useState(kind)
  if (kind !== seen) {
    setSeen(kind)
    setReason('')
    setInvalid(false)
  }
  const needsReason = kind === 'return' || kind === 'reject' || kind === 'program-return'
  const submit = () => {
    if (busy || !kind) return
    if (needsReason && reason.trim() === '') {
      setInvalid(true)
      field.current?.focus()
      return
    }
    onConfirm(needsReason ? reason.trim() : undefined)
  }

  return (
    <Dialog open={kind != null} onOpenChange={(next) => { if (!next && !busy) onClose() }}>
      <DialogContent>
        {kind ? (
          <>
            <DialogHeader>
              <DialogTitle>{t(`requests.review.${kind}-title`)}</DialogTitle>
              <DialogDescription>{t(`requests.review.${kind}-body`)}</DialogDescription>
            </DialogHeader>
            {needsReason ? (
              <DraftField field="reason" label={t('requests.review.reason')} required>
                <Textarea
                  ref={field}
                  value={reason}
                  maxLength={1000}
                  aria-invalid={invalid || undefined}
                  onChange={(event) => {
                    setReason(event.target.value)
                    if (event.target.value.trim()) setInvalid(false)
                  }}
                />
                {invalid ? <p role="alert" className="text-sm text-destructive">{t('requests.review.reason-required')}</p> : null}
              </DraftField>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t('requests.create-cancel')}</Button>
              <Button type="button" variant={kind === 'reject' ? 'destructive' : 'default'} disabled={busy} onClick={submit}>
                {t('requests.review.confirm')}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
