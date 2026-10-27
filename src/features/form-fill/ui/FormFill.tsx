import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  emptyAnswers,
  FormRenderer,
  readFormError,
  useCreateFormRecordMutation,
  useGetPublishedFormQuery,
  validateAnswers,
  type FormAnswers,
  type PublishedFormResponse,
} from '../../../entities/form'
import { Button } from '../../../shared/ui/button'

type FormFillProps = {
  organizationId: number
  formId: string
  canCreate: boolean
  recordHref: (recordId: string) => string
  onDirty: (dirty: boolean) => void
}

export function FormFill({ organizationId, formId, canCreate, recordHref, onDirty }: FormFillProps) {
  const query = useGetPublishedFormQuery({ organizationId, formId })
  const [pinned, setPinned] = useState<PublishedFormResponse | null>(null)
  const [answers, setAnswers] = useState<FormAnswers | null>(null)
  if (query.data && pinned == null) {
    setPinned(query.data)
    setAnswers(emptyAnswers(query.data.schema))
    return <p className="p-4 text-sm text-muted-foreground">…</p>
  }
  if (query.isLoading && !pinned) return <p className="p-4 text-sm text-muted-foreground">…</p>
  if (!pinned || !answers) return <FillProblem error={query.error} />
  const newer = query.data != null && query.data.versionId !== pinned.versionId
  return (
    <FillBody
      organizationId={organizationId}
      formId={formId}
      canCreate={canCreate}
      pinned={pinned}
      answers={answers}
      newer={newer}
      recordHref={recordHref}
      onDirty={onDirty}
      onAnswers={setAnswers}
    />
  )
}

function FillBody({
  organizationId,
  formId,
  canCreate,
  pinned,
  answers,
  newer,
  recordHref,
  onDirty,
  onAnswers,
}: {
  organizationId: number
  formId: string
  canCreate: boolean
  pinned: PublishedFormResponse
  answers: FormAnswers
  newer: boolean
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

  const submit = async () => {
    if (submitting || !canCreate) return
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
      toast.success(t('forms.fill-saved'))
      onDirty(false)
      navigate(recordHref(created.id))
    } catch (error) {
      const parsed = readFormError(error)
      if (parsed.code === 'version_conflict') setConflict(true)
      else if (parsed.code === 'invalid_payload') setErrors(parsed.fields)
      else toast.error(t(`forms.errors.${parsed.code ?? 'generic'}`, { defaultValue: t('forms.errors.generic') }))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      className="mx-auto flex min-w-0 max-w-2xl flex-col gap-4 p-4"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <div>
        <h2 className="text-lg font-semibold">{pinned.title}</h2>
        {pinned.description ? <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{pinned.description}</p> : null}
        <p className="mt-1 text-sm text-muted-foreground">{t('forms.record-version', { number: pinned.versionNumber })}</p>
      </div>
      {conflict || newer ? <p className="text-sm text-destructive" role="alert">{t('forms.fill-conflict')}</p> : null}
      {!canCreate ? <p className="text-sm text-muted-foreground">{t('forms.fill-no-create')}</p> : null}
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
      {canCreate ? (
        <Button type="submit" disabled={submitting}>
          {submitting ? t('forms.fill-submitting') : t('forms.fill-submit')}
        </Button>
      ) : null}
    </form>
  )
}

function FillProblem({ error }: { error: unknown }) {
  const { t } = useTranslation()
  const parsed = readFormError(error)
  const code = parsed.code ?? 'not_found'
  return <p className="p-4 text-sm text-muted-foreground">{t(`forms.errors.${code}`, { defaultValue: t('forms.not-found') })}</p>
}
