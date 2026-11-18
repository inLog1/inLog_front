import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Minus, Plus } from 'lucide-react'
import {
  REQUEST_LINE_SAMPLE_MAX,
  useGetRequestLinkedSamplesQuery,
  type RequestLinkedSample,
} from '../../../../entities/request'
import {
  SAMPLE_INSPECTIONS,
  SAMPLE_STAGES,
  buildSampleTree,
  displaySampleInterval,
  displaySampleStage,
  displayWell,
  flattenSampleTree,
  sampleTypeOf,
  useGetSamplesQuery,
  type Sample,
  type SampleInspection,
} from '../../../../entities/sample'
import { useWorkspaceHref } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { useHasOrganizationGrant } from '../../../../features/org-project-selector/model/useWorkspaceSection'
import { routes } from '../../../../shared/lib/routes'
import { Button } from '../../../../shared/ui/button'
import { Checkbox } from '../../../../shared/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../../shared/ui/dialog'
import { Input } from '../../../../shared/ui/input'
import {
  classifyLinkedSample,
  idsOutsideRegistry,
  inspectionWarnings,
  originMismatchIds,
  REGISTRY_MATERIAL_LIMITS_REQUEST_TYPE,
  resolveRequestSample,
  sampleRegistryRequest,
  samplesForRequestWarnings,
  samplesKeptForPicker,
  selectableSampleIds,
  selectionHasLineage,
  toggleFoundSamples,
  toggleSampleId,
  type RequestSampleCard,
  type SamplePickFilters,
  type StudyObjectName,
} from '../model/sample-selection'

const STAGE_KEY: Record<string, string> = {
  'Поступила': 'samples.stage.received',
  'На хранении': 'samples.stage.storage',
  'На исследовании': 'samples.stage.study',
  'Запланирован отбор': 'samples.stage.planned',
  'Утилизирована': 'samples.stage.disposed',
  'Входной контроль': 'samples.stage.intake-legacy',
  'В исследовании': 'samples.stage.study-legacy',
  'Исследование завершено': 'samples.stage.study-done',
  'Передана': 'samples.stage.transferred',
}

const INSPECTION_KEY: Record<SampleInspection, string> = {
  'Не проведён': 'samples.inspection.pending',
  'Соответствует': 'samples.inspection.accepted',
  'С ограничениями': 'samples.inspection.limited',
  'Не соответствует': 'samples.inspection.rejected',
}

const SELECTABLE_STAGES = SAMPLE_STAGES.filter((stage) => stage !== 'Утилизирована')

type RegistryState = {
  records: Sample[]
  available: boolean
  loading: boolean
  failed: boolean
  denied: boolean
  offline: boolean
}

type LinkedState = {
  samples: RequestLinkedSample[]
  enabled: boolean
  loading: boolean
  failed: boolean
}

/**
 * Reads one organization the user can already read.
 * Being a party to the request does not open the other organization's registry.
 * Samples already stored on the request are loaded separately, as a limited projection.
 */
function useRequestSampleRegistry(organizationId: number): RegistryState {
  const canRead = useHasOrganizationGrant('requests', 'read', organizationId)
  const request = sampleRegistryRequest({
    apiMode: import.meta.env.VITE_API_MODE,
    organizationId,
    canRead,
  })
  const query = useGetSamplesQuery(
    request ?? { organizationId, includeDeleted: true },
    { skip: request == null },
  )
  const records = (query.currentData?.samples ?? []).filter((item) => item.organizationId === organizationId)
  return {
    records: request ? records : [],
    available: request != null,
    loading: request != null && query.currentData == null && !query.isError,
    failed: request != null && query.isError,
    denied: import.meta.env.VITE_API_MODE === 'mock' && !canRead,
    offline: import.meta.env.VITE_API_MODE !== 'mock',
  }
}

/**
 * Request-scoped read. The argument is the request id, not a list of sample ids.
 * Skipped outside mock mode and until the request exists.
 */
