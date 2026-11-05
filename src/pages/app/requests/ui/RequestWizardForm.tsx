import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import {
  REQUEST_DRAFT_NOTE_MAX,
  REQUEST_DRAFT_TEXT_MAX,
  REQUEST_PRIORITIES,
  REQUEST_PROGRAM_MAX,
  REQUEST_TITLE_MAX,
  newProgramLine,
  type DraftIssue,
  type ExecutorLaboratory,
  type OrganizationKind,
  type RequestCatalog,
  type RequestCatalogOption,
  type RequestCorePlan,
  type RequestDraftDetails,
  type RequestProgramLine,
  type RequestSubject,
} from '../../../../entities/request'
import { cn } from '../../../../shared/lib/utils'
import { Badge } from '../../../../shared/ui/badge'
import { Button } from '../../../../shared/ui/button'
import { Card } from '../../../../shared/ui/card'
import { Checkbox } from '../../../../shared/ui/checkbox'
import { Input } from '../../../../shared/ui/input'
import { Label } from '../../../../shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../shared/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../shared/ui/table'
import { Textarea } from '../../../../shared/ui/textarea'
import { formatRequestDay, requestLabel } from '../model/display'

export const WIZARD_STEPS = ['parties', 'subject', 'program', 'samples', 'review'] as const

export type WizardValues = {
  executorOrganizationId: number | null
  details: RequestDraftDetails
}

const NONE = 'none'

