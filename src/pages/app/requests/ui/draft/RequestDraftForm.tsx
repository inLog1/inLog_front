import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  DraftIssue,
  ExecutorLaboratory,
  OrganizationKind,
  RequestBasisDocument,
  RequestCatalog,
  RequestDraftDetails,
  SendGap,
} from '../../../../../entities/request'
import { sendGapFocus } from '../../model/send-gaps'
import { cn } from '../../../../../shared/lib/utils'
import { Button } from '../../../../../shared/ui/button'
import { Card } from '../../../../../shared/ui/card'
import { countStudyWells } from '../../model/draft-form'
import { BasisSection } from './BasisSection'
import { GeneralSection } from './GeneralSection'
import { LegacyPanel } from './LegacyPanel'
import { NeedsSection } from './NeedsSection'
import { ObjectsSection } from './ObjectsSection'

export type WizardValues = {
  customerOrganizationId: number | null
  executorOrganizationId: number | null
  details: RequestDraftDetails
}

export type DraftFormHandle = {
  blockingIssues: () => DraftIssue[]
  focusField: (field: string) => void
  focusSendGap: (gap: SendGap) => void
}

const SECTIONS = ['request-general', 'request-objects', 'request-program', 'request-basis'] as const

export const RequestDraftForm = forwardRef<DraftFormHandle, {
  kind: OrganizationKind
  customerName: string
  executorName: string
  values: WizardValues
  catalog: RequestCatalog
  customers: ExecutorLaboratory[]
  laboratories: ExecutorLaboratory[]
  partiesLoading: boolean
  issues: DraftIssue[]
  partyIssue: boolean
  partyCode: 'executor_required' | 'foreign_party' | null
  saveAttempted: boolean
  sendAttempted: boolean
  saving: boolean
  sending: boolean
  organizationId: number
  requestId: string | null
  basisDocument: RequestBasisDocument | null | undefined
  canSend: boolean
  canEditBasis: boolean
  sendGaps: SendGap[]
  sendLabel: string
  pendingBasisFile?: File | null
  onPendingBasisFile?: (file: File | null) => void
  notices?: readonly string[]
  onChange: (values: WizardValues) => void
  onSave: () => void
  onSend: () => void
}>(function RequestDraftForm({
  kind,
  customerName,
  executorName,
  values,
  catalog,
  customers,
  laboratories,
  partiesLoading,
  issues,
  partyIssue,
  partyCode,
  saveAttempted,
  sendAttempted,
  saving,
  sending,
  organizationId,
  requestId,
  basisDocument,
  canSend,
  canEditBasis,
  sendGaps,
  sendLabel,
  pendingBasisFile = null,
  onPendingBasisFile,
  notices = [],
  onChange,
  onSave,
  onSend,
}, ref) {
  const { t } = useTranslation()
  const valuesRef = useRef(values)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    valuesRef.current = values
    onChangeRef.current = onChange
  })
  const formElement = useRef<HTMLFormElement>(null)
  const intervalRef = useRef<DraftIssue[]>([])
  const quantityRef = useRef<DraftIssue[]>([])
  const [blocking, setBlocking] = useState<DraftIssue[]>([])
  const [active, setActive] = useState<string>(SECTIONS[0])

  const publishBlocking = useCallback(() => {
    setBlocking([...intervalRef.current, ...quantityRef.current])
  }, [])
  const onIntervalIssues = useCallback((next: DraftIssue[]) => {
    intervalRef.current = next
    publishBlocking()
  }, [publishBlocking])
  const onQuantityIssues = useCallback((next: DraftIssue[]) => {
    quantityRef.current = next
    publishBlocking()
  }, [publishBlocking])

  useImperativeHandle(ref, () => ({
    blockingIssues: () => [...intervalRef.current, ...quantityRef.current],
    focusField: (field: string) => {
      const form = formElement.current
      const target = form?.querySelector<HTMLElement>(`[data-field="${CSS.escape(field)}"]`)
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target?.querySelector<HTMLElement>('input, textarea, button, select')?.focus({ preventScroll: true })
    },
    focusSendGap: (gap: SendGap) => {
      const focus = sendGapFocus(gap)
      if (focus.sectionId) {
        setActive(focus.sectionId)
        document.getElementById(focus.sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      if (focus.field) {
        const form = formElement.current
        const target = form?.querySelector<HTMLElement>(`[data-field="${CSS.escape(focus.field)}"]`)
          ?? (focus.sectionId ? document.getElementById(focus.sectionId) : null)
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        target?.querySelector<HTMLElement>('input, textarea, button, select')?.focus({ preventScroll: true })
      }
    },
  }), [])

  const commit = useCallback((recipe: (current: RequestDraftDetails) => RequestDraftDetails) => {
    const current = valuesRef.current
    const next = recipe(current.details)
    if (next === current.details) return
    const updated = { ...current, details: next }
    valuesRef.current = updated
    onChangeRef.current(updated)
  }, [])

  const scrollTo = (id: string) => {
    setActive(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    const nodes = SECTIONS.map((id) => document.getElementById(id)).filter((node): node is HTMLElement => node != null)
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0]
      if (visible?.target.id) setActive(visible.target.id)
    }, { rootMargin: '-15% 0px -55% 0px', threshold: [0.15, 0.4] })
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  const invalid = new Set(issues.map((item) => item.field))
  const codes = [...new Set([...issues, ...(saveAttempted ? blocking : [])].map((item) => item.code))]
  const wellCount = countStudyWells(values.details.fields)
  const needCount = values.details.needs.length
  const nav = [
    { id: SECTIONS[0], label: t('requests.draft.sections.general') },
    { id: SECTIONS[1], label: t('requests.draft.sections.objects') },
    { id: SECTIONS[2], label: t('requests.draft.sections.program') },
    { id: SECTIONS[3], label: t('requests.draft.sections.basis') },
  ]

  return (
    <form
      ref={formElement}
      className="relative grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_17.5rem]"
      onSubmit={(event) => {
        event.preventDefault()
        onSave()
      }}
    >
      <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
        {notices.length > 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-4 text-sm text-foreground shadow-sm md:px-6">
            {notices.map((notice) => <p key={notice}>{notice}</p>)}
          </div>
        ) : null}
        <GeneralSection
          kind={kind}
          customerName={customerName}
          executorName={executorName}
          customerOrganizationId={values.customerOrganizationId}
          executorOrganizationId={values.executorOrganizationId}
          customers={customers}
          laboratories={laboratories}
          partiesLoading={partiesLoading}
          details={values.details}
          partyIssue={partyIssue}
          saveAttempted={saveAttempted}
          invalid={invalid}
          onCustomer={(customerOrganizationId) => {
            const updated = { ...valuesRef.current, customerOrganizationId }
            valuesRef.current = updated
            onChangeRef.current(updated)
          }}
          onExecutor={(executorOrganizationId) => {
            const updated = { ...valuesRef.current, executorOrganizationId }
            valuesRef.current = updated
            onChangeRef.current(updated)
          }}
          onChange={(next) => commit((current) => ({ ...current, ...next }))}
        />
        <ObjectsSection details={values.details} catalog={catalog} commit={commit} onIssues={onIntervalIssues} saveAttempted={saveAttempted} />
        <NeedsSection
          details={values.details}
          catalog={catalog}
          invalid={invalid}
          commit={commit}
          onIssues={onQuantityIssues}
          onShowObjects={() => scrollTo('request-objects')}
        />
        <BasisSection
          organizationId={organizationId}
          requestId={requestId}
          canEdit={canEditBasis}
          basisDocument={basisDocument}
          pendingBasisFile={pendingBasisFile}
          onPendingBasisFile={onPendingBasisFile}
          sendAttempted={sendAttempted}
        />
        <LegacyPanel details={values.details} catalog={catalog} />
        {partyIssue || (saveAttempted && codes.length > 0) ? (
          <div role="alert" className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
            {partyCode ? <p>{t(`requests.errors.${partyCode}`)}</p> : null}
            {codes.map((code) => (
              <p key={code}>{t(`requests.errors.${code}`, { defaultValue: t('requests.errors.invalid_draft') })}</p>
            ))}
          </div>
        ) : null}
        {sendAttempted && sendGaps.length > 0 ? (
          <div role="alert" className="rounded-lg border border-destructive/40 bg-card px-4 py-3 text-sm text-foreground">
            <p className="font-medium text-foreground">{t('requests.send-gaps.title')}</p>
            {sendGaps.map((gap) => (
              <p key={gap}>{t(`requests.send-gaps.${gap}`)}</p>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2 rounded-xl border border-border bg-card px-4 py-4 shadow-sm md:px-6">
            <Button type="submit" variant="outline" disabled={saving || sending}>{t('requests.draft.save')}</Button>
            <Button type="button" disabled={saving || sending || !canSend} onClick={onSend}>
              {sendLabel}
            </Button>
        </div>
      </div>
      <aside className="order-1 lg:sticky lg:top-4 lg:order-2">
        <Card className="shadow-sm">
          <div className="space-y-1 border-b border-border px-4 py-4">
            <h2 className="text-sm font-semibold text-foreground">{t('requests.draft.composition')}</h2>
            <p className="text-sm text-muted-foreground">{t('requests.draft.wells-count', { count: wellCount })}</p>
            <p className="text-sm text-muted-foreground">{t('requests.draft.needs-count', { count: needCount })}</p>
          </div>
          <nav aria-label={t('requests.draft.composition')} className="flex gap-2 overflow-x-auto p-3 lg:flex-col lg:overflow-visible">
            {nav.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-current={active === item.id ? 'true' : undefined}
                className={cn(
                  'shrink-0 rounded-lg border px-3 py-2 text-left text-sm lg:w-full',
                  active === item.id ? 'border-primary bg-card text-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground',
                )}
                onClick={() => scrollTo(item.id)}
              >
                <span className="mr-2 text-xs font-medium">{index + 1}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </Card>
      </aside>
    </form>
  )
})