function useLinkedRequestSamples(organizationId: number, requestId: string | null | undefined): LinkedState {
  const enabled = Boolean(requestId) && import.meta.env.VITE_API_MODE === 'mock'
  const query = useGetRequestLinkedSamplesQuery(
    { organizationId, requestId: requestId ?? '' },
    { skip: !enabled },
  )
  return {
    samples: enabled ? (query.currentData?.samples ?? []) : [],
    enabled,
    loading: enabled && query.currentData == null && !query.isError,
    failed: enabled && query.isError,
  }
}

export function RequestSampleField({
  organizationId,
  requestId = null,
  sampleIds,
  onChange,
  studyObjects,
  labelledBy,
  editable,
}: {
  organizationId: number
  requestId?: string | null
  sampleIds?: readonly string[]
  onChange?: (sampleIds: string[]) => void
  studyObjects: readonly StudyObjectName[]
  labelledBy: string
  editable: boolean
}) {
  const { t } = useTranslation()
  const registry = useRequestSampleRegistry(organizationId)
  const linked = useLinkedRequestSamples(organizationId, requestId)
  const ids = sampleIds ?? []
  const [open, setOpen] = useState(false)
  const [generation, setGeneration] = useState(0)
  const [scope, setScope] = useState(organizationId)
  if (scope !== organizationId) {
    setScope(organizationId)
    setOpen(false)
    setGeneration((value) => value + 1)
  }
  if (!editable && ids.length === 0) return null

  return (
    <section aria-labelledby={labelledBy} className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {editable ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!registry.available || registry.loading || registry.failed}
            onClick={() => {
              setGeneration((value) => value + 1)
              setOpen(true)
            }}
          >
            {ids.length > 0 ? t('requests.registrySamples.change') : t('requests.registrySamples.choose')}
          </Button>
        ) : null}
        <p className="text-sm text-muted-foreground">{t('requests.registrySamples.count', { count: ids.length })}</p>
      </div>
      {editable && !REGISTRY_MATERIAL_LIMITS_REQUEST_TYPE ? (
        <p className="max-w-3xl text-xs text-muted-foreground">{t('requests.registrySamples.material-note')}</p>
      ) : null}
      {registry.offline ? <p className="text-xs text-muted-foreground">{t('requests.registrySamples.offline')}</p> : null}
      {registry.denied ? <p className="text-xs text-muted-foreground">{t('requests.registrySamples.denied')}</p> : null}
      {registry.failed ? <p className="text-xs text-destructive">{t('requests.registrySamples.failed')}</p> : null}
      {registry.loading ? <p className="text-xs text-muted-foreground">{t('requests.registrySamples.loading')}</p> : null}
      <SampleIdList ids={ids} registry={registry} linked={linked} organizationId={organizationId} />
      <SampleWarnings ids={ids} registry={registry} linked={linked} studyObjects={studyObjects} />
      {editable && onChange ? (
        <SamplePickerDialog
          key={generation}
          open={open}
          registry={registry}
          linked={linked}
          savedIds={ids}
          studyObjects={studyObjects}
          organizationId={organizationId}
          onOpenChange={setOpen}
          onConfirm={onChange}
        />
      ) : null}
    </section>
  )
}

function SampleIdList({
  ids,
  registry,
  linked,
  organizationId,
}: {
  ids: readonly string[]
  registry: RegistryState
  linked: LinkedState
  organizationId: number
}) {
  const { t } = useTranslation()
  if (ids.length === 0) return null
  return (
    <ul className="max-w-3xl space-y-2">
      {ids.map((id) => {
        const view = resolveRequestSample(resolveInput(id, organizationId, registry, linked))
        if (view.kind !== 'record') {
          return (
            <li key={id} className="max-w-full break-all text-sm text-muted-foreground">
              {t(`requests.registrySamples.${view.kind}`)}
              {' '}
              <span className="font-mono text-xs">{id}</span>
            </li>
          )
        }
        return (
          <li key={id}>
            <SampleFact card={view.card} />
          </li>
        )
      })}
    </ul>
  )
}

