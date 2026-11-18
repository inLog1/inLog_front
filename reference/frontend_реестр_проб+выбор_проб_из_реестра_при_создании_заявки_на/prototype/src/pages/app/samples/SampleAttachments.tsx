import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { FileText, Image as ImageIcon, Paperclip, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { ensureMockState, updateMockState } from '../../../app/mocks/db/repository'
import type { MockState } from '../../../app/mocks/db/types'
import { documentMockNamespace, documentScenario } from '../../../shared/config/mock-scenario'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { routes } from '../../../shared/lib/routes'
import { useWorkspaceHref } from '../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { addSampleAttachments, attachmentMime, ATTACHMENT_TYPES, displayAttachmentType, linkSampleAttachment, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_FILES, MAX_ATTACHMENT_TOTAL_BYTES, unlinkSampleAttachment, type AttachmentActor, type AttachmentType, type SampleAttachment } from './attachments'
import { initialSamples, withDetailedDemoSamples, type Sample } from './model'

const controlStyle = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground'
const labelStyle = 'grid gap-1.5 text-sm font-medium'

export function SampleAttachments({ sample, samples, canUpdate, userId, actor, onRecords }: {
  sample: Sample; samples: Sample[]; canUpdate: boolean; userId: number | null; actor: string; onRecords: (records: Sample[]) => void
}) {
  const [attachments, setAttachments] = useState<SampleAttachment[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState(false)
  const [kind, setKind] = useState<AttachmentType>('Акт приёма-передачи')
  const [number, setNumber] = useState('')
  const [date, setDate] = useState('')
  const [chosenFiles, setChosenFiles] = useState<File[]>([])
  const [fileInputKey, setFileInputKey] = useState(0)
  const [selected, setSelected] = useState<string[]>([sample.id])
  const [search, setSearch] = useState('')
  const [confirmUnlink, setConfirmUnlink] = useState<string | null>(null)
  const href = useWorkspaceHref()

  useEffect(() => {
    let active = true
    void ensureMockState(documentMockNamespace()).then(result => {
      if (!active) return
      if (!result.ok) { setLoadError(true); return }
      setAttachments(result.state.sampleAttachments ?? [])
    }).catch(() => { if (active) setLoadError(true) })
    return () => { active = false }
  }, [sample.id, sample.organizationId])

  const current = (attachments ?? []).filter(file => file.organizationId === sample.organizationId && file.sampleIds.includes(sample.id))
  const existing = (attachments ?? []).filter(file => file.organizationId === sample.organizationId && !file.sampleIds.includes(sample.id))
  const otherSamples = useMemo(() => samples.filter(item => item.id !== sample.id && item.code.toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru'))), [samples, sample.id, search])

  async function write(change: (state: MockState, context: AttachmentActor) => MockState): Promise<boolean> {
    if (!canUpdate || busy) return false
    setBusy(true)
    try {
      const next = await updateMockState(state => {
        const records = withDetailedDemoSamples(state.samples ?? initialSamples(documentScenario() === 'demo'), documentScenario() === 'demo')
        return change({ ...state, samples:records }, { organizationId:sample.organizationId, userId, actor, at:new Date().toISOString() })
      }, documentMockNamespace())
      setAttachments(next.sampleAttachments ?? [])
      onRecords(next.samples ?? [])
      return true
    } catch (error) {
      const code = error instanceof Error ? error.message : ''
      const message: Record<string, string> = {
        forbidden:'Нет прав на изменение документов.', 'missing-sample':'Одна из выбранных проб недоступна. Обновите страницу.',
        'missing-file':'Файл больше недоступен. Обновите страницу.', 'invalid-file':'Проверьте формат файла и его тип.',
        'file-size':'Файл пуст или превышает 10 МБ.', 'total-size':'Общий размер файлов превышает 30 МБ.',
        'file-count':'Выберите от 1 до 10 файлов.',
      }
      toast.error(message[code] ?? 'Не удалось сохранить файлы в тестовую базу.')
      return false
    } finally { setBusy(false) }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || reading) return
    if (!chosenFiles.length || chosenFiles.length > MAX_ATTACHMENT_FILES) { toast.error('Выберите от 1 до 10 файлов.'); return }
    if (chosenFiles.some(file => !file.size || file.size > MAX_ATTACHMENT_BYTES)) { toast.error('Каждый файл должен быть не пустым и не больше 10 МБ.'); return }
    if (chosenFiles.reduce((total, file) => total + file.size, 0) > MAX_ATTACHMENT_TOTAL_BYTES) { toast.error('Общий размер файлов не должен превышать 30 МБ.'); return }
    if (chosenFiles.some(file => { const mime = attachmentMime(file.name, file.type); return !mime || (kind === 'Фото входного контроля' && !mime.startsWith('image/')) })) { toast.error(kind === 'Фото входного контроля' ? 'Для фотографии выберите JPG, PNG или WEBP.' : 'Выберите PDF, JPG, PNG, WEBP, DOCX или XLSX.'); return }
    setReading(true)
    try {
      const files = await Promise.all(chosenFiles.map(async file => ({ filename:file.name, mimeType:file.type, bytes:new Uint8Array(await file.arrayBuffer()) })))
      if (await write((state, context) => addSampleAttachments(state, context, selected, kind, number, date, files))) {
        setChosenFiles([]); setFileInputKey(value => value + 1); setNumber(''); setDate(''); setSelected([sample.id]); setSearch(''); setAdding(false)
        toast.success(files.length === 1 ? 'Файл добавлен' : `Добавлено файлов: ${files.length}`)
      }
    } catch { toast.error('Не удалось прочитать файл. Попробуйте выбрать его ещё раз.') }
    finally { setReading(false) }
  }

  async function link(fileId: string) {
    if (await write((state, context) => linkSampleAttachment(state, context, sample.id, fileId))) toast.success('Файл привязан к пробе')
  }
  async function unlink(fileId: string) {
    if (await write((state, context) => unlinkSampleAttachment(state, context, sample.id, fileId))) { setConfirmUnlink(null); toast.success('Файл убран из карточки пробы') }
  }

  return <section aria-labelledby="sample-files-title">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6"><div><h2 id="sample-files-title" className="text-base font-semibold">Документы и фотографии</h2><p className="mt-1 text-sm text-muted-foreground">Акты, ведомости, сопроводительные документы и фото входного контроля.</p></div>{canUpdate && !adding && <Button type="button" variant="outline" size="sm" disabled={attachments === null} onClick={()=>setAdding(true)}><Plus aria-hidden /> Добавить файлы</Button>}</div>
    <div className="space-y-4 px-5 py-5 sm:px-6">
    {loadError ? <p className="text-sm text-destructive">Не удалось загрузить файлы. Обновите страницу.</p> : attachments === null ? <p className="text-sm text-muted-foreground">Загрузка файлов…</p> : current.length === 0 ? <p className="text-sm text-muted-foreground">Прикреплённых файлов пока нет. Реквизиты документа можно указать при регистрации; сам файл можно добавить в любой момент.</p> : <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Документ / файл</th><th className="px-3 py-2 font-medium">Связанные пробы</th><th className="px-3 py-2 font-medium"><span className="sr-only">Действия</span></th></tr></thead><tbody>{current.map(file=>{
      const related = samples.filter(item => file.sampleIds.includes(item.id))
      return <tr key={file.id} className="border-t border-border align-top"><td className="px-3 py-3"><div className="flex gap-2"><span className="mt-0.5 text-muted-foreground">{file.mimeType.startsWith('image/') ? <ImageIcon className="h-4 w-4" aria-hidden /> : <FileText className="h-4 w-4" aria-hidden />}</span><div><p className="break-all font-medium">{file.filename}</p><p className="mt-1 text-xs text-muted-foreground">{displayAttachmentType(file.type)}{file.documentNumber ? ` · № ${file.documentNumber}` : ''}{file.documentDate ? ` · ${formatDate(file.documentDate)}` : ''}</p><p className="mt-1 text-xs text-muted-foreground">{formatWhen(file.uploadedAt)} · {formatSize(file.size)}</p></div></div></td><td className="px-3 py-3"><details><summary className="cursor-pointer text-xs text-muted-foreground">Проб: {file.sampleIds.length}</summary><ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">{related.map(item=><li key={item.id}>{item.id === sample.id ? <span className="text-xs">{item.code} · текущая</span> : <Link className="text-xs text-primary underline-offset-4 hover:underline" to={href(routes.samples.detail(item.id), 'organization')}>{item.code}</Link>}</li>)}{related.length < file.sampleIds.length && <li className="text-xs text-muted-foreground">Часть проб недоступна</li>}</ul></details></td><td className="px-2 py-2"><div className="flex flex-wrap justify-end gap-1">{(file.mimeType === 'application/pdf' || file.mimeType.startsWith('image/')) && <Button type="button" size="sm" variant="ghost" onClick={()=>openFile(file, false)}>Открыть</Button>}<Button type="button" size="sm" variant="ghost" onClick={()=>openFile(file, true)}>Скачать</Button>{canUpdate && confirmUnlink !== file.id && <Button type="button" size="icon" variant="ghost" aria-label={`Убрать ${file.filename} из пробы`} disabled={busy} onClick={()=>setConfirmUnlink(file.id)}><Trash2 aria-hidden /></Button>}</div>{confirmUnlink === file.id && <div className="mt-2 rounded-md bg-muted/60 p-2 text-xs"><p>Убрать файл из этой пробы?{file.sampleIds.length > 1 ? ' В других пробах он останется.' : ''}</p><div className="mt-2 flex gap-2"><Button type="button" size="sm" variant="outline" onClick={()=>setConfirmUnlink(null)}>Отмена</Button><Button type="button" size="sm" variant="destructive" disabled={busy} onClick={()=>void unlink(file.id)}>Убрать</Button></div></div>}</td></tr>
    })}</tbody></table></div>}
    {canUpdate && adding && <form onSubmit={event=>void upload(event)} className="space-y-4 rounded-lg border border-border bg-muted/20 p-4"><h3 className="text-sm font-semibold">Добавить документы или фотографии</h3><div className="grid gap-4 sm:grid-cols-2"><label className={labelStyle}>Тип вложения<select className={controlStyle} value={kind} onChange={event=>{const value=event.target.value as AttachmentType; setKind(value); if (value === 'Фото входного контроля') {setNumber(''); setDate('')}}} disabled={busy || reading}>{ATTACHMENT_TYPES.map(value=><option key={value}>{value}</option>)}</select></label>{kind !== 'Фото входного контроля' && <><label className={labelStyle}>Номер документа <span className="sr-only">необязательно</span><Input value={number} onChange={event=>setNumber(event.target.value)} disabled={busy || reading} placeholder="Если есть" /></label><label className={labelStyle}>Дата документа <span className="sr-only">необязательно</span><Input type="date" value={date} onChange={event=>setDate(event.target.value)} disabled={busy || reading} /></label></>}<label className={labelStyle}>Файлы<Input key={fileInputKey} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx" onChange={event=>setChosenFiles(Array.from(event.target.files ?? []))} disabled={busy || reading} /></label></div><p className="text-xs text-muted-foreground">PDF, JPG, PNG, WEBP, DOCX или XLSX; до 10 файлов, до 10 МБ каждый и 30 МБ всего. Для фото — JPG, PNG или WEBP.</p>{chosenFiles.length > 0 && <p className="text-sm">Выбрано файлов: {chosenFiles.length}</p>}
      <details className="rounded-md border border-border bg-background p-3"><summary className="cursor-pointer text-sm font-medium">Привязать к другим пробам <span className="font-normal text-muted-foreground">· выбрано {selected.length}</span></summary><p className="mt-2 text-xs text-muted-foreground">Текущая проба {sample.code} включена. Выберите другие пробы, к которым относится этот же документ.</p><Input className="mt-3" aria-label="Поиск проб для документа" placeholder="Поиск по ID пробы" value={search} onChange={event=>setSearch(event.target.value)} disabled={busy} /><div className="mt-2 flex flex-wrap gap-2"><Button type="button" size="sm" variant="ghost" disabled={busy || !otherSamples.length} onClick={()=>setSelected(previous=>[...new Set([...previous,...otherSamples.map(item=>item.id)])])}>Выбрать найденные</Button><Button type="button" size="sm" variant="ghost" disabled={busy || selected.length === 1} onClick={()=>setSelected([sample.id])}>Снять выбор</Button></div><div className="mt-2 max-h-48 space-y-2 overflow-y-auto">{otherSamples.length ? otherSamples.map(item=><label key={item.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(item.id)} disabled={busy} onChange={event=>{const checked=event.target.checked; setSelected(previous=>checked ? [...new Set([...previous,item.id])] : previous.filter(id=>id!==item.id))}} /><span className="break-words">{item.code} <span className="text-muted-foreground">· {item.field}, скв. {item.well.replace(/^\s*№\s*/, '')}</span></span></label>) : <p className="text-xs text-muted-foreground">Другие пробы не найдены.</p>}</div></details>
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy || reading || !chosenFiles.length}><Paperclip aria-hidden /> {reading ? 'Загрузка…' : 'Прикрепить'}</Button><Button type="button" variant="outline" disabled={busy || reading} onClick={()=>setAdding(false)}>Отмена</Button></div>
    </form>}
    {canUpdate && existing.length > 0 && <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-medium">Прикрепить файл из другой пробы</summary><p className="mt-2 text-xs text-muted-foreground">Выберите ранее загруженный файл этой организации. Дополнительная копия не создаётся.</p><ul className="mt-2 max-h-48 divide-y divide-border overflow-y-auto">{existing.map(file=><li key={file.id} className="flex items-center justify-between gap-2 py-2"><div className="min-w-0"><p className="break-words text-sm">{file.filename}</p><p className="text-xs text-muted-foreground">{displayAttachmentType(file.type)} · {formatWhen(file.uploadedAt)}</p></div><Button type="button" variant="outline" size="sm" disabled={busy} onClick={()=>void link(file.id)}>Прикрепить</Button></li>)}</ul></details>}
    </div>
  </section>
}

function formatSize(size: number): string { return size < 1024 * 1024 ? `${Math.max(1, Math.ceil(size / 1024))} КБ` : `${(size / (1024 * 1024)).toFixed(1)} МБ` }
function formatDate(value: string): string { const [year, month, day] = value.split('-'); return year && month && day ? `${day}.${month}.${year}` : value }
function formatWhen(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ru-RU', { dateStyle:'short', timeStyle:'short' }).format(date) }
function openFile(file: SampleAttachment, download: boolean) {
  const bytes = file.bytes.slice().buffer as ArrayBuffer
  const url = URL.createObjectURL(new Blob([bytes], { type:file.mimeType }))
  const anchor = document.createElement('a')
  anchor.href = url
  if (download) anchor.download = file.filename
  else { anchor.target = '_blank'; anchor.rel = 'noopener noreferrer' }
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
