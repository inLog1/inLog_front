import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, FileSpreadsheet, PenLine, Plus, Search, Settings2, Trash2, X } from 'lucide-react'
import { useSelector } from 'react-redux'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { selectUserFullName } from '../../../entities/user/model/selectors'
import { selectSession } from '../../../entities/session'
import { toast } from 'sonner'
import { ensureMockState, updateMockState } from '../../../app/mocks/db/repository'
import type { MockState } from '../../../app/mocks/db/types'
import { WorkspaceStatus } from '../../../features/org-project-selector'
import { useWorkspaceHref } from '../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { useHasOrganizationGrant, useWorkspaceSection } from '../../../features/org-project-selector/model/useWorkspaceSection'
import { documentMockNamespace, documentScenario } from '../../../shared/config/mock-scenario'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { routes } from '../../../shared/lib/routes'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { PageHeader, WorkPage } from '../../../shared/ui/page'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../shared/ui/table'
import { deleteSample, displaySampleStage, displayWell, formatDate, inheritedSampleOrigin, initialSamples, migrateDemoSampleIds, SAMPLE_STAGES, SAMPLE_TYPES, sampleTypeOf, withDetailedDemoSamples, type CurrentSampleStage, type Inspection, type Sample, type SampleStage, type SampleType } from './model'
import { mayDeleteSample } from './access'
import { BatchImport } from './BatchImport'
import { SampleAttachments } from './SampleAttachments'
import { filterSamples } from './filters'
import { registerWithDocuments, updateSampleControl, type RegistrationDocuments, type SampleAttachment } from './attachments'
import { emptyDocumentDraft, prepareDocuments } from './documentDraft'
import { RegistrationDocumentsField } from './RegistrationDocuments'
import { findSafeDuplicateIds, removeSafeDuplicates } from './duplicates'
import { buildSampleTree, flattenSampleTree } from './sampleTree'
import { SampleTreeToggle } from './SampleTreeToggle'
import { DraftSection } from '../requests/ui/draft/draft-ui'

const selectStyle = 'h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground'
const labelStyle = 'grid gap-1.5 text-sm font-medium'
const PAGE_SIZES = [15, 25, 35] as const
const decisions: Inspection[] = ['Не проведён', 'Соответствует', 'С ограничениями', 'Не соответствует']
const now = () => new Date().toISOString()
const localDate = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const baseline = () => initialSamples(documentScenario() === 'demo')

export function SamplesPage({ mode = 'list' }: { mode?: 'list' | 'new' | 'detail' }) {
  const { sampleId = '' } = useParams()
  const section = useWorkspaceSection('organization', { resource: 'requests', action: mode === 'new' ? 'create' : 'read' })
  if (section.kind !== 'ready') return <WorkspaceStatus status={section.status} reason={section.reason} onRetry={section.refetch} />
  return <SamplesDesk key={`${section.organizationId}:${mode}:${sampleId}`} organizationId={section.organizationId} mode={mode} sampleId={sampleId} />
}