export function RequestWizardForm({
  kind,
  customerName,
  executorName,
  values,
  catalog,
  laboratories,
  laboratoriesLoading,
  issues,
  partyIssue,
  step,
  saving,
  onStep,
  onChange,
  onSave,
}: {
  kind: OrganizationKind
  customerName: string
  executorName: string
  values: WizardValues
  catalog: RequestCatalog
  laboratories: ExecutorLaboratory[]
  laboratoriesLoading: boolean
  issues: DraftIssue[]
  partyIssue: boolean
  step: number
  saving: boolean
  onStep: (step: number) => void
  onChange: (values: WizardValues) => void
  onSave: () => void
}) {
  const { t } = useTranslation()
  const invalid = new Set(issues.map((item) => item.field))
  const codes = [...new Set(issues.map((item) => item.code))]
  const details = values.details
  const patch = (next: Partial<RequestDraftDetails>) => onChange({ ...values, details: { ...details, ...next } })
  const patchSubject = (next: Partial<RequestSubject>) => patch({ subject: { ...details.subject, ...next } })

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t('requests.wizard.steps-label')}>
        <ol className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          {WIZARD_STEPS.map((item, index) => {
            const current = index === step
            return (
              <li key={item}>
                <button
                  type="button"
                  aria-current={current ? 'step' : undefined}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left text-sm shadow-sm',
                    current ? 'border-primary text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => onStep(index)}
                >
                  <span className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                    current ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}>{index + 1}</span>
                  <span className="truncate">{t(`requests.wizard.steps.${item}`)}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      {step === 0 ? (
        <PartiesStep
          kind={kind}
          customerName={customerName}
          executorName={executorName}
          values={values}
          laboratories={laboratories}
          laboratoriesLoading={laboratoriesLoading}
          partyIssue={partyIssue}
          invalid={invalid}
          onExecutor={(executorOrganizationId) => onChange({ ...values, executorOrganizationId })}
          onChange={patch}
        />
      ) : null}
      {step === 1 ? (
        <SubjectStep details={details} catalog={catalog} invalid={invalid} onSubject={patchSubject} />
      ) : null}
      {step === 2 ? (
        <ProgramStep details={details} catalog={catalog} invalid={invalid} onChange={patch} />
      ) : null}
      {step === 3 ? (
        <SamplesStep details={details} catalog={catalog} onChange={patch} />
      ) : null}
      {step === 4 ? (
        <ReviewStep
          customerName={customerName}
          executorName={executorName}
          values={values}
          catalog={catalog}
          laboratories={laboratories}
          onStep={onStep}
        />
      ) : null}

      {partyIssue || codes.length > 0 ? (
        <div role="alert" className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
          {partyIssue ? <p>{t('requests.errors.executor_required')}</p> : null}
          {codes.map((code) => <p key={code}>{t(`requests.errors.${code}`, { defaultValue: t('requests.errors.invalid_draft') })}</p>)}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" disabled={step === 0 || saving} onClick={() => onStep(step - 1)}>
          {t('requests.wizard.back')}
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={step === WIZARD_STEPS.length - 1 ? 'default' : 'outline'} disabled={saving} onClick={onSave}>
            {t('requests.wizard.save')}
          </Button>
          {step < WIZARD_STEPS.length - 1 ? (
            <Button type="button" disabled={saving} onClick={() => onStep(step + 1)}>{t('requests.wizard.next')}</Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function PartiesStep({
  kind,
  customerName,
  executorName,
  values,
  laboratories,
  laboratoriesLoading,
  partyIssue,
  invalid,
  onExecutor,
  onChange,
}: {
  kind: OrganizationKind
  customerName: string
  executorName: string
  values: WizardValues
  laboratories: ExecutorLaboratory[]
  laboratoriesLoading: boolean
  partyIssue: boolean
  invalid: Set<string>
  onExecutor: (id: number | null) => void
  onChange: (next: Partial<RequestDraftDetails>) => void
}) {
  const { t } = useTranslation()
  const details = values.details
  const dash = t('requests.dash')
  const options = values.executorOrganizationId != null && !laboratories.some((item) => item.id === values.executorOrganizationId)
    ? [...laboratories, { id: values.executorOrganizationId, shortName: executorName || dash }]
    : laboratories
  return (
    <Card className="shadow-sm">
      <div className="grid gap-4 p-4 md:grid-cols-2 md:p-6">
        <Field label={t('requests.wizard.customer')}>
          <Input value={requestLabel(customerName, dash)} disabled />
        </Field>
        {kind === 'customer' ? (
          <Field label={t('requests.wizard.executor')}>
            <Select
              value={values.executorOrganizationId == null ? NONE : String(values.executorOrganizationId)}
              onValueChange={(value) => onExecutor(value === NONE ? null : Number(value))}
              disabled={laboratoriesLoading || options.length === 0}
            >
              <SelectTrigger aria-invalid={partyIssue} className="w-full">
                <SelectValue placeholder={laboratoriesLoading ? t('requests.loading') : t('requests.wizard.not-selected')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t('requests.wizard.not-selected')}</SelectItem>
                {options.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>{item.shortName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <Field label={t('requests.wizard.executor')}>
            <Input value={requestLabel(executorName, dash)} disabled />
          </Field>
        )}
        <Field label={t('requests.wizard.project-name')}>
          <Input
            value={details.projectName}
            maxLength={REQUEST_TITLE_MAX}
            aria-invalid={invalid.has('projectName')}
            onChange={(event) => onChange({ projectName: event.target.value })}
          />
        </Field>
        <Field label={t('requests.wizard.contract-number')}>
          <Input
            value={details.contractNumber}
            maxLength={REQUEST_DRAFT_TEXT_MAX}
            aria-invalid={invalid.has('contractNumber')}
            onChange={(event) => onChange({ contractNumber: event.target.value })}
          />
        </Field>
        <Field label={t('requests.wizard.contract-date')}>
          <Input type="date" value={details.contractDate} aria-invalid={invalid.has('contractDate')} onChange={(event) => onChange({ contractDate: event.target.value })} />
        </Field>
        <Field label={t('requests.wizard.contract-until')}>
          <Input type="date" value={details.contractUntil} aria-invalid={invalid.has('contractUntil')} onChange={(event) => onChange({ contractUntil: event.target.value })} />
        </Field>
        <Field label={t('requests.wizard.subsoil-user')}>
          <Input
            value={details.subsoilUser}
            maxLength={REQUEST_DRAFT_TEXT_MAX}
            aria-invalid={invalid.has('subsoilUser')}
            onChange={(event) => onChange({ subsoilUser: event.target.value })}
          />
        </Field>
        <Field label={t('requests.wizard.priority')}>
          <Choice
            value={details.priority}
            invalid={invalid.has('priority')}
            options={REQUEST_PRIORITIES.map((id) => ({ id, label: t(`requests.wizard.priority-${id}`) }))}
            onChange={(priority) => onChange({ priority: priority === 'normal' || priority === 'high' || priority === 'urgent' ? priority : '' })}
          />
        </Field>
        <Field label={t('requests.wizard.planned-completion')}>
          <Input type="date" value={details.plannedCompletion} aria-invalid={invalid.has('plannedCompletion')} onChange={(event) => onChange({ plannedCompletion: event.target.value })} />
        </Field>
        <div className="md:col-span-2">
          <Field label={t('requests.wizard.work-basis')}>
            <Textarea
              value={details.workBasis}
              maxLength={REQUEST_DRAFT_NOTE_MAX}
              aria-invalid={invalid.has('workBasis')}
              onChange={(event) => onChange({ workBasis: event.target.value })}
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label={t('requests.wizard.comment')}>
            <Textarea
              value={details.comment}
              maxLength={REQUEST_DRAFT_NOTE_MAX}
              aria-invalid={invalid.has('comment')}
              onChange={(event) => onChange({ comment: event.target.value })}
            />
          </Field>
        </div>
      </div>
    </Card>
  )
}

function SubjectStep({
  details,
  catalog,
  invalid,
  onSubject,
}: {
  details: RequestDraftDetails
  catalog: RequestCatalog
  invalid: Set<string>
  onSubject: (next: Partial<RequestSubject>) => void
}) {
  const { t } = useTranslation()
  const subject = details.subject
  return (
    <Card className="shadow-sm">
      <div className="grid gap-4 p-4 md:grid-cols-2 md:p-6">
        <Field label={t('requests.wizard.object-kind')}>
          <Choice
            value={subject.objectKind}
            invalid={invalid.has('subject.objectKind')}
            options={[
              { id: 'core', label: t('requests.wizard.kind-core') },
              { id: 'fluid', label: t('requests.wizard.kind-fluid') },
            ]}
            onChange={(objectKind) => onSubject({ objectKind: objectKind === 'core' || objectKind === 'fluid' ? objectKind : '' })}
          />
        </Field>
        <ChoiceField label={t('requests.wizard.field')} value={subject.fieldId} options={catalog.fields} invalid={invalid.has('subject.fieldId')} onChange={(fieldId) => onSubject({ fieldId })} />
        <ChoiceField label={t('requests.wizard.well')} value={subject.wellId} options={catalog.wells} invalid={invalid.has('subject.wellId')} onChange={(wellId) => onSubject({ wellId })} />
        <ChoiceField label={t('requests.wizard.pad')} value={subject.padId} options={catalog.pads} invalid={invalid.has('subject.padId')} onChange={(padId) => onSubject({ padId })} />
        <ChoiceField label={t('requests.wizard.formation')} value={subject.formationId} options={catalog.formations} invalid={invalid.has('subject.formationId')} onChange={(formationId) => onSubject({ formationId })} />
        <Field label={t('requests.wizard.object-number')}>
          <Input
            value={subject.objectNumber}
            maxLength={REQUEST_DRAFT_TEXT_MAX}
            aria-invalid={invalid.has('subject.objectNumber')}
            onChange={(event) => onSubject({ objectNumber: event.target.value })}
          />
        </Field>
        <Field label={t('requests.wizard.delivery-date')}>
          <Input type="date" value={subject.deliveryDate} aria-invalid={invalid.has('subject.deliveryDate')} onChange={(event) => onSubject({ deliveryDate: event.target.value })} />
        </Field>
        {subject.objectKind === 'core' ? (
          <>
            <Field label={t('requests.wizard.diameter')}>
              <Input
                inputMode="decimal"
                value={subject.core.diameterMm}
                aria-invalid={invalid.has('subject.core.diameterMm')}
                onChange={(event) => onSubject({ core: { ...subject.core, diameterMm: event.target.value } })}
              />
            </Field>
            <Field label={t('requests.wizard.recovery')}>
              <Input
                inputMode="decimal"
                value={subject.core.recoveryPercent}
                aria-invalid={invalid.has('subject.core.recoveryPercent')}
                onChange={(event) => onSubject({ core: { ...subject.core, recoveryPercent: event.target.value } })}
              />
            </Field>
            <ChoiceField
              label={t('requests.wizard.core-extra')}
              value={subject.materialId}
              options={catalog.materials}
              invalid={invalid.has('subject.materialId')}
              onChange={(materialId) => onSubject({ materialId })}
            />
          </>
        ) : null}
        {subject.objectKind === 'fluid' ? (
          <>
            <ChoiceField
              label={t('requests.wizard.well-type')}
              value={subject.fluid.wellTypeId}
              options={catalog.wellTypes}
              invalid={invalid.has('subject.fluid.wellTypeId')}
              onChange={(wellTypeId) => onSubject({ fluid: { ...subject.fluid, wellTypeId } })}
            />
            <ChoiceField
              label={t('requests.wizard.sample-kind')}
              value={subject.fluid.sampleKindId}
              options={catalog.sampleKinds}
              invalid={invalid.has('subject.fluid.sampleKindId')}
              onChange={(sampleKindId) => onSubject({ fluid: { ...subject.fluid, sampleKindId } })}
            />
            <ChoiceField
              label={t('requests.wizard.fluid-kind')}
              value={subject.fluid.fluidKindId}
              options={catalog.fluidKinds}
              invalid={invalid.has('subject.fluid.fluidKindId')}
              onChange={(fluidKindId) => onSubject({ fluid: { ...subject.fluid, fluidKindId } })}
            />
            <Field label={t('requests.wizard.sampled-on')}>
              <Input
                type="date"
                value={subject.fluid.sampledOn}
                aria-invalid={invalid.has('subject.fluid.sampledOn')}
                onChange={(event) => onSubject({ fluid: { ...subject.fluid, sampledOn: event.target.value } })}
              />
            </Field>
            <Field label={t('requests.wizard.sample-volume')}>
              <Input
                inputMode="decimal"
                value={subject.fluid.sampleVolumeMl}
                aria-invalid={invalid.has('subject.fluid.sampleVolumeMl')}
                onChange={(event) => onSubject({ fluid: { ...subject.fluid, sampleVolumeMl: event.target.value } })}
              />
            </Field>
            {catalog.fluidKinds.map((item) => (
              <Field key={item.id} label={t('requests.wizard.sample-count', { kind: t(`requests.catalog.${item.id}`, { defaultValue: item.label }) })}>
                <Input
                  inputMode="decimal"
                  value={subject.fluid.sampleCounts.find((count) => count.fluidKindId === item.id)?.count ?? ''}
                  aria-invalid={invalid.has('subject.fluid.sampleCounts')}
                  onChange={(event) => onSubject({
                    fluid: {
                      ...subject.fluid,
                      sampleCounts: catalog.fluidKinds.map((kind) => ({
                        fluidKindId: kind.id,
                        count: kind.id === item.id
                          ? event.target.value
                          : (subject.fluid.sampleCounts.find((count) => count.fluidKindId === kind.id)?.count ?? ''),
                      })),
                    },
                  })}
                />
              </Field>
            ))}
          </>
        ) : null}
        <div className="md:col-span-2">
          <Field label={t('requests.wizard.subject-note')}>
            <Textarea
              value={subject.note}
              maxLength={REQUEST_DRAFT_NOTE_MAX}
              aria-invalid={invalid.has('subject.note')}
              onChange={(event) => onSubject({ note: event.target.value })}
            />
          </Field>
        </div>
        </div>
      </Card>
  )
}

function ProgramStep({
  details,
  catalog,
  invalid,
  onChange,
}: {
  details: RequestDraftDetails
  catalog: RequestCatalog
  invalid: Set<string>
  onChange: (next: Partial<RequestDraftDetails>) => void
}) {
  const { t } = useTranslation()
  const update = (id: string, patch: Partial<RequestProgramLine>) => {
    onChange({
      program: details.program.map((line) => line.id === id ? { ...line, ...patch } : line),
    })
  }
  const patchPlan = (next: Partial<RequestCorePlan>) => onChange({ corePlan: { ...details.corePlan, ...next } })
  return (
    <div className="flex flex-col gap-4">
      {details.subject.objectKind === 'core' ? (
        <Card className="shadow-sm">
          <div className="border-b border-border px-4 py-3 md:px-6">
            <h2 className="text-sm font-semibold text-foreground">{t('requests.wizard.core-plan')}</h2>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-2 md:p-6">
            <PlanField label={t('requests.wizard.plan-total')} value={details.corePlan.totalRecovery} invalid={invalid.has('corePlan.totalRecovery')} onChange={(totalRecovery) => patchPlan({ totalRecovery })} />
            <PlanField label={t('requests.wizard.plan-consolidated')} value={details.corePlan.consolidated} invalid={invalid.has('corePlan.consolidated')} onChange={(consolidated) => patchPlan({ consolidated })} />
            <PlanField label={t('requests.wizard.plan-unconsolidated')} value={details.corePlan.unconsolidated} invalid={invalid.has('corePlan.unconsolidated')} onChange={(unconsolidated) => patchPlan({ unconsolidated })} />
            <PlanField label={t('requests.wizard.plan-jurassic')} value={details.corePlan.jurassic} invalid={invalid.has('corePlan.jurassic')} onChange={(jurassic) => patchPlan({ jurassic })} />
            <PlanField label={t('requests.wizard.plan-wells')} value={details.corePlan.wellCount} invalid={invalid.has('corePlan.wellCount')} onChange={(wellCount) => patchPlan({ wellCount })} />
            <PlanField label={t('requests.wizard.plan-cylinders')} value={details.corePlan.cylinderYield} invalid={invalid.has('corePlan.cylinderYield')} onChange={(cylinderYield) => patchPlan({ cylinderYield })} />
            <PlanField label={t('requests.wizard.plan-sections')} value={details.corePlan.thinSectionsPerMeter} invalid={invalid.has('corePlan.thinSectionsPerMeter')} onChange={(thinSectionsPerMeter) => patchPlan({ thinSectionsPerMeter })} />
            <Field label={t('requests.wizard.plan-due')}>
              <Input type="date" value={details.corePlan.programDue} aria-invalid={invalid.has('corePlan.programDue')} onChange={(event) => patchPlan({ programDue: event.target.value })} />
            </Field>
          </div>
        </Card>
      ) : null}
    <Card className="min-w-0 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border p-4">
        <p className="text-sm text-muted-foreground">{t('requests.wizard.program-lead')}</p>
        <Button
          type="button"
          variant="outline"
          disabled={details.program.length >= REQUEST_PROGRAM_MAX}
          onClick={() => onChange({ program: [...details.program, newProgramLine()] })}
        >
          <Plus aria-hidden />
          {t('requests.wizard.add-line')}
        </Button>
      </div>
      {details.program.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{t('requests.wizard.program-empty')}</p>
      ) : (
        <Table className="min-w-[76rem]">
          <TableHeader>
            <TableRow>
              <TableHead className="px-4 py-3">{t('requests.wizard.work-kind')}</TableHead>
              <TableHead className="px-4 py-3">{t('requests.wizard.unit')}</TableHead>
              <TableHead className="px-4 py-3">{t('requests.wizard.quantity')}</TableHead>
              <TableHead className="px-4 py-3">{t('requests.wizard.demand')}</TableHead>
              <TableHead className="px-4 py-3">{t('requests.wizard.curator')}</TableHead>
              <TableHead className="px-4 py-3">{t('requests.wizard.line-due')}</TableHead>
              <TableHead className="px-4 py-3">{t('requests.wizard.line-code')}</TableHead>
              <TableHead className="px-4 py-3"><span className="sr-only">{t('requests.wizard.remove-line')}</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {details.program.map((line, index) => (
              <TableRow key={line.id}>
                <TableCell className="px-4 align-top">
                  <Choice
                    value={line.workKindId}
                    invalid={invalid.has(`program.${index}.workKindId`)}
                    options={catalog.workKinds}
                    onChange={(workKindId) => update(line.id, { workKindId })}
                  />
                </TableCell>
                <TableCell className="px-4 align-top">
                  <Choice
                    value={line.unitId}
                    invalid={invalid.has(`program.${index}.unitId`)}
                    options={catalog.units}
                    onChange={(unitId) => update(line.id, { unitId })}
                  />
                </TableCell>
                <TableCell className="px-4 py-3 align-top">
                  <Input
                    inputMode="decimal"
                    value={line.quantity}
                    aria-invalid={invalid.has(`program.${index}.quantity`)}
                    onChange={(event) => update(line.id, { quantity: event.target.value })}
                  />
                </TableCell>
                <TableCell className="px-4 py-3 align-top">
                  <Input
                    inputMode="decimal"
                    value={line.demand}
                    aria-invalid={invalid.has(`program.${index}.demand`)}
                    onChange={(event) => update(line.id, { demand: event.target.value })}
                  />
                </TableCell>
                <TableCell className="px-4 py-3 align-top">
                  <Choice
                    value={line.curatorId}
                    invalid={invalid.has(`program.${index}.curatorId`)}
                    options={catalog.curators}
                    onChange={(curatorId) => update(line.id, { curatorId })}
                  />
                </TableCell>
                <TableCell className="px-4 py-3 align-top">
                  <Input type="date" value={line.dueDate} aria-invalid={invalid.has(`program.${index}.dueDate`)} onChange={(event) => update(line.id, { dueDate: event.target.value })} />
                </TableCell>
                <TableCell className="px-4 py-3 align-top">
                  <Input
                    value={line.code}
                    maxLength={REQUEST_DRAFT_TEXT_MAX}
                    aria-invalid={invalid.has(`program.${index}.code`)}
                    onChange={(event) => update(line.id, { code: event.target.value })}
                  />
                </TableCell>
                <TableCell className="px-4 align-top">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('requests.wizard.remove-line')}
                    onClick={() => onChange({ program: details.program.filter((item) => item.id !== line.id) })}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
    </div>
  )
}

function PlanField({
  label,
  value,
  invalid,
  onChange,
}: {
  label: string
  value: string
  invalid: boolean
  onChange: (value: string) => void
}) {
  return (
    <Field label={label}>
      <Input inputMode="decimal" value={value} aria-invalid={invalid} onChange={(event) => onChange(event.target.value)} />
    </Field>
  )
}

function SamplesStep({
  details,
  catalog,
  onChange,
}: {
  details: RequestDraftDetails
  catalog: RequestCatalog
  onChange: (next: Partial<RequestDraftDetails>) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const needle = query.trim().toLocaleLowerCase('ru')
  const rows = catalog.samples.filter((item) => {
    if (!needle) return true
    return [item.number, item.geologicalNumber, item.interval, t(`requests.catalog.sample-kind.${item.sampleKind}`)].join(' ').toLocaleLowerCase('ru').includes(needle)
  })
  const selected = new Set(details.sampleIds)
  const toggle = (id: string, checked: boolean) => {
    const sampleIds = checked
      ? [...details.sampleIds, id]
      : details.sampleIds.filter((item) => item !== id)
    onChange({ sampleIds })
  }
  return (
    <Card className="min-w-0 overflow-hidden shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('requests.search')}
          aria-label={t('requests.wizard.sample-search')}
          className="sm:max-w-xs"
        />
        <p className="text-sm text-muted-foreground">{t('requests.wizard.samples-selected', { count: details.sampleIds.length })}</p>
      </div>
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{t('requests.wizard.samples-empty')}</p>
      ) : (
        <Table className="min-w-[52rem]">
          <TableHeader>
            <TableRow>
              <TableHead className="px-4"><span className="sr-only">{t('requests.wizard.sample-pick')}</span></TableHead>
              <TableHead className="px-4">{t('requests.wizard.sample-number')}</TableHead>
              <TableHead className="px-4">{t('requests.wizard.sample-geological')}</TableHead>
              <TableHead className="px-4">{t('requests.wizard.sample-interval')}</TableHead>
              <TableHead className="px-4">{t('requests.wizard.sample-type')}</TableHead>
              <TableHead className="px-4">{t('requests.wizard.sample-geometry')}</TableHead>
              <TableHead className="px-4">{t('requests.wizard.sample-remainder')}</TableHead>
              <TableHead className="px-4">{t('requests.wizard.sample-availability')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item) => {
              const checked = selected.has(item.id)
              const blocked = item.availability !== 'available'
              return (
                <TableRow key={item.id}>
                  <TableCell className="px-4">
                    <Checkbox
                      checked={checked}
                      disabled={blocked && !checked}
                      aria-label={t('requests.wizard.sample-toggle', { number: item.number })}
                      onCheckedChange={(value) => {
                        if (value === true && blocked) return
                        toggle(item.id, value === true)
                      }}
                    />
                  </TableCell>
                  <TableCell className="px-4 font-medium">{item.number}</TableCell>
                  <TableCell className="px-4">{item.geologicalNumber}</TableCell>
                  <TableCell className="px-4">{item.interval}</TableCell>
                  <TableCell className="px-4">{t(`requests.catalog.sample-kind.${item.sampleKind}`)}</TableCell>
                  <TableCell className="px-4">{t(`requests.catalog.geometry.${item.geometry}`)}</TableCell>
                  <TableCell className="px-4">{item.remainder}</TableCell>
                  <TableCell className="px-4">
                    <Badge variant={item.availability === 'available' ? 'default' : 'secondary'}>
                      {t(`requests.catalog.availability.${item.availability}`)}
                    </Badge>
                    {blocked ? (
                      <p className="mt-1 max-w-48 text-xs text-muted-foreground">{t(`requests.wizard.sample-reason.${item.availability}`)}</p>
                    ) : null}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}

function ReviewStep({
  customerName,
  executorName,
  values,
  catalog,
  laboratories,
  onStep,
}: {
  customerName: string
  executorName: string
  values: WizardValues
  catalog: RequestCatalog
  laboratories: ExecutorLaboratory[]
  onStep: (step: number) => void
}) {
  const { t, i18n } = useTranslation()
  const dash = t('requests.dash')
  const details = values.details
  const executor = laboratories.find((item) => item.id === values.executorOrganizationId)?.shortName || executorName
  const day = (value: string) => requestLabel(formatRequestDay(value, i18n.language), dash)
  const option = (options: readonly RequestCatalogOption[], id: string) => {
    if (!id) return dash
    const found = options.find((item) => item.id === id)
    return found ? t(`requests.catalog.${found.id}`, { defaultValue: found.label }) : id
  }
  const subject = details.subject
  const samples = catalog.samples.filter((item) => details.sampleIds.includes(item.id))
  return (
    <div className="grid gap-4">
      <ReviewCard title={t('requests.wizard.steps.parties')} onEdit={() => onStep(0)} editLabel={t('requests.wizard.edit-step')}>
        <ReviewRow label={t('requests.wizard.customer')} value={requestLabel(customerName, dash)} />
        <ReviewRow label={t('requests.wizard.executor')} value={requestLabel(executor, dash)} />
        <ReviewRow label={t('requests.wizard.project-name')} value={requestLabel(details.projectName, dash)} />
        <ReviewRow label={t('requests.wizard.contract-number')} value={requestLabel(details.contractNumber, dash)} />
        <ReviewRow label={t('requests.wizard.contract-date')} value={day(details.contractDate)} />
        <ReviewRow label={t('requests.wizard.contract-until')} value={day(details.contractUntil)} />
        <ReviewRow label={t('requests.wizard.subsoil-user')} value={requestLabel(details.subsoilUser, dash)} />
        <ReviewRow label={t('requests.wizard.work-basis')} value={requestLabel(details.workBasis, dash)} />
        <ReviewRow label={t('requests.wizard.priority')} value={details.priority ? t(`requests.wizard.priority-${details.priority}`) : dash} />
        <ReviewRow label={t('requests.wizard.planned-completion')} value={day(details.plannedCompletion)} />
        <ReviewRow label={t('requests.wizard.comment')} value={requestLabel(details.comment, dash)} />
      </ReviewCard>
      <ReviewCard title={t('requests.wizard.steps.subject')} onEdit={() => onStep(1)} editLabel={t('requests.wizard.edit-step')}>
        <ReviewRow label={t('requests.wizard.object-kind')} value={subject.objectKind ? t(`requests.wizard.kind-${subject.objectKind}`) : dash} />
        <ReviewRow label={t('requests.wizard.field')} value={option(catalog.fields, subject.fieldId)} />
        <ReviewRow label={t('requests.wizard.well')} value={option(catalog.wells, subject.wellId)} />
        <ReviewRow label={t('requests.wizard.pad')} value={option(catalog.pads, subject.padId)} />
        <ReviewRow label={t('requests.wizard.formation')} value={option(catalog.formations, subject.formationId)} />
        <ReviewRow label={t('requests.wizard.object-number')} value={requestLabel(subject.objectNumber, dash)} />
        <ReviewRow label={t('requests.wizard.delivery-date')} value={day(subject.deliveryDate)} />
        {subject.objectKind === 'core' ? (
          <>
            <ReviewRow label={t('requests.wizard.diameter')} value={requestLabel(subject.core.diameterMm, dash)} />
            <ReviewRow label={t('requests.wizard.recovery')} value={requestLabel(subject.core.recoveryPercent, dash)} />
            <ReviewRow label={t('requests.wizard.core-extra')} value={option(catalog.materials, subject.materialId)} />
          </>
        ) : null}
        {subject.objectKind === 'fluid' ? (
          <>
            <ReviewRow label={t('requests.wizard.well-type')} value={option(catalog.wellTypes, subject.fluid.wellTypeId)} />
            <ReviewRow label={t('requests.wizard.sample-kind')} value={option(catalog.sampleKinds, subject.fluid.sampleKindId)} />
            <ReviewRow label={t('requests.wizard.fluid-kind')} value={option(catalog.fluidKinds, subject.fluid.fluidKindId)} />
            <ReviewRow label={t('requests.wizard.sampled-on')} value={day(subject.fluid.sampledOn)} />
            <ReviewRow label={t('requests.wizard.sample-volume')} value={requestLabel(subject.fluid.sampleVolumeMl, dash)} />
            {catalog.fluidKinds.map((item) => (
              <ReviewRow
                key={item.id}
                label={t('requests.wizard.sample-count', { kind: t(`requests.catalog.${item.id}`, { defaultValue: item.label }) })}
                value={requestLabel(subject.fluid.sampleCounts.find((count) => count.fluidKindId === item.id)?.count ?? '', dash)}
              />
            ))}
          </>
        ) : null}
        <ReviewRow label={t('requests.wizard.subject-note')} value={requestLabel(subject.note, dash)} />
      </ReviewCard>
      <ReviewCard title={t('requests.wizard.steps.program')} onEdit={() => onStep(2)} editLabel={t('requests.wizard.edit-step')} layout="stack">
        {subject.objectKind === 'core' ? (
          <div className="mb-4 grid gap-3 border-b border-border pb-4 md:grid-cols-2">
            <ReviewRow label={t('requests.wizard.plan-total')} value={requestLabel(details.corePlan.totalRecovery, dash)} />
            <ReviewRow label={t('requests.wizard.plan-consolidated')} value={requestLabel(details.corePlan.consolidated, dash)} />
            <ReviewRow label={t('requests.wizard.plan-unconsolidated')} value={requestLabel(details.corePlan.unconsolidated, dash)} />
            <ReviewRow label={t('requests.wizard.plan-jurassic')} value={requestLabel(details.corePlan.jurassic, dash)} />
            <ReviewRow label={t('requests.wizard.plan-wells')} value={requestLabel(details.corePlan.wellCount, dash)} />
            <ReviewRow label={t('requests.wizard.plan-cylinders')} value={requestLabel(details.corePlan.cylinderYield, dash)} />
            <ReviewRow label={t('requests.wizard.plan-sections')} value={requestLabel(details.corePlan.thinSectionsPerMeter, dash)} />
            <ReviewRow label={t('requests.wizard.plan-due')} value={day(details.corePlan.programDue)} />
          </div>
        ) : null}
        {details.program.length === 0 ? <p className="text-sm text-muted-foreground">{dash}</p> : (
          <Table className="min-w-[52rem]">
            <TableHeader>
              <TableRow>
                <TableHead className="px-2">{t('requests.wizard.work-kind')}</TableHead>
                <TableHead className="px-2">{t('requests.wizard.unit')}</TableHead>
                <TableHead className="px-2">{t('requests.wizard.quantity')}</TableHead>
                <TableHead className="px-2">{t('requests.wizard.demand')}</TableHead>
                <TableHead className="px-2">{t('requests.wizard.curator')}</TableHead>
                <TableHead className="px-2">{t('requests.wizard.line-due')}</TableHead>
                <TableHead className="px-2">{t('requests.wizard.line-code')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.program.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="px-2">{option(catalog.workKinds, line.workKindId)}</TableCell>
                  <TableCell className="px-2">{option(catalog.units, line.unitId)}</TableCell>
                  <TableCell className="px-2">{requestLabel(line.quantity, dash)}</TableCell>
                  <TableCell className="px-2">{requestLabel(line.demand, dash)}</TableCell>
                  <TableCell className="px-2">{option(catalog.curators, line.curatorId)}</TableCell>
                  <TableCell className="px-2">{day(line.dueDate)}</TableCell>
                  <TableCell className="px-2">{requestLabel(line.code, dash)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ReviewCard>
      <ReviewCard title={t('requests.wizard.steps.samples')} onEdit={() => onStep(3)} editLabel={t('requests.wizard.edit-step')} layout="stack">
        {samples.length === 0 ? <p className="text-sm text-muted-foreground">{dash}</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-2">{t('requests.wizard.sample-number')}</TableHead>
                <TableHead className="px-2">{t('requests.wizard.sample-geological')}</TableHead>
                <TableHead className="px-2">{t('requests.wizard.sample-interval')}</TableHead>
                <TableHead className="px-2">{t('requests.wizard.sample-type')}</TableHead>
                <TableHead className="px-2">{t('requests.wizard.sample-geometry')}</TableHead>
                <TableHead className="px-2">{t('requests.wizard.sample-remainder')}</TableHead>
                <TableHead className="px-2">{t('requests.wizard.sample-availability')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {samples.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="px-2">{item.number}</TableCell>
                  <TableCell className="px-2">{item.geologicalNumber}</TableCell>
                  <TableCell className="px-2">{item.interval}</TableCell>
                  <TableCell className="px-2">{t(`requests.catalog.sample-kind.${item.sampleKind}`)}</TableCell>
                  <TableCell className="px-2">{t(`requests.catalog.geometry.${item.geometry}`)}</TableCell>
                  <TableCell className="px-2">{item.remainder}</TableCell>
                  <TableCell className="px-2">{t(`requests.catalog.availability.${item.availability}`)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ReviewCard>
      <ReviewCard title={t('requests.wizard.route-title')} layout="stack">
        <p className="text-sm text-foreground">{t('requests.wizard.route-steps')}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t('requests.wizard.route-note')}</p>
      </ReviewCard>
    </div>
  )
}

function ReviewCard({
  title,
  editLabel,
  onEdit,
  layout = 'grid',
  children,
}: {
  title: string
  editLabel?: string
  onEdit?: () => void
  layout?: 'grid' | 'stack'
  children: ReactNode
}) {
  return (
    <Card className="min-w-0 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {onEdit ? <Button type="button" variant="ghost" onClick={onEdit}>{editLabel}</Button> : null}
      </div>
      <div className={layout === 'grid' ? 'grid gap-3 p-4 md:grid-cols-2 md:p-6' : 'p-4 md:p-6'}>{children}</div>
    </Card>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{value}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function ChoiceField({
  label,
  value,
  options,
  invalid,
  onChange,
}: {
  label: string
  value: string
  options: readonly RequestCatalogOption[]
  invalid: boolean
  onChange: (value: string) => void
}) {
  return (
    <Field label={label}>
      <Choice value={value} options={options} invalid={invalid} onChange={onChange} />
    </Field>
  )
}

function Choice({
  value,
  options,
  invalid,
  onChange,
}: {
  value: string
  options: readonly RequestCatalogOption[]
  invalid: boolean
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  return (
    <Select value={value || NONE} onValueChange={(next) => onChange(next === NONE ? '' : next)}>
      <SelectTrigger aria-invalid={invalid} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{t('requests.wizard.not-selected')}</SelectItem>
        {options.map((item) => (
          <SelectItem key={item.id} value={item.id}>{t(`requests.catalog.${item.id}`, { defaultValue: item.label })}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