function SampleFact({ card }: { card: RequestSampleCard }) {
  const { t } = useTranslation()
  const href = useWorkspaceHref()
  const code = card.code || card.id
  const origin = [card.field, card.well, card.formation].filter((part) => part.trim()).join(' · ')
  return (
    <div className="min-w-0 flex-1 space-y-1 rounded-md border border-border px-3 py-2 text-sm">
      {card.openable ? (
        <Link
          className="font-medium text-primary underline-offset-4 hover:underline"
          to={href(routes.samples.detail(card.id), 'organization')}
        >
          {code}
        </Link>
      ) : (
        <p className="font-medium text-foreground">{code}</p>
      )}
      {card.externalCode.trim() ? (
        <p className="text-muted-foreground">{t('requests.registrySamples.marking', { value: card.externalCode.trim() })}</p>
      ) : null}
      <Fact label={t('requests.registrySamples.columns.type')} value={card.sampleType || t('requests.registrySamples.empty-value')} />
      <Fact label={t('requests.registrySamples.columns.origin')} value={origin || t('requests.registrySamples.empty-value')} />
      <p>
        <span className="text-muted-foreground">{t('requests.registrySamples.columns.interval')}: </span>
        {card.interval || t('requests.registrySamples.empty-value')}
        {card.intervalInherited ? (
          <span className="mt-1 block text-xs text-muted-foreground">{t('requests.registrySamples.inherited-interval')}</span>
        ) : null}
      </p>
      <Fact label={t('requests.registrySamples.columns.status')} value={stageLabel(t, card.stage)} />
      <p className={inspectionClass(card.inspection)}>
        <span className="text-muted-foreground">{t('requests.registrySamples.columns.inspection')}: </span>
        {t(INSPECTION_KEY[card.inspection])}
      </p>
      {card.deleted ? <p className="text-muted-foreground">{t('requests.registrySamples.deleted', { code })}</p> : null}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-muted-foreground">{label}: </span>
      {value}
    </p>
  )
}

function SampleWarnings({
  ids,
  registry,
  linked,
  studyObjects,
}: {
  ids: readonly string[]
  registry: RegistryState
  linked: LinkedState
  studyObjects: readonly StudyObjectName[]
}) {
  const { t } = useTranslation()
  if (ids.length === 0 || linked.loading) return null
  if (!linked.enabled && (!registry.available || registry.loading || registry.failed)) return null
  if (registry.loading && linked.samples.length === 0) return null
  const records = samplesForRequestWarnings(registry.records, linked.enabled ? linked.samples : [])
  const blocked = ids.filter((id) => classifyLinkedSample(id, records).kind !== 'ready')
  const inspections = inspectionWarnings(ids, records)
  const origins = originMismatchIds(ids, records, studyObjects)
  const lineage = selectionHasLineage(ids, records)
  if (blocked.length === 0 && inspections.length === 0 && origins.length === 0 && !lineage) return null
  return (
    <div role="status" className="max-w-3xl space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
      {blocked.length > 0 ? <p>{t('requests.registrySamples.blocked', { count: blocked.length })}</p> : null}
      {lineage ? <p>{t('requests.registrySamples.lineage')}</p> : null}
      {inspections.map((item) => (
        <p key={item.sampleId}>
          {t(inspectionMessage(item.inspection), { code: item.code })}
          {item.note ? ` ${t('requests.registrySamples.inspection-note', { note: item.note })}` : ''}
        </p>
      ))}
      {origins.map((id) => {
        const state = classifyLinkedSample(id, records)
        const code = state.kind === 'ready' || state.kind === 'disposed' ? state.sample.code : id
        return <p key={id}>{t('requests.registrySamples.origin', { code })}</p>
      })}
    </div>
  )
}

