import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  createdRecordId,
  emptyAnswers,
  fillAllowsSubmit,
  FormRenderer,
  inputFieldCount,
  publishedFormScreen,
  readFormError,
  useCreateFormRecordMutation,
  useGetPublishedFormQuery,
  validateAnswers,
  type FormAnswers,
  type PublishedFormResponse,
} from '../../../entities/form'
import { Button } from '../../../shared/ui/button'
import { PageState, WorkPage } from '../../../shared/ui/page'

type FormFillProps = {
  organizationId: number
  formId: string
  canCreate: boolean
  backHref: string
  backLabel: string
  configureHref: string | null
  recordHref: (recordId: string) => string
  onDirty: (dirty: boolean) => void
}

export function FormFill({
  organizationId,
  formId,
  canCreate,
  backHref,
  backLabel,
  configureHref,
  recordHref,
  onDirty,
}: FormFillProps) {
  const { t } = useTranslation()
  const query = useGetPublishedFormQuery({ organizationId, formId })
  const [pinned, setPinned] = useState<PublishedFormResponse | null>(null)
  const [answers, setAnswers] = useState<FormAnswers | null>(null)
  const current = query.currentData
  const currentMatches = current != null && current.formId === formId && current.organizationId === organizationId
  const pinMatches = pinned != null && pinned.formId === formId && pinned.organizationId === organizationId
  if (currentMatches && current && !pinMatches) {
    setPinned(current)
    setAnswers(emptyAnswers(current.schema))
  }
  const screen = publishedFormScreen({
    loading: !pinMatches && !query.isError,
    error: !pinMatches && query.isError ? readFormError(query.error) : null,
    fieldCount: pinMatches && pinned ? inputFieldCount(pinned.schema) : null,
  })

  return (
    <WorkPage width="form">
      <FillNav backHref={backHref} backLabel={backLabel} configureHref={configureHref} configureLabel={t('forms.configure-form')} />
      {screen === 'loading' || ((screen === 'ready' || screen === 'empty') && (!pinMatches || !answers || !pinned)) ? (
        <PageState kind="loading" description={t('forms.loading')} />
      ) : null}
      {screen === 'forbidden' ? <PageState kind="error" description={t('forms.errors.forbidden')} /> : null}
      {screen === 'unpublished' ? (
        <PageState kind="empty" title={t('forms.no-version')} description={t('forms.errors.not_found')} />
      ) : null}
      {screen === 'failed' ? (
        <PageState
          kind="error"
          description={t(`forms.errors.${readFormError(query.error).code ?? 'generic'}`, { defaultValue: t('forms.errors.generic') })}
          action={<Button type="button" variant="outline" onClick={() => void query.refetch()}>{t('forms.retry')}</Button>}
        />
      ) : null}
      {pinMatches && pinned && answers && (screen === 'ready' || screen === 'empty') ? (
        <FillBody
          organizationId={organizationId}
          formId={formId}
          canCreate={canCreate}
          pinned={pinned}
          answers={answers}
          empty={screen === 'empty'}
          newer={currentMatches && current != null && current.versionId !== pinned.versionId}
          backHref={backHref}
          recordHref={recordHref}
          onDirty={onDirty}
          onAnswers={setAnswers}
        />
      ) : null}
    </WorkPage>
  )
}

function FillNav({
  backHref,
  backLabel,
  configureHref,
  configureLabel,
}: {
  backHref: string
  backLabel: string
  configureHref: string | null
  configureLabel: string
}) {
  return (
    <nav className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
      <Link className="text-sm text-primary underline-offset-4 hover:underline" to={backHref}>{backLabel}</Link>
      {configureHref ? (
        <Link className="text-sm text-primary underline-offset-4 hover:underline" to={configureHref}>{configureLabel}</Link>
      ) : null}
    </nav>
  )
}

function FillBody({
  organizationId,
  formId,
  canCreate,
  pinned,
  answers,
  empty,
  newer,
  backHref,
  recordHref,
  onDirty,
  onAnswers,
}: {
  organizationId: number
  formId: string
  canCreate: boolean
  pinned: PublishedFormResponse
  answers: FormAnswers
  empty: boolean
  newer: boolean
  backHref: string
  recordHref: (recordId: string) => string
  onDirty: (dirty: boolean) => void
  onAnswers: (answers: FormAnswers) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [conflict, setConflict] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [createRecord] = useCreateFormRecordMutation()
  const allowSubmit = fillAllowsSubmit(pinned.schema, canCreate) && !empty

  const submit = async () => {
    if (submitting || !allowSubmit) return
    const reviewed = validateAnswers(pinned.schema, answers)
    if (!reviewed.ok) {
      setErrors(reviewed.code === 'invalid_payload' ? reviewed.fields : {})
      return
    }
    setErrors({})
    setSubmitting(true)
    try {
      const created = await createRecord({
        organizationId,
        formId,
        formVersionId: pinned.versionId,
        values: reviewed.values,
      }).unwrap()
      const recordId = createdRecordId(created)
      if (!recordId) return
      toast.success(t('forms.fill-saved'))
      onDirty(false)
      navigate(recordHref(recordId))
    } catch (error) {
      const parsed = readFormError(error)
      if (parsed.code === 'version_conflict') setConflict(true)
      else if (parsed.code === 'invalid_payload') setErrors(parsed.fields)
      else if (parsed.code === 'empty_schema') toast.error(t('forms.fill-no-fields'))
      else toast.error(t(`forms.errors.${parsed.code ?? 'generic'}`, { defaultValue: t('forms.errors.generic') }))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      className="flex min-w-0 flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <header className="min-w-0 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('forms.fill-kicker')}</p>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight text-foreground">{pinned.title}</h1>
          <span className="inline-flex w-fit shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {t('forms.version', { number: pinned.versionNumber })}
          </span>
        </div>
        {pinned.description ? <p className="max-w-3xl whitespace-pre-wrap break-words text-sm text-muted-foreground">{pinned.description}</p> : null}
      </header>
      {conflict || newer ? <p className="text-sm text-destructive" role="alert">{t('forms.fill-conflict')}</p> : null}
      {!canCreate && !empty ? <p className="text-sm text-muted-foreground">{t('forms.fill-no-create')}</p> : null}
      {empty ? <PageState kind="empty" description={t('forms.fill-no-fields')} /> : (
        <>
          {pinned.schema.fields.some((field) => field.required) ? <p className="text-sm text-foreground">{t('forms.required-note')}</p> : null}
          <div className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6">
            <FormRenderer
              schema={pinned.schema}
              values={answers}
              errors={errors}
              readOnly={!canCreate || submitting}
              onChange={(fieldId, value) => {
                onAnswers({ ...answers, [fieldId]: value })
                onDirty(true)
                setConflict(false)
              }}
            />
          </div>
        </>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        {allowSubmit ? (
          <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
            {submitting ? t('forms.fill-submitting') : t('forms.fill-submit')}
          </Button>
        ) : null}
        <Button type="button" variant="outline" className="w-full sm:w-auto" asChild>
          <Link to={backHref}>{t('forms.fill-cancel')}</Link>
        </Button>
      </div>
    </form>
  )
}
