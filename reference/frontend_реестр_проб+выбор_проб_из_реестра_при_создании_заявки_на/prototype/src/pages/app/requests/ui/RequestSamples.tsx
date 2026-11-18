import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../../shared/ui/dialog'
import { Button } from '../../../../shared/ui/button'
import { Input } from '../../../../shared/ui/input'
import { displaySampleStage, displayWell, formatDate, SAMPLE_STAGES, SAMPLE_TYPES, sampleTypeOf, type Sample } from '../../samples/model'
import { REQUEST_SAMPLE_FIELDS, type RequestSampleField } from '../../samples/requestFields'
import { SAMPLE_TYPE_OPTIONS } from '../../../../shared/lib/sample-types'
import type { RequestSampleRegistry } from './requestSampleRegistry'
import { hasSelectedLineage } from '../../samples/lineage'
import { buildSampleTree, flattenSampleTree } from '../../samples/sampleTree'
import { SampleTreeToggle } from '../../samples/SampleTreeToggle'
import { sampleOutsideStudyObjects, type StudyObject } from './sampleWarnings'

function fieldValue(sample: Sample, field: RequestSampleField, records: readonly Sample[] = []): string {
  if (field === 'parentCode') return sample.parentCode || records.find(parent => parent.id === sample.parentId)?.code || '—'
  if (field === 'sampleType') return sampleTypeOf(sample)
  if (field === 'interval') return sample.subsampleInterval || sample.interval || '—'
  if (field === 'stage') return displaySampleStage(sample.stage) ?? 'Не указан'
  if (field === 'well') return displayWell(sample.well) || '—'
  if (field === 'collectedAt' || field === 'receivedAt') return sample[field] ? formatDate(sample[field]) : '—'
  return sample[field] || '—'
}