function SamplePickerDialog({
  open,
  registry,
  linked,
  savedIds,
  studyObjects,
  organizationId,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  registry: RegistryState
  linked: LinkedState
  savedIds: readonly string[]
  studyObjects: readonly StudyObjectName[]
  organizationId: number
  onOpenChange: (open: boolean) => void
  onConfirm: (sampleIds: string[]) => void
}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<string[]>(() => [...savedIds])
  const [filters, setFilters] = useState<SamplePickFilters>({ search: '', stage: '', inspection: '' })
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const matchingIds = useMemo(
    () => selectableSampleIds(registry.records, filters),
    [filters, registry.records],
  )
  const rows = useMemo(() => {
    const kept = samplesKeptForPicker(registry.records)
    const matching = kept.filter((sample) => matchingIds.includes(sample.id))
    const tree = buildSampleTree(kept, matching)
    return flattenSampleTree(tree, new Set(), collapsed, true)
  }, [collapsed, matchingIds, registry.records])
  const allFound = matchingIds.length > 0 && matchingIds.every((id) => selected.includes(id))
  const tooMany = selected.length > REQUEST_LINE_SAMPLE_MAX
  const warningRecords = useMemo(
    () => samplesForRequestWarnings(registry.records, linked.enabled && !linked.loading ? linked.samples : []),
    [linked.enabled, linked.loading, linked.samples, registry.records],
  )
  // Rows already stored on the request stay here when they are not in this registry.
  // This dialog does not list the other organization's registry.
  // Choosing a foreign sample that is not already linked needs a separate agreement step.
  const outsideIds = registry.loading
    ? []
    : idsOutsideRegistry(savedIds, registry.records.map((sample) => sample.id))
  const blocked = linked.loading
    ? []
    : selected.filter((id) => classifyLinkedSample(id, warningRecords).kind !== 'ready')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,52rem)] w-[calc(100%-1.5rem)] max-w-6xl flex-col gap-4 overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t('requests.registrySamples.title')}</DialogTitle>
          <DialogDescription>{t('requests.registrySamples.description')}</DialogDescription>
        </DialogHeader>
        {!REGISTRY_MATERIAL_LIMITS_REQUEST_TYPE ? (
          <p className="text-xs text-muted-foreground">{t('requests.registrySamples.material-note')}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Input
            className="min-w-48 flex-1"
            aria-label={t('requests.registrySamples.search')}
            placeholder={t('requests.registrySamples.search-placeholder')}
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          />
          <FilterSelect
            label={t('requests.registrySamples.stage')}
            value={filters.stage}
            emptyLabel={t('requests.registrySamples.stage-all')}
            options={SELECTABLE_STAGES.map((stage) => ({ value: stage, label: t(STAGE_KEY[stage] ?? stage) }))}
            onChange={(stage) => setFilters((current) => ({ ...current, stage }))}
          />
          <FilterSelect
            label={t('requests.registrySamples.inspection')}
            value={filters.inspection}
            emptyLabel={t('requests.registrySamples.inspection-all')}
            options={SAMPLE_INSPECTIONS.map((item) => ({ value: item, label: t(INSPECTION_KEY[item]) }))}
            onChange={(inspection) => setFilters((current) => ({ ...current, inspection }))}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t('requests.registrySamples.hint')}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={registry.loading || registry.failed || matchingIds.length === 0}
            onClick={() => setSelected((current) => toggleFoundSamples(current, matchingIds))}
          >
            {allFound ? t('requests.registrySamples.clear-found') : t('requests.registrySamples.select-all')}
          </Button>
          <span className="text-muted-foreground">
            {registry.loading
              ? t('requests.registrySamples.loading')
              : t('requests.registrySamples.found', { count: matchingIds.length })}
            {' · '}
            {t('requests.registrySamples.chosen', { count: selected.length })}
          </span>
        </div>
        <SampleWarnings ids={selected} registry={registry} linked={linked} studyObjects={studyObjects} />
        {outsideIds.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('requests.registrySamples.linked-heading')}</p>
            <p className="text-xs text-muted-foreground">{t('requests.registrySamples.linked-kept')}</p>
            <ul className="space-y-2">
              {outsideIds.map((id) => {
                const view = resolveRequestSample(resolveInput(id, organizationId, registry, linked))
                const code = view.kind === 'record' ? (view.card.code || id) : id
                return (
                  <li key={id} className="flex items-start gap-2">
                    <Checkbox
                      className="mt-3"
                      aria-label={t('requests.registrySamples.choose-sample', { code })}
                      checked={selected.includes(id)}
                      onCheckedChange={(checked) => setSelected((current) => {
                        const has = current.includes(id)
                        if (checked === true) return has ? current : toggleSampleId(current, id)
                        return has ? toggleSampleId(current, id) : current
                      })}
                    />
                    {view.kind === 'record' ? <SampleFact card={view.card} /> : (
                      <p className="py-2 text-sm text-muted-foreground">
                        {t(`requests.registrySamples.${view.kind}`)}
                        {' '}
                        <span className="font-mono text-xs">{id}</span>
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
        {blocked.length > 0 ? (
          <div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setSelected((current) => current.filter((id) => classifyLinkedSample(id, warningRecords).kind === 'ready'))}
            >
              {t('requests.registrySamples.drop-blocked')}
            </Button>
          </div>
        ) : null}
        {tooMany ? <p role="alert" className="text-sm text-destructive">{t('requests.registrySamples.too-many', { max: REQUEST_LINE_SAMPLE_MAX })}</p> : null}
        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="sticky top-0 bg-muted text-muted-foreground">
              <tr>
                <th className="p-2"><span className="sr-only">{t('requests.registrySamples.choose')}</span></th>
                <th className="p-2">{t('requests.registrySamples.columns.id')}</th>
                <th className="p-2">{t('requests.registrySamples.columns.type')}</th>
                <th className="p-2">{t('requests.registrySamples.columns.origin')}</th>
                <th className="p-2">{t('requests.registrySamples.columns.interval')}</th>
                <th className="p-2">{t('requests.registrySamples.columns.status')}</th>
                <th className="p-2">{t('requests.registrySamples.columns.inspection')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const outside = row.matches && originMismatchIds([row.sample.id], registry.records, studyObjects).length > 0
                return (
                  <tr key={row.sample.id} className={`border-t border-border align-top ${row.depth > 0 ? 'bg-muted/30' : ''} ${row.matches ? '' : 'text-muted-foreground'}`}>
                    <td className="p-2">
                      <Checkbox
                        aria-label={t('requests.registrySamples.choose-sample', { code: row.sample.code })}
                        disabled={!row.matches}
                        checked={selected.includes(row.sample.id)}
                        onCheckedChange={(checked) => setSelected((current) => {
                          const has = current.includes(row.sample.id)
                          if (checked === true) return has ? current : toggleSampleId(current, row.sample.id)
                          return has ? toggleSampleId(current, row.sample.id) : current
                        })}
                      />
                    </td>
                    <td className="p-2 whitespace-nowrap font-medium">
                      <div className="flex items-center gap-1" style={{ paddingLeft: `${Math.min(row.depth, 6) * 16}px` }}>
                        {row.hasChildren ? (
                          <TreeToggle
                            expanded={row.expanded}
                            label={t(row.expanded ? 'requests.registrySamples.collapse' : 'requests.registrySamples.expand', { code: row.sample.code })}
                            onToggle={() => setCollapsed((current) => {
                              const next = new Set(current)
                              if (next.has(row.sample.id)) next.delete(row.sample.id)
                              else next.add(row.sample.id)
                              return next
                            })}
                          />
                        ) : <span className="inline-block size-6 shrink-0" aria-hidden />}
                        <span>
                          {row.sample.code}
                          {!row.matches ? <span className="ml-1 text-xs font-normal">{t('requests.registrySamples.parent-context')}</span> : null}
                          {outside ? <span className="mt-1 block text-xs font-normal text-amber-800 dark:text-amber-200">{t('requests.registrySamples.origin-other')}</span> : null}
                        </span>
                      </div>
                    </td>
                    <td className="p-2">{sampleTypeOf(row.sample)}</td>
                    <td className="max-w-56 p-2">{originText(row.sample) || t('requests.registrySamples.empty-value')}</td>
                    <td className="p-2">
                      {displaySampleInterval(row.sample).value || t('requests.registrySamples.empty-value')}
                      {displaySampleInterval(row.sample).inherited ? (
                        <span className="mt-1 block text-xs text-muted-foreground">{t('requests.registrySamples.inherited-interval')}</span>
                      ) : null}
                    </td>
                    <td className="p-2 whitespace-nowrap">{stageLabel(t, row.sample.stage)}</td>
                    <td className="p-2">
                      <span className={inspectionClass(row.sample.inspection)}>{t(INSPECTION_KEY[row.sample.inspection])}</span>
                      {row.sample.inspectionNote.trim() && row.sample.inspection !== 'Соответствует' ? (
                        <p className="mt-1 max-w-56 whitespace-normal text-xs text-muted-foreground">
                          {t('requests.registrySamples.inspection-note', { note: row.sample.inspectionNote.trim() })}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!registry.loading && !registry.failed && matchingIds.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">{t('requests.registrySamples.none')}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('requests.registrySamples.cancel')}</Button>
          <Button
            type="button"
            disabled={registry.loading || registry.failed || tooMany}
            onClick={() => {
              onConfirm([...selected])
              onOpenChange(false)
            }}
          >
            {t('requests.registrySamples.apply', { count: selected.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FilterSelect({
  label,
  value,
  emptyLabel,
  options,
  onChange,
}: {
  label: string
  value: string
  emptyLabel: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <select
      aria-label={label}
      className="h-9 max-w-full rounded-md border border-input bg-background px-2 text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{emptyLabel}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  )
}

function TreeToggle({ expanded, label, onToggle }: { expanded: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      onClick={onToggle}
      className="flex size-6 shrink-0 items-center justify-center rounded border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {expanded ? <Minus className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
    </button>
  )
}

function resolveInput(sampleId: string, organizationId: number, registry: RegistryState, linked: LinkedState) {
  return {
    sampleId,
    organizationId,
    registryRecords: registry.records,
    registryPending: registry.loading,
    registryFailed: registry.failed,
    registryAvailable: registry.available,
    linkedEnabled: linked.enabled,
    linkedRecords: linked.samples,
    linkedPending: linked.loading,
    linkedFailed: linked.failed,
  }
}

function inspectionMessage(inspection: SampleInspection): string {
  if (inspection === 'С ограничениями') return 'requests.registrySamples.inspection-limited'
  if (inspection === 'Не соответствует') return 'requests.registrySamples.inspection-rejected'
  return 'requests.registrySamples.inspection-pending'
}

function inspectionClass(inspection: SampleInspection): string {
  if (inspection === 'Не соответствует') return 'text-red-700 dark:text-red-300'
  if (inspection === 'Соответствует') return ''
  return 'text-amber-800 dark:text-amber-200'
}

function stageLabel(t: (key: string) => string, stage: Sample['stage'] | undefined): string {
  const shown = displaySampleStage(stage)
  if (!shown) return t('samples.stage.unspecified')
  return t(STAGE_KEY[shown] ?? shown)
}

function originText(sample: Sample): string {
  return [sample.field, displayWell(sample.well), sample.formation].filter((part) => part.trim()).join(' · ')
}