function SamplesDesk({ organizationId, mode, sampleId }: { organizationId: number; mode: 'list' | 'new' | 'detail'; sampleId: string }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialParentId = searchParams.get('parent') ?? ''
  const href = useWorkspaceHref()
  const listHref = href(routes.samples.list(), 'organization')
  const actor = useSelector(selectUserFullName)
  const { subjectId } = useSelector(selectSession)
  const canCreate = useHasOrganizationGrant('requests', 'create', organizationId)
  const canUpdate = useHasOrganizationGrant('requests', 'update', organizationId)
  const [all, setAll] = useState<Sample[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('Все типы проб')
  const [inspection, setInspection] = useState('Все заключения контроля')
  const [stage, setStage] = useState('Все статусы проб')
  const [parentCodeInput, setParentCodeInput] = useState<string | null>(null)
  const [registrationStage, setRegistrationStage] = useState<CurrentSampleStage>('Поступила')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0])
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [creating, setCreating] = useState(() => mode === 'new' && Boolean(initialParentId))
  const [registeredCount, setRegisteredCount] = useState(0)
  const [importing, setImporting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [canDelete, setCanDelete] = useState(false)
  const [demoSuperadmin, setDemoSuperadmin] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [documents, setDocuments] = useState(emptyDocumentDraft)
  const [documentKey, setDocumentKey] = useState(0)
  const [readingDocuments, setReadingDocuments] = useState(false)
  const [availableDocuments, setAvailableDocuments] = useState<SampleAttachment[]>([])
  const [duplicateIds, setDuplicateIds] = useState<string[]>([])
  const [confirmDuplicates, setConfirmDuplicates] = useState(false)
  useEffect(() => {
    let active = true
    void ensureMockState(documentMockNamespace()).then(async (result) => {
      if (!active) return
      if (!result.ok) { setFailed(true); return }
      setAvailableDocuments((result.state.sampleAttachments ?? []).filter(file => file.organizationId === organizationId))
      setCanDelete(mayDeleteSample(result.state, subjectId, organizationId))
      const demo = documentScenario() === 'demo'
      setDemoSuperadmin(demo && result.state.systemCapabilities.some(capability => capability.userId === subjectId && capability.code === 'corporate_superadmin'))
      let loadedState = result.state
      let records = withDetailedDemoSamples(loadedState.samples ?? baseline(), demo)
      if (demo && migrateDemoSampleIds(records, result.state.sampleIdCounters ?? {}).changed) {
        const next = await updateMockState(state => {
          const current = withDetailedDemoSamples(state.samples ?? baseline(), true)
          const migrated = migrateDemoSampleIds(current, state.sampleIdCounters ?? {})
          return {...state, samples:migrated.records, sampleIdCounters:migrated.counters}
        }, documentMockNamespace())
        records = next.samples ?? []
        loadedState = next
      }
      if (active) { setAll(records); setDuplicateIds(findSafeDuplicateIds({...loadedState, samples:records}, organizationId)) }
    }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [subjectId, organizationId, sampleId])
  const samples = useMemo(() => (all ?? []).filter((item) => item.organizationId === organizationId && !item.deletedAt), [all, organizationId])
  const { filtered, counts } = useMemo(() => filterSamples(samples, {search, kind, stage, inspection}), [samples, search, kind, stage, inspection])
  const filtersActive = search.trim() !== '' || kind !== 'Все типы проб' || inspection !== 'Все заключения контроля' || stage !== 'Все статусы проб'
  const ordered = useMemo(() => filterSamples(samples, {search:'', kind:'Все типы проб', stage:'Все статусы проб', inspection:'Все заключения контроля'}).filtered, [samples])
  const roots = useMemo(() => buildSampleTree(ordered, filtered), [ordered, filtered])
  const pages = Math.max(1, Math.ceil(roots.length / pageSize))
  const activePage = Math.min(page, pages)
  const first = (activePage - 1) * pageSize
  const visibleRows = flattenSampleTree(roots.slice(first, first + pageSize), expanded, collapsed, true)
  function toggleTree(id:string, isOpen:boolean) {
    setExpanded(previous => { const next = new Set(previous); if (isOpen) next.delete(id); else next.add(id); return next })
    setCollapsed(previous => { const next = new Set(previous); if (isOpen) next.add(id); else next.delete(id); return next })
  }
  function resetFilters() { setSearch(''); setKind('Все типы проб'); setInspection('Все заключения контроля'); setStage('Все статусы проб'); setPage(1) }
  function selectInspection(value: string) { setInspection(value); setPage(1) }

  const legacyStages = [...new Set(samples.map(item => displaySampleStage(item.stage)).filter((value): value is SampleStage => value != null && !(SAMPLE_STAGES as readonly string[]).includes(value)))]
  function openSample(id: string) { navigate(href(routes.samples.detail(id), 'organization')) }
  const sample = samples.find((item) => item.id === sampleId)
  const initialParent = samples.find(item => item.id === initialParentId && displaySampleStage(item.stage) !== 'Утилизирована')
  const parentCodeValue = parentCodeInput ?? initialParent?.code ?? ''
  const selectedParent = samples.find(item => item.code.toLocaleLowerCase('ru') === parentCodeValue.trim().toLocaleLowerCase('ru') && displaySampleStage(item.stage) !== 'Утилизирована')
  async function save(change: (state: MockState) => MockState) {
    setBusy(true)
    try {
      const next = await updateMockState((state) => change({ ...state, samples: withDetailedDemoSamples(state.samples ?? baseline(), documentScenario() === 'demo') }), documentMockNamespace())
      setAll(next.samples ?? [])
      setDuplicateIds(findSafeDuplicateIds(next, organizationId))
      setAvailableDocuments((next.sampleAttachments ?? []).filter(file => file.organizationId === organizationId))
      return true
    } catch (error) {
      const code = error instanceof Error ? error.message : ''
      toast.error(code === 'duplicate' ? 'Проба с таким ID уже существует в организации' : code === 'duplicate-sample' ? 'Такая проба с той же исходной маркировкой и данными уже есть в реестре или повторяется в партии.' : code === 'invalid-parent-type' ? 'У родительской пробы не указан тип.' : code === 'invalid-parent' ? 'Родительская проба недоступна или утилизирована. Обновите страницу и выберите другую пробу.' : code === 'required' ? 'Заполните обязательные поля' : code === 'forbidden' ? 'Нет прав на регистрацию проб.' : code === 'missing-sample' ? 'Проба больше недоступна. Обновите страницу.' : code === 'missing-file' ? 'Выбранный документ больше недоступен. Обновите страницу.' : ['invalid-file','file-size','total-size','file-count'].includes(code) ? 'Проверьте формат и размер выбранных документов.' : 'Не удалось сохранить данные. Проверьте доступность записи в тестовую базу.')
      return false
    } finally { setBusy(false) }
  }
  function register(items: Sample[], attached?: RegistrationDocuments) {
    return save(state => registerWithDocuments(state, {organizationId, userId:subjectId, actor, at:now()}, items, attached))
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || readingDocuments) return
    const form = event.currentTarget
    const addAnother = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'continue'
    const data = new FormData(form)
    const get = (key: string) => String(data.get(key) ?? '').trim()
    const externalCode = get('externalCode') || undefined
    const parentCode = get('parentCode')
    const parent = parentCode ? samples.find(record => record.code.toLocaleLowerCase('ru') === parentCode.toLocaleLowerCase('ru') && displaySampleStage(record.stage) !== 'Утилизирована') : undefined
    if (parentCode && !parent) { toast.error('Выберите действующую родительскую пробу из реестра текущей организации.'); return }
    const resolvedType = parent ? sampleTypeOf(parent) : get('sampleType')
    if (resolvedType === 'Не указан') { toast.error('У родительской пробы не указан тип.'); return }
    const sampleType = resolvedType as SampleType
    const planned = registrationStage === 'Запланирован отбор'
    const item: Sample = { id: crypto.randomUUID(), organizationId, code:'', externalCode, ...(parent ? {parentId:parent.id} : {}), sampleType, kind: sampleType === 'Керн' ? 'Керн' : 'Флюид', material:get('material') || sampleType, field:get('field'), well:displayWell(get('well')), formation:get('formation'), interval:get('interval'), ...(parent && get('subsampleInterval') ? {subsampleInterval:get('subsampleInterval')} : {}), collectedAt:get('collectedAt'), receivedAt:get('receivedAt'), container:get('container'), quantity:get('quantity'), supplier:get('supplier'), document:get('document'), conditions:get('conditions'), location:locationFromForm(data), inspection:'Не проведён', inspectionNote:'', stage:registrationStage, events:[{at:now(), actor:actor || undefined, text:planned ? 'Создана запись. Статус: Запланирован отбор' : 'Зарегистрировано поступление. Статус: Поступила'}] }
    let attached: RegistrationDocuments | undefined
    setReadingDocuments(true)
    try { attached = await prepareDocuments(documents) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Не удалось прочитать документы.'); setReadingDocuments(false); return }
    const ok = await register([item], attached)
    setReadingDocuments(false)
    if (ok && addAnother) {
      setRegisteredCount(count => count + 1)
      setDocuments(emptyDocumentDraft()); setDocumentKey(key => key + 1)
      for (const name of ['externalCode', 'container', 'quantity', ...(parent ? ['subsampleInterval'] : ['interval']), 'conditions']) {
        const field = form.elements.namedItem(name)
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.value = ''
      }
      const codeField = form.elements.namedItem('externalCode')
      if (codeField instanceof HTMLInputElement) codeField.focus()
      toast.success('Проба зарегистрирована. Можно ввести следующую.')
    } else if (ok) { openSample(item.id); toast.success('Проба зарегистрирована') }
  }
  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!sample) return
    const data = new FormData(event.currentTarget)
    const decision = String(data.get('inspection')) as Inspection
    const note = String(data.get('inspectionNote') ?? '').trim()
    const location = locationFromForm(data)
    const nextStage = String(data.get('stage') ?? '') as SampleStage | ''
    const receivedAt = String(data.get('receivedAt') ?? sample.receivedAt).trim()
    if ((decision === 'С ограничениями' || decision === 'Не соответствует') && !note) { toast.error('Укажите замечание к заключению'); return }
    if (nextStage !== 'Запланирован отбор' && !location) { toast.error('Укажите местонахождение'); return }
    if (nextStage !== 'Запланирован отбор' && !receivedAt) { toast.error('Укажите дату поступления пробы'); return }
    const ok = await save(state => updateSampleControl(state, {organizationId, userId:subjectId, actor, at:now()}, sample.id, decision, note, location, nextStage || undefined, receivedAt))
    if (ok) toast.success('Изменения сохранены')
  }
  async function remove() {
    if (!sample || !canDelete || busy) return
    setBusy(true)
    try {
      const next = await updateMockState(state => {
        if (!mayDeleteSample(state, subjectId, organizationId)) throw new Error('forbidden')
        return { ...state, samples: deleteSample(withDetailedDemoSamples(state.samples ?? baseline(), documentScenario() === 'demo'), sample.id, organizationId, now(), actor) }
      }, documentMockNamespace())
      setAll(next.samples ?? [])
      setConfirmDelete(false)
      navigate(listHref, { replace: true })
      toast.success('Проба удалена из реестра')
    } catch (error) {
      toast.error(error instanceof Error && error.message === 'forbidden' ? 'Нет прав на удаление пробы' : error instanceof Error && error.message === 'has-children' ? 'Нельзя удалить пробу: к ней привязаны подпробы.' : 'Не удалось удалить пробу')
    } finally { setBusy(false) }
  }
  async function removeDuplicates() {
    if (!canDelete || busy) return
    let removed = 0
    const ok = await save(state => {
      removed = findSafeDuplicateIds(state, organizationId).length
      return removeSafeDuplicates(state, organizationId, subjectId, actor, now())
    })
    if (ok) { setConfirmDuplicates(false); toast.success(removed ? `Удалено повторных записей: ${removed}` : 'Точных дубликатов не найдено') }
  }
  return <WorkPage>
    {mode === 'list' && <><header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="sr-only">Реестр проб</h1><p className="text-sm text-muted-foreground">Регистрация проб, входной контроль, статус проб</p></div><div className="flex flex-wrap gap-2">{canDelete && <Button type="button" variant="outline" asChild><Link to={href(routes.samples.requestFields(), 'organization')}><Settings2 aria-hidden /> Поля для заявок</Link></Button>}{canCreate && <Button disabled={all === null} onClick={() => navigate(href(routes.samples.new(), 'organization'))}><Plus aria-hidden /> Зарегистрировать пробы</Button>}</div></header>
    {canDelete && duplicateIds.length > 0 && <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"><div className="min-w-0 flex-1"><p className="font-medium">Найдено точных повторных записей: {duplicateIds.length}</p><p className="mt-1 text-xs text-muted-foreground">Совпадают исходная маркировка и данные регистрации. Записи с изменениями, документами или связями с заявками сохраняются.</p></div>{confirmDuplicates ? <><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={()=>setConfirmDuplicates(false)}>Отмена</Button><Button type="button" variant="destructive" size="sm" disabled={busy} onClick={()=>void removeDuplicates()}>Удалить повторы ({duplicateIds.length})</Button></> : <Button type="button" variant="outline" size="sm" disabled={busy} onClick={()=>setConfirmDuplicates(true)}>Удалить повторы</Button>}</div>}
    <Card className="min-w-0 overflow-hidden shadow-sm">
      <div className="border-b border-border p-4">
        <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="relative min-w-0"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden /><Input className="pl-9" aria-label="Поиск проб" placeholder="ID, скважина, тара или место" value={search} onChange={e=>{setSearch(e.target.value); setPage(1)}} /></div>
          <SampleCountedFilter label="Тип пробы" value={kind} allValue="Все типы проб" options={['Все типы проб','Не указан',...SAMPLE_TYPES]} counts={counts.kind} showCounts={all !== null && !failed} onChange={value=>{setKind(value); setPage(1)}} />
          <SampleCountedFilter label="Статус пробы" value={stage} allValue="Все статусы проб" options={['Все статусы проб','Не указан',...SAMPLE_STAGES,...legacyStages]} counts={counts.stage} showCounts={all !== null && !failed} onChange={value=>{setStage(value); setPage(1)}} legacy={legacyStages} />
          <SampleCountedFilter label="Входной контроль" value={inspection} allValue="Все заключения контроля" options={['Все заключения контроля',...decisions]} counts={counts.inspection} showCounts={all !== null && !failed} onChange={selectInspection} />
        </div>
        {filtersActive && <div className="mt-2 flex justify-end"><Button type="button" variant="ghost" size="sm" onClick={resetFilters}><X aria-hidden /> Сбросить фильтры</Button></div>}
      </div>
      {failed ? <p className="p-6 text-sm text-destructive">Не удалось загрузить тестовые данные. Обновите страницу.</p> : all === null ? <p className="p-6 text-sm text-muted-foreground">Загрузка…</p> : filtered.length === 0 ? <div className="space-y-2 p-8 text-center"><p className="font-medium">{filtersActive ? 'Ничего не найдено' : 'В реестре пока нет проб'}</p><p className="text-sm text-muted-foreground">{filtersActive ? 'Попробуйте изменить поиск или сбросить фильтры.' : 'Зарегистрируйте пробы вручную или загрузите таблицу по шаблону.'}</p>{filtersActive && <Button type="button" variant="outline" size="sm" onClick={resetFilters}>Сбросить фильтры</Button>}</div> : <><Table className="min-w-[82rem] table-fixed"><TableHeader><TableRow><TableHead className="w-[16%] pl-9 pr-3">ID</TableHead><TableHead className="w-[7%] px-3">Тип пробы</TableHead><TableHead className="w-[9.5%] px-3">Месторождение</TableHead><TableHead className="w-[7%] px-3">Скважина</TableHead><TableHead className="w-[5%] px-3">Пласт</TableHead><TableHead className="w-[10%] px-3">Интервал отбора, м</TableHead><TableHead className="w-[7%] px-3">Дата отбора</TableHead><TableHead className="w-[8.5%] px-3">Дата поступления</TableHead><TableHead className="w-[12%] px-3">Статус пробы</TableHead><TableHead className="w-[11%] px-3">Входной контроль</TableHead><TableHead className="w-[11.5%] px-3">Местонахождение</TableHead></TableRow></TableHeader><TableBody>{visibleRows.map(({sample:item, depth, matches, hasChildren, expanded:isOpen})=><TableRow key={item.id} className={`cursor-pointer ${depth > 0 ? "bg-muted/30" : ""} ${!matches ? "text-muted-foreground" : ""}`} onClick={()=>openSample(item.id)}><TableCell className="pl-2 pr-3"><div className="flex min-w-0 items-start gap-1" style={{paddingLeft:`${Math.min(depth, 6) * 16}px`}}>{hasChildren ? <SampleTreeToggle code={item.code} expanded={isOpen} onToggle={()=>toggleTree(item.id, isOpen)} /> : <span className="inline-block size-6 shrink-0" aria-hidden />}<div className="min-w-0"><button type="button" className="min-w-0 truncate whitespace-nowrap font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title={item.code} onClick={e=>{e.stopPropagation();openSample(item.id)}}>{item.code}</button>{item.parentId && depth === 0 && <p className="truncate text-xs text-muted-foreground">Подпроба · {samples.find(parent=>parent.id===item.parentId) ? <button type="button" className="underline-offset-4 hover:underline" onClick={e=>{e.stopPropagation();openSample(item.parentId!)}}>{samples.find(parent=>parent.id===item.parentId)?.code}</button> : "родитель недоступен"}</p>}</div></div></TableCell><TableCell className="truncate px-3" title={item.material}>{sampleTypeOf(item)}</TableCell><TableCell className="truncate px-3" title={item.field}>{item.field}</TableCell><TableCell className="truncate px-3" title={displayWell(item.well)}>{displayWell(item.well)}</TableCell><TableCell className="truncate px-3" title={item.formation || 'Не указан'}>{item.formation || '—'}</TableCell><TableCell className="truncate px-3" title={item.parentId ? (item.subsampleInterval ? `Интервал подпробы: ${item.subsampleInterval}; исходная проба: ${item.interval || 'не указан'}` : `Интервал исходной пробы: ${item.interval || 'не указан'}; интервал подпробы не указан`) : item.interval || 'Не указан'}>{item.subsampleInterval || item.interval || '—'}</TableCell><TableCell className="whitespace-nowrap px-3">{item.collectedAt ? formatDate(item.collectedAt) : '—'}</TableCell><TableCell className="whitespace-nowrap px-3">{item.receivedAt ? formatDate(item.receivedAt) : '—'}</TableCell><TableCell className="px-3" title={displaySampleStage(item.stage) || 'Не указан'}><SampleStatusBadge value={displaySampleStage(item.stage)} /></TableCell><TableCell className="whitespace-nowrap px-3"><InspectionBadge value={item.inspection} /></TableCell><TableCell className="truncate px-3" title={item.location}>{item.location || '—'}</TableCell></TableRow>)}</TableBody></Table></>}
      {all !== null && !failed && <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-sm text-muted-foreground"><span id="samples-page-size-label">Основных проб на странице:</span><Select value={String(pageSize)} onValueChange={value=>{setPageSize(Number(value)); setPage(1)}}><SelectTrigger className="h-8 w-[4.5rem]" aria-labelledby="samples-page-size-label"><SelectValue /></SelectTrigger><SelectContent>{PAGE_SIZES.map(size=><SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent></Select></div><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={activePage <= 1} onClick={()=>setPage(activePage - 1)} aria-label="Предыдущая страница"><ChevronLeft className="h-4 w-4" /></Button><span className="text-sm tabular-nums text-muted-foreground">{activePage} / {pages}</span><Button type="button" variant="outline" size="sm" disabled={activePage >= pages} onClick={()=>setPage(activePage + 1)} aria-label="Следующая страница"><ChevronRight className="h-4 w-4" /></Button></div></div>}
    </Card></>}
    {(mode === 'new' || (mode === 'detail' && !sample)) && <div><Button type="button" variant="ghost" asChild><Link to={listHref}><ChevronLeft aria-hidden /> Вернуться к реестру</Link></Button></div>}
    {mode === 'new' && <header><h1 className="text-xl font-semibold">Регистрация проб</h1>{!creating && !importing && <p className="mt-1 text-sm text-muted-foreground">Выберите способ регистрации в зависимости от количества проб.</p>}</header>}
    {mode === 'new' && importing && all !== null ? <BatchImport records={all.filter(item => !item.deletedAt)} existingDocuments={availableDocuments} organizationId={organizationId} actor={actor} busy={busy} onClose={() => navigate(listHref)} onBack={() => setImporting(false)} onSave={async (items, files) => {
      const ok = await register(items, files)
      if (ok) toast.success(`Зарегистрировано проб: ${items.length}`)
      return ok
    }} /> : null}
    {mode === 'new' && failed && <p role="alert" className="text-sm text-destructive">Не удалось загрузить данные реестра. Обновите страницу и попробуйте ещё раз.</p>}
    {mode === 'new' && !creating && !importing && <Card className="grid gap-3 p-6 shadow-sm sm:grid-cols-2"><Button type="button" variant="outline" disabled={all === null} className="h-auto justify-start gap-3 whitespace-normal p-5 text-left" onClick={() => {setRegistrationStage('Поступила'); setRegisteredCount(0); setCreating(true)}}><PenLine aria-hidden /><span><span className="block font-semibold">Ввести вручную</span><span className="mt-1 block text-xs font-normal text-muted-foreground">Для одной или нескольких проб, в том числе запланированных</span></span></Button><Button type="button" variant="outline" disabled={all === null} className="h-auto justify-start gap-3 whitespace-normal p-5 text-left" onClick={() => setImporting(true)}><FileSpreadsheet aria-hidden /><span><span className="block font-semibold">Загрузить таблицу</span><span className="mt-1 block text-xs font-normal text-muted-foreground">Для партии поступивших проб по шаблону XLSX</span></span></Button></Card>}
    {mode === 'new' && creating && all !== null && <form onSubmit={create} className="relative grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
      <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
        {(initialParentId && parentCodeInput === null && !initialParent || registeredCount > 0) && <div className="rounded-xl border border-border bg-card px-4 py-4 text-sm shadow-sm">{initialParentId && parentCodeInput === null && !initialParent && <p role="alert" className="text-destructive">Родительская проба недоступна или утилизирована. Выберите другую пробу или очистите поле.</p>}{registeredCount > 0 && <p role="status">Зарегистрировано проб: {registeredCount}. Общие сведения сохранены в форме — проверьте их перед добавлением следующей пробы.</p>}</div>}
        <DraftSection id="sample-identification" index={1} title="Идентификация пробы" description="Тип, родительская проба и маркировка. ID присваивается автоматически.">
          <fieldset className="grid gap-4 sm:grid-cols-2"><legend className="sr-only">Идентификация пробы</legend><div className="sm:col-span-2"><Field label="Родительская проба (необязательно)" name="parentCode" list="sample-parent-options" value={parentCodeValue} onChange={event=>setParentCodeInput(event.target.value)} placeholder="Введите или выберите ID из реестра" /><datalist id="sample-parent-options">{samples.filter(item=>displaySampleStage(item.stage)!=='Утилизирована').map(item=><option key={item.id} value={item.code}>{sampleTypeOf(item)} · {item.field} · {item.well}</option>)}</datalist><p className="mt-1 text-xs text-muted-foreground">Укажите, если регистрируете подпробу. Для самостоятельной пробы оставьте поле пустым.</p></div><Field label="Исходная маркировка" name="externalCode" placeholder="Если указана на таре или в документах" /><label className={labelStyle}>Тип пробы {selectedParent ? <><Input value={sampleTypeOf(selectedParent)} readOnly aria-readonly="true" /><span className="text-xs font-normal text-muted-foreground">Наследуется от родительской пробы</span></> : <select name="sampleType" className={selectStyle}>{SAMPLE_TYPES.map(value=><option key={value}>{value}</option>)}</select>}</label><Field label="Уточнение типа" name="material" placeholder="Дополнительное описание пробы" /><Field label="Тара и её номер" name="container" placeholder="Тип и номер тары" /><Field label="Количество / объём" name="quantity" placeholder="С единицей измерения" /></fieldset>
        </DraftSection>
        <DraftSection id="sample-origin" index={2} title="Происхождение и отбор" description="Укажите место и дату отбора пробы.">
          <div className="space-y-4">{selectedParent ? <p className="text-sm text-muted-foreground">Происхождение и дата отбора наследуются от родительской пробы и не редактируются. Интервал относится к исходной пробе.</p> : demoSuperadmin && <p className="text-sm text-muted-foreground">Обязательные поля заполнены примером для тестирования. При необходимости измените значения.</p>}
          <fieldset className="grid gap-4 sm:grid-cols-2"><legend className="sr-only">Происхождение и отбор</legend><Field label="Месторождение / участок" name="field" {...(selectedParent ? {value:selectedParent.field, readOnly:true} : {defaultValue:(demoSuperadmin ? 'Северное' : '')})} key={'field:' + (selectedParent?.id ?? 'independent')} required /><Field label="Скважина" name="well" {...(selectedParent ? {value:selectedParent.well, readOnly:true} : {defaultValue:(demoSuperadmin ? '101' : '')})} key={'well:' + (selectedParent?.id ?? 'independent')} required /><Field label="Пласт" name="formation" {...(selectedParent ? {value:selectedParent.formation, readOnly:true} : {defaultValue:''})} key={'formation:' + (selectedParent?.id ?? 'independent')} /><Field label={selectedParent ? "Интервал исходной пробы, м" : "Интервал отбора, м"} name="interval" {...(selectedParent ? {value:inheritedSampleOrigin(selectedParent).interval, readOnly:true} : {defaultValue:''})} key={'interval:' + (selectedParent?.id ?? 'independent')} placeholder="Например, 1138–1150" />{selectedParent && <Field label="Интервал подпробы, м (необязательно)" name="subsampleInterval" placeholder="Если известен" />}<Field label="Дата отбора" name="collectedAt" type="date" {...(selectedParent ? {value:selectedParent.collectedAt, readOnly:true} : {defaultValue:''})} key={'collectedAt:' + (selectedParent?.id ?? 'independent')} /><label className={`${labelStyle} sm:col-span-2`}>Условия отбора и примечания<textarea name="conditions" rows={2} className="rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Укажите условия и важные сведения об отборе" /></label></fieldset></div>
        </DraftSection>
        <DraftSection id="sample-receipt" index={3} title={registrationStage === 'Запланирован отбор' ? 'Планирование отбора' : 'Поступление в лабораторию'} description={registrationStage === 'Запланирован отбор' ? 'Дата поступления указывается после фактической передачи пробы в лабораторию.' : 'Статус, местонахождение и сведения о передаче. Входной контроль проводится отдельно.'}>
          <fieldset className="grid gap-4 sm:grid-cols-2"><legend className="sr-only">{registrationStage === 'Запланирован отбор' ? 'Планирование отбора' : 'Поступление в лабораторию'}</legend><label className={labelStyle}>Статус пробы<select className={selectStyle} value={registrationStage} onChange={e=>setRegistrationStage(e.target.value as CurrentSampleStage)}><option>Поступила</option><option>Запланирован отбор</option></select></label><RegistrationDateField initialValue={demoSuperadmin ? localDate() : ''} planned={registrationStage === 'Запланирован отбор'} /><LocationFields value={demoSuperadmin ? 'Зона приёмки проб' : ''} required={registrationStage !== 'Запланирован отбор'} planned={registrationStage === 'Запланирован отбор'} /><Field label="Передающая сторона" name="supplier" /></fieldset>
        </DraftSection>
        <DraftSection id="sample-documents" index={4} title={registrationStage === 'Запланирован отбор' ? 'Документы' : 'Документы при поступлении'} description="При необходимости приложите файлы или выберите ранее добавленный документ.">
          <RegistrationDocumentsField key={documentKey} draft={documents} onChange={setDocuments} existing={availableDocuments} disabled={busy || readingDocuments} summaryLabel="Добавить или выбрать документы" />
        </DraftSection>
        <div className="flex flex-wrap justify-between gap-2 rounded-xl border border-border bg-card px-4 py-4 shadow-sm md:px-6"><div><Button type="button" variant="ghost" disabled={busy || readingDocuments} onClick={()=>setCreating(false)}>Назад к выбору</Button><p className="px-2 text-xs text-muted-foreground">Несохранённые данные формы будут очищены.</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy || readingDocuments} onClick={()=>navigate(listHref)}>{registeredCount > 0 ? 'Завершить' : 'Отмена'}</Button><Button type="submit" variant="outline" value="continue" disabled={busy || readingDocuments}>Зарегистрировать и добавить ещё</Button><Button disabled={busy || readingDocuments} type="submit" value="finish">Зарегистрировать</Button></div></div>
      </div>
      <SampleRegistrationNav parent={selectedParent} registeredCount={registeredCount} planned={registrationStage === 'Запланирован отбор'} />
    </form>}
    {mode === 'detail' && (failed ? <p className="text-sm text-destructive">Не удалось загрузить пробу. Обновите страницу.</p> : all === null ? <p className="text-sm text-muted-foreground">Загрузка…</p> : !sample ? <p className="text-sm text-muted-foreground">Проба не найдена в выбранной организации.</p> : <><PageHeader breadcrumbs={[{label:'Реестр проб', to:listHref}, {label:`Проба ${sample.code}`}]} title={`Проба ${sample.code}`} description="Сведения о происхождении, поступлении и текущем состоянии пробы." />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]"><div className="min-w-0 space-y-4"><Card className="min-w-0 overflow-hidden shadow-sm"><SampleControlForm key={sample.id} sample={sample} canUpdate={canUpdate} busy={busy} onSubmit={update} /></Card>
          <Card className="min-w-0 overflow-hidden shadow-sm"><section aria-labelledby="sample-receipt-title"><div className="border-b border-border px-5 py-4 sm:px-6"><h2 id="sample-receipt-title" className="text-base font-semibold">Поступление</h2></div><dl className="grid grid-cols-1 gap-x-6 gap-y-4 px-5 py-5 text-sm sm:grid-cols-2 sm:px-6">{[['Тара',sample.container],['Количество / объём',sample.quantity],['Передающая сторона',sample.supplier],['Документ',sample.document],['Условия и примечания',sample.conditions]].map(([label,value])=><div key={label} className={label === 'Условия и примечания' ? 'sm:col-span-2' : ''}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{value || 'Не указано'}</dd></div>)}</dl></section></Card>
          <SampleRelations sample={sample} samples={samples} canCreate={canCreate} onOpen={openSample} onCreate={()=>{const url=href(routes.samples.new(), 'organization'); navigate(`${url}${url.includes('?') ? '&' : '?'}parent=${encodeURIComponent(sample.id)}`)}} />
          <Card className="min-w-0 overflow-hidden shadow-sm"><SampleAttachments key={sample.id} sample={sample} samples={samples} canUpdate={canUpdate} userId={subjectId} actor={actor} onRecords={setAll} /></Card>
          {canDelete && <div>{confirmDelete ? <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4"><div className="mr-auto"><p className="text-sm font-medium">Удалить пробу {sample.code}?</p><p className="mt-1 text-xs text-muted-foreground">Проба и её история больше не будут отображаться в реестре.</p></div><Button type="button" variant="outline" disabled={busy} onClick={()=>setConfirmDelete(false)}>Отмена</Button><Button type="button" variant="destructive" disabled={busy} onClick={()=>void remove()}>Подтвердить удаление</Button></div> : <Button type="button" variant="outline" className="text-destructive hover:text-destructive" disabled={busy} onClick={()=>setConfirmDelete(true)}><Trash2 aria-hidden /> Удалить пробу</Button>}</div>}</div><aside className="min-w-0 space-y-4"><SampleSummary sample={sample} /><SampleHistory sample={sample} /></aside></div></>)}
  </WorkPage>
}
const SAMPLE_REGISTRATION_SECTIONS = [
  {id:'sample-identification', label:'Идентификация пробы'},
  {id:'sample-origin', label:'Происхождение и отбор'},
  {id:'sample-receipt', label:'Поступление'},
  {id:'sample-documents', label:'Документы'},
] as const

function SampleRegistrationNav({parent, registeredCount, planned}: {parent?:Sample; registeredCount:number; planned:boolean}) {
  const [active, setActive] = useState<string>(SAMPLE_REGISTRATION_SECTIONS[0].id)
  useEffect(() => {
    const nodes = SAMPLE_REGISTRATION_SECTIONS.map(item => document.getElementById(item.id)).filter((node): node is HTMLElement => node != null)
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (visible?.target.id) setActive(visible.target.id)
    }, {rootMargin:'-15% 0px -55% 0px', threshold:[0.15, 0.4]})
    nodes.forEach(node => observer.observe(node))
    return () => observer.disconnect()
  }, [])
  return <aside className="order-1 lg:sticky lg:top-4 lg:order-2"><Card className="shadow-sm">
    <div className="space-y-1 border-b border-border px-4 py-4"><h2 className="text-sm font-semibold text-foreground">Регистрация пробы</h2><p className="text-sm text-muted-foreground">{parent ? 'Подпроба · ' + parent.code : 'ID будет присвоен автоматически'}</p><p className="text-sm text-muted-foreground">Поля со звёздочкой обязательны.</p>{registeredCount > 0 && <p className="text-sm text-muted-foreground">Зарегистрировано: {registeredCount}</p>}</div>
    <nav aria-label="Разделы регистрации пробы" className="flex gap-2 overflow-x-auto p-3 lg:flex-col lg:overflow-visible">{SAMPLE_REGISTRATION_SECTIONS.map((item,index)=><button key={item.id} type="button" aria-current={active === item.id ? 'true' : undefined} onClick={()=>{setActive(item.id); document.getElementById(item.id)?.scrollIntoView({behavior:'smooth', block:'start'})}} className={`shrink-0 rounded-lg border px-3 py-2 text-left text-sm lg:w-full ${active === item.id ? 'border-primary bg-card text-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'}`}><span className="mr-2 text-xs font-medium">{index + 1}</span>{planned && item.id === 'sample-receipt' ? 'Планирование отбора' : item.label}</button>)}</nav>
  </Card></aside>
}

function SampleRelations({sample, samples, canCreate, onOpen, onCreate}: {sample:Sample; samples:Sample[]; canCreate:boolean; onOpen:(id:string)=>void; onCreate:()=>void}) {
  const parent = samples.find(item => item.id === sample.parentId)
  const children = samples.filter(item => item.parentId === sample.id)
  return <Card className="min-w-0 overflow-hidden shadow-sm"><section aria-labelledby="sample-relations-title"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6"><h2 id="sample-relations-title" className="text-base font-semibold">Связанные пробы</h2>{canCreate && displaySampleStage(sample.stage) !== 'Утилизирована' && <Button type="button" variant="outline" size="sm" onClick={onCreate}><Plus aria-hidden /> Создать подпробу</Button>}</div><div className="space-y-4 px-5 py-4 text-sm sm:px-6"><div><p className="text-xs text-muted-foreground">Родительская проба</p>{parent ? <button type="button" className="mt-1 font-medium text-primary underline-offset-4 hover:underline" onClick={()=>onOpen(parent.id)}>{parent.code}</button> : <p className="mt-1 text-muted-foreground">{sample.parentId ? 'Проба недоступна' : 'Нет — самостоятельная проба'}</p>}</div><div><p className="text-xs text-muted-foreground">Подпробы {children.length > 0 && `(${children.length})`}</p>{children.length ? <ul className="mt-2 divide-y divide-border">{children.map(child=><li key={child.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={()=>onOpen(child.id)}>{child.code}</button><span className="flex items-center gap-2 text-xs text-muted-foreground">{sampleTypeOf(child)} <SampleStatusBadge value={displaySampleStage(child.stage)} /></span></li>)}</ul> : <p className="mt-1 text-muted-foreground">Подпроб пока нет</p>}</div></div></section></Card>
}
function SampleControlForm({ sample, canUpdate, busy, onSubmit }: { sample: Sample; canUpdate: boolean; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [stage, setStage] = useState<SampleStage | ''>(() => displaySampleStage(sample.stage) ?? '')
  const [decision, setDecision] = useState<Inspection>(sample.inspection)
  const needsNote = decision === 'С ограничениями' || decision === 'Не соответствует'
  const received = stage !== 'Запланирован отбор'
  return <form onSubmit={onSubmit}>
    <div className="border-b border-border px-5 py-4 sm:px-6">
      <h2 className="text-base font-semibold">Статус, контроль и местонахождение</h2>
      <p className="mt-1 text-sm text-muted-foreground">Обновляйте сведения по мере поступления, проверки и перемещения пробы.</p>
    </div>
    <div className="grid items-start gap-4 px-5 py-5 sm:px-6 md:grid-cols-2">
      <fieldset className="min-w-0 space-y-3 rounded-lg border border-border bg-muted/20 p-4" disabled={!canUpdate || busy}>
        <legend className="sr-only">Статус пробы и местонахождение</legend>
        <h3 className="text-sm font-semibold">Статус пробы</h3>
        <select aria-label="Статус пробы" name="stage" className={`${selectStyle} w-full`} value={stage} onChange={event=>setStage(event.target.value as SampleStage | '')}>{!stage && <option value="">Не указан</option>}{stage && !(SAMPLE_STAGES as readonly string[]).includes(stage) && <option value={stage}>{stage} (ранее)</option>}{SAMPLE_STAGES.map(value=><option key={value}>{value}</option>)}</select>
        <LocationFields value={sample.location} required={received} />
        {received && !sample.receivedAt && <Field label="Дата поступления" name="receivedAt" type="date" required />}
      </fieldset>
      <fieldset className="min-w-0 space-y-3 rounded-lg border border-border bg-muted/20 p-4" disabled={!canUpdate || busy}>
        <legend className="sr-only">Входной контроль</legend>
        <div><h3 className="text-sm font-semibold">Входной контроль</h3><p className="mt-1 text-xs text-muted-foreground">Проведение оценки осуществляется принимающей стороной.</p></div>
        <select aria-label="Заключение входного контроля" name="inspection" className={`${selectStyle} w-full`} value={decision} onChange={event=>setDecision(event.target.value as Inspection)}>{decisions.map(value=><option key={value}>{value}</option>)}</select>
        <label className={labelStyle}><span>Замечание {needsNote && <><span aria-hidden="true" className="text-destructive">*</span><span className="sr-only">, обязательно</span></>}</span><textarea name="inspectionNote" defaultValue={sample.inspectionNote} rows={2} required={needsNote} className="rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Обязательно при ограничениях или несоответствии" /></label>
      </fieldset>
    </div>
    {canUpdate ? <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4 sm:px-6"><Button type="submit" disabled={busy}>Сохранить изменения</Button><p className="text-xs text-muted-foreground">Изменения отобразятся в истории пробы.</p></div> : <p className="border-t border-border px-5 py-4 text-xs text-muted-foreground sm:px-6">Доступен только просмотр сведений.</p>}
  </form>
}
const locationRooms = ['Зона приёмки проб', 'Зона входного контроля', 'Помещение хранения', 'Лаборатория']
function RegistrationDateField({initialValue, planned}: {initialValue:string; planned:boolean}) {
  const [value, setValue] = useState(initialValue)
  return <Field label="Дата поступления" name="receivedAt" type="date" value={planned ? '' : value} onInput={event=>setValue(event.currentTarget.value)} onChange={event=>setValue(event.target.value)} required={!planned} disabled={planned} />
}
function LocationFields({ value, required, planned = false }: { value: string; required: boolean; planned?:boolean }) {
  const [initialRoom, ...initialDetails] = value.split(',')
  const currentRoom = initialRoom.trim()
  const [room, setRoom] = useState(currentRoom)
  const [touched, setTouched] = useState(false)
  const shownRoom = planned && !touched && currentRoom === 'Зона приёмки проб' ? '' : room
  const rooms = [...new Set([...locationRooms, ...(currentRoom && !locationRooms.includes(currentRoom) ? [currentRoom] : [])])]
  return <div className="space-y-2"><label className={labelStyle}><span>Местонахождение{required && <><span aria-hidden="true" className="ml-1 text-destructive">*</span><span className="sr-only">, обязательно</span></>}</span><select name="locationRoom" className={selectStyle} value={shownRoom} onChange={event=>{setTouched(true); setRoom(event.target.value)}} required={required}><option value="">Выберите помещение</option>{rooms.map(item=><option key={item}>{item}</option>)}<option value="__other__">Другое помещение</option></select></label>{shownRoom === '__other__' && <Input name="locationOther" aria-label="Название помещения" placeholder="Название помещения" required /> }<Input name="locationDetails" aria-label="Стеллаж, полка или коробка" defaultValue={initialDetails.join(',').trim()} placeholder="Стеллаж, полка, ячейка или коробка" /></div>
}
function locationFromForm(data: FormData): string {
  const selected = String(data.get('locationRoom') ?? '').trim()
  const room = selected === '__other__' ? String(data.get('locationOther') ?? '').trim() : selected
  const details = String(data.get('locationDetails') ?? '').trim()
  return [room, details].filter(Boolean).join(', ')
}
function SampleSummary({ sample }: { sample: Sample }) {
  const facts = [
    ['Тип пробы', sampleTypeOf(sample)],
    ...(sample.externalCode ? [['Исходная маркировка', sample.externalCode]] : []),
    ['Месторождение / участок', sample.field],
    ['Скважина', displayWell(sample.well)],
    ['Пласт', sample.formation],
    [sample.parentId ? 'Интервал исходной пробы, м' : 'Интервал отбора, м', sample.interval],
    ...(sample.parentId && sample.subsampleInterval ? [['Интервал подпробы, м', sample.subsampleInterval]] : []),
    ['Дата отбора', formatDate(sample.collectedAt)],
    ['Дата поступления', formatDate(sample.receivedAt)],
    ['Местонахождение', sample.location],
  ]
  return <Card className="shadow-sm"><div className="border-b border-border px-4 py-4 md:px-6"><h2 className="text-base font-semibold text-foreground">Сведения о пробе</h2></div><div className="px-4 py-4 text-sm text-foreground md:px-6"><dl className="space-y-2.5"><div className="flex items-baseline justify-between gap-x-4 gap-y-1"><dt className="text-muted-foreground">Статус пробы</dt><dd className="min-w-0 text-right"><SampleStatusBadge value={displaySampleStage(sample.stage)} /></dd></div><div className="flex items-baseline justify-between gap-x-4 gap-y-1"><dt className="text-muted-foreground">Входной контроль</dt><dd className="min-w-0 text-right"><InspectionBadge value={sample.inspection} /></dd></div>{facts.map(([label,value])=><div key={label} className="flex items-baseline justify-between gap-x-4 gap-y-1"><dt className="min-w-0 text-muted-foreground">{label}</dt><dd className="max-w-[55%] min-w-0 break-words text-right">{value || 'Не указано'}</dd></div>)}</dl></div></Card>
}
function SampleHistory({ sample }: { sample: Sample }) {
  return <Card className="shadow-sm"><section aria-labelledby="sample-history-title"><div className="border-b border-border px-4 py-4 md:px-6"><h2 id="sample-history-title" className="text-base font-semibold text-foreground">История изменений</h2></div><div className="px-4 py-4 text-sm text-foreground md:px-6">{sample.events.length === 0 ? <p className="text-muted-foreground">Событий пока нет.</p> : <ol className="space-y-4 border-l border-border pl-4">{[...sample.events].reverse().map((entry,index)=><li key={entry.at + '-' + index} className="relative space-y-1"><span className="absolute -left-[1.3125rem] top-1.5 size-2.5 rounded-full border-2 border-card bg-primary" aria-hidden /><p className="break-words font-medium">{entry.text.replace(/Этап:/g, 'Статус:')}</p><p className="text-muted-foreground">{entry.actor || 'Автор не указан'} · {formatEventWhen(entry.at)}</p></li>)}</ol>}</div></section></Card>
}
function SampleCountedFilter({label, value, allValue, options, counts, showCounts, onChange, legacy = []}: {label:string; value:string; allValue:string; options:readonly string[]; counts:Map<string, number>; showCounts:boolean; onChange:(value:string)=>void; legacy?:readonly string[]}) {
  const id = useId()
  return <div className="flex min-w-0 flex-col gap-1.5"><Label htmlFor={id} className="text-xs font-normal text-muted-foreground">{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger id={id} className="w-full bg-card"><SelectValue /></SelectTrigger><SelectContent>{options.map(option=><SelectItem key={option} value={option} className="pr-2 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus:data-[state=checked]:bg-primary focus:data-[state=checked]:text-primary-foreground [&>span:first-child]:hidden">{option === allValue ? 'Все' : legacy.includes(option) ? `${option} (ранее)` : option}{showCounts ? ` (${counts.get(option) ?? 0})` : ''}</SelectItem>)}</SelectContent></Select></div>
}
function Field({label, ...props}: {label:string} & React.InputHTMLAttributes<HTMLInputElement>) { return <label className={labelStyle}><span>{label}{props.required && <><span aria-hidden="true" className="ml-1 text-destructive">*</span><span className="sr-only">, обязательно</span></>}</span><Input {...props} /></label> }
function InspectionBadge({value}: {value:Inspection}) { return <Badge variant="outline" className={'px-2 py-0 font-medium shadow-none ' + (value==='Соответствует'?'border-emerald-200 bg-emerald-50 text-emerald-800':value==='С ограничениями'?'border-amber-200 bg-amber-50 text-amber-800':value==='Не соответствует'?'border-red-200 bg-red-50 text-red-800':'bg-muted text-muted-foreground')}>{value}</Badge> }

function formatEventWhen(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function SampleStatusBadge({value}: {value?: SampleStage}) {
  const colors: Record<SampleStage, string> = {
    'Поступила': 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200',
    'На хранении': 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200',
    'На исследовании': 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200',
    'Запланирован отбор': 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
    'Утилизирована': 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200',
    'Входной контроль': 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200',
    'В исследовании': 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200',
    'Исследование завершено': 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    'Передана': 'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-200',
  }
  return <Badge variant="outline" className={`max-w-full px-2 py-0 font-medium shadow-none ${value ? colors[value] : 'border-border bg-muted text-muted-foreground'}`}><span className="truncate">{value || 'Не указан'}</span></Badge>
}