export function RequestSampleSummary({ ids, registry }: { ids: readonly string[]; registry: RequestSampleRegistry }) {
  if (!ids.length) return null
  const columns = registry.fields.filter(field => field !== 'code')
  return <details className="text-sm">
    <summary className="cursor-pointer text-muted-foreground">Выбрано проб: {ids.length}</summary>
    {registry.available && !registry.loading ? <div className="mt-3 max-h-80 overflow-auto rounded-md border border-border">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 z-10 bg-muted text-muted-foreground"><tr>
          <th scope="col" className="whitespace-nowrap px-3 py-2 font-medium">ID пробы</th>
          {columns.map(field=><th key={field} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">{REQUEST_SAMPLE_FIELDS.find(item => item.key === field)?.label}</th>)}
        </tr></thead>
        <tbody>{ids.map(id => {
          const sample = registry.records.find(item => item.id === id)
          return <tr key={id} className="border-t border-border align-top">
            <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-medium">{sample?.code || 'Проба недоступна'}{sample?.deletedAt && <span className="ml-1 font-normal text-muted-foreground">· удалена</span>}</th>
            {columns.map(field => <td key={field} className="max-w-56 whitespace-nowrap px-3 py-2">{sample ? <SampleSummaryValue sample={sample} field={field} records={registry.records} /> : '—'}</td>)}
          </tr>
        })}</tbody>
      </table>
    </div> : <p className="mt-2 text-xs text-muted-foreground">{registry.loading ? 'Загрузка…' : 'Нет доступа к реестру проб.'}</p>}
  </details>
}

function SampleSummaryValue({sample, field, records}: {sample:Sample; field:RequestSampleField; records:readonly Sample[]}) {
  const value = fieldValue(sample, field, records)
  if (field !== 'stage' && field !== 'inspection') return <span title={value} className="block max-w-56 truncate">{value}</span>
  const colors = field === 'inspection'
    ? value === 'Соответствует' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : value === 'Не соответствует' ? 'border-red-200 bg-red-50 text-red-800' : value === 'С ограничениями' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-border bg-muted text-muted-foreground'
    : value === 'На хранении' ? 'border-violet-200 bg-violet-50 text-violet-800' : value === 'На исследовании' ? 'border-blue-200 bg-blue-50 text-blue-800' : value === 'Запланирован отбор' ? 'border-amber-200 bg-amber-50 text-amber-800' : value === 'Поступила' ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-border bg-muted text-muted-foreground'
  return <span className={`inline-flex rounded-md border px-2 py-0.5 font-medium ${colors}`}>{value}</span>
}

export function RequestSamplePicker({ ids, onChange, registry, typeId, studyObjects = [] }: { ids:readonly string[]; onChange:(ids:string[])=>void; registry:RequestSampleRegistry; typeId?:string; studyObjects?:readonly StudyObject[] }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('')
  const [stage, setStage] = useState('')
  const [inspection, setInspection] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const requiredType = SAMPLE_TYPE_OPTIONS.find(option => option.id === typeId)?.label ?? ''
  function openPicker() { setSelected([...ids]); setSearch(''); setKind(''); setStage(''); setInspection(''); setExpanded(new Set()); setCollapsed(new Set()); setOpen(true); registry.refresh() }
  const columns = registry.fields.filter(field => field !== 'code' && field !== 'parentCode' && field !== 'stage' && field !== 'inspection')
  const allowed = useMemo(() => registry.records.filter(sample => !sample.deletedAt && displaySampleStage(sample.stage) !== 'Утилизирована'), [registry.records])
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('ru')
    return allowed.filter(sample => (!requiredType || sampleTypeOf(sample) === requiredType) && (!kind || sampleTypeOf(sample) === kind) && (!stage || displaySampleStage(sample.stage) === stage) && (!inspection || sample.inspection === inspection) && registry.fields.map(field => fieldValue(sample, field, registry.records)).join(' ').toLocaleLowerCase('ru').includes(term))
  }, [allowed, search, kind, stage, inspection, registry.fields, registry.records, requiredType])
  const tree = useMemo(() => buildSampleTree(registry.records.filter(sample => !sample.deletedAt), filtered), [registry.records, filtered])
  const matchingIds = new Set(filtered.map(sample => sample.id))
  const hasContext = filtered.some(sample => sample.parentId && !matchingIds.has(sample.parentId))
  const visibleRows = flattenSampleTree(tree, expanded, collapsed, Boolean(search.trim() || kind || stage || inspection || hasContext))
  function toggleTree(id:string, isOpen:boolean) {
    setExpanded(previous => { const next = new Set(previous); if (isOpen) next.delete(id); else next.add(id); return next })
    setCollapsed(previous => { const next = new Set(previous); if (isOpen) next.add(id); else next.delete(id); return next })
  }
  const unavailable = selected.filter(id => !allowed.some(sample => sample.id === id))
  const mismatchedIds = (values: readonly string[]) => requiredType ? values.filter(id => allowed.some(sample => sample.id === id && sampleTypeOf(sample) !== requiredType)) : []
  const mismatched = mismatchedIds(selected)
  const currentMismatched = mismatchedIds(ids)
  const allSelected = filtered.length > 0 && filtered.every(sample => selected.includes(sample.id))
  const checkObjects = registry.fields.includes('field') && registry.fields.includes('well')
  const outsideObjects = checkObjects ? selected.filter(id => { const item = registry.records.find(sample => sample.id === id); return item && sampleOutsideStudyObjects(item, studyObjects) }) : []
  const tooMany = selected.length > 1000
  const hasRelated = registry.fields.includes('parentCode') && hasSelectedLineage(registry.records, selected)
  return <div className="space-y-2"><div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" size="sm" onClick={openPicker} disabled={!registry.available || registry.loading || registry.failed}>Выбрать пробы</Button><span className="text-sm text-muted-foreground">Выбрано: {ids.length}</span></div>{requiredType && <p className="text-xs text-muted-foreground">Для исследования доступны пробы типа «{requiredType}».</p>}{currentMismatched.length > 0 && <p role="alert" className="text-xs text-amber-800">Выбранные ранее пробы другого типа: {currentMismatched.length}. Откройте выбор проб и измените состав.</p>}{registry.failed ? <p className="text-xs text-destructive">Не удалось загрузить реестр проб. Обновите страницу.</p> : !registry.available && <p className="text-xs text-muted-foreground">Нет доступа к реестру проб.</p>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="flex max-h-[90vh] max-w-6xl flex-col gap-4 overflow-hidden"><DialogHeader><DialogTitle>Выбор проб для исследования</DialogTitle><DialogDescription>Выберите пробы. При выборе всех учитываются текущие фильтры; утилизированные пробы не предлагаются.</DialogDescription></DialogHeader>
      <div className="flex flex-wrap gap-2"><Input className="min-w-48 flex-1" aria-label="Поиск проб" placeholder="Поиск по доступным полям" value={search} onChange={event=>setSearch(event.target.value)} />{!requiredType && registry.fields.includes('sampleType') && <select aria-label="Тип пробы" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={kind} onChange={event=>setKind(event.target.value)}><option value="">Все типы проб</option>{SAMPLE_TYPES.map(item=><option key={item}>{item}</option>)}</select>}<select aria-label="Статус пробы" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={stage} onChange={event=>setStage(event.target.value)}><option value="">Все статусы</option>{SAMPLE_STAGES.filter(value=>value!=='Утилизирована').map(item=><option key={item}>{item}</option>)}</select><select aria-label="Входной контроль" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={inspection} onChange={event=>setInspection(event.target.value)}><option value="">Все заключения</option>{['Не проведён','Соответствует','С ограничениями','Не соответствует'].map(item=><option key={item}>{item}</option>)}</select></div>
      {requiredType && <p className="text-sm text-muted-foreground">Тип пробы для исследования: <strong>{requiredType}</strong></p>}
      <p className="text-xs text-muted-foreground">Проверьте заключение входного контроля и соответствие проб объектам исследования. Запланированные пробы можно выбрать предварительно.</p>
      <div className="flex flex-wrap items-center gap-2 text-sm"><Button type="button" size="sm" variant="outline" disabled={registry.loading || registry.failed || !filtered.length} onClick={()=>setSelected(previous => allSelected ? previous.filter(id=>!filtered.some(item=>item.id===id)) : [...new Set([...previous,...filtered.map(item=>item.id)])])}>{allSelected ? 'Снять выбор с найденных' : 'Выбрать все найденные'}</Button><span className="text-muted-foreground">{registry.loading ? 'Обновление реестра…' : registry.failed ? 'Не удалось обновить реестр.' : `Найдено: ${filtered.length}`} · выбрано: {selected.length}</span></div>
      {unavailable.length > 0 && <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Ранее выбранные пробы недоступны или утилизированы: {unavailable.length}. Они останутся в программе, пока вы их не удалите. <Button type="button" size="sm" variant="ghost" onClick={()=>setSelected(previous=>previous.filter(id=>!unavailable.includes(id)))}>Убрать недоступные</Button></div>}
      {mismatched.length > 0 && <div role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Ранее выбраны пробы другого типа: {mismatched.length}. Чтобы применить выбор для типа «{requiredType}», удалите их из этой строки исследования. <Button type="button" size="sm" variant="ghost" onClick={()=>setSelected(previous=>previous.filter(id=>!mismatched.includes(id)))}>Убрать пробы другого типа</Button></div>}
      {outsideObjects.length > 0 && <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">У выбранных проб ({outsideObjects.length}) месторождение или скважина отличаются от объектов исследования. Проверьте выбор.</p>}
      {tooMany && <p role="alert" className="text-sm text-destructive">За один раз можно выбрать не более 1000 проб.</p>}
      {hasRelated && <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Выбраны связанные пробы: среди них есть родительская проба и её подпроба. Проверьте, нужно ли назначать исследование каждой из них.</p>}
      <div className="min-h-0 overflow-auto rounded-md border border-border"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-muted"><tr><th className="p-2"><span className="sr-only">Выбрать</span></th><th className="p-2">ID</th>{columns.map(field=><th key={field} className="p-2 whitespace-nowrap">{REQUEST_SAMPLE_FIELDS.find(item=>item.key===field)?.label}</th>)}<th className="p-2 whitespace-nowrap">Статус пробы</th><th className="p-2 whitespace-nowrap">Входной контроль</th></tr></thead><tbody>{!registry.loading && !registry.failed && visibleRows.map(({sample, depth, matches, hasChildren, expanded:isOpen})=><tr key={sample.id} className={`border-t border-border align-top ${depth > 0 ? "bg-muted/30" : ""} ${!matches ? "text-muted-foreground" : ""}`}><td className="p-2"><input type="checkbox" aria-label={`Выбрать пробу ${sample.code}`} disabled={!matches} checked={selected.includes(sample.id)} onChange={event=>{const checked=event.target.checked; setSelected(previous=>checked ? [...previous,sample.id] : previous.filter(id=>id!==sample.id))}} /></td><td className="p-2 whitespace-nowrap font-medium"><div className="flex items-center gap-1" style={{paddingLeft:`${Math.min(depth, 6) * 16}px`}}>{hasChildren ? <SampleTreeToggle code={sample.code} expanded={isOpen} onToggle={()=>toggleTree(sample.id, isOpen)} /> : <span className="inline-block size-6 shrink-0" aria-hidden />}<span>{sample.code}{matches && checkObjects && sampleOutsideStudyObjects(sample, studyObjects) && <span className="block text-xs font-normal text-amber-800">Другой объект исследования</span>}</span>{!matches && <span className="text-xs font-normal text-muted-foreground">· родитель</span>}</div></td>{columns.map(field=><td key={field} className="max-w-48 p-2">{fieldValue(sample,field,registry.records)}</td>)}<td className="p-2 whitespace-nowrap">{fieldValue(sample,'stage')}</td><td className="p-2"><span className={sample.inspection === 'Не соответствует' ? 'text-red-700' : sample.inspection !== 'Соответствует' ? 'text-amber-800' : ''}>{sample.inspection}{sample.inspection !== 'Соответствует' ? ' ⚠' : ''}</span>{registry.fields.includes('inspectionNote') && sample.inspectionNote && (sample.inspection === 'С ограничениями' || sample.inspection === 'Не соответствует') && <p className="mt-1 max-w-56 whitespace-normal text-xs text-muted-foreground">Замечание: {sample.inspectionNote}</p>}</td></tr>)}</tbody></table>{!registry.loading && !registry.failed && filtered.length === 0 && <p className="p-5 text-sm text-muted-foreground">Подходящих проб не найдено. Проверьте тип пробы и фильтры.</p>}</div>
      <DialogFooter><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Отмена</Button><Button type="button" disabled={registry.loading || registry.failed || tooMany || mismatched.length > 0} onClick={()=>{onChange(selected); setOpen(false)}}>Применить ({selected.length})</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>
}
