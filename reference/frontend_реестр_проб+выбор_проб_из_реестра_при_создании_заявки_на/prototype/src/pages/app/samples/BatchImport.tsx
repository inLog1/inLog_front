import { useState, type ChangeEvent } from 'react'
import { Download, Upload } from 'lucide-react'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { Input } from '../../../shared/ui/input'
import { batchSamples, countKnownMarkings, parseBatch, type BatchResult } from './batch'
import type { Sample } from './model'
import type { RegistrationDocuments, SampleAttachment } from './attachments'
import { emptyDocumentDraft, prepareDocuments } from './documentDraft'
import { RegistrationDocumentsField } from './RegistrationDocuments'

export function BatchImport({ records, existingDocuments, organizationId, actor, busy, onClose, onBack, onSave }: {
  records: Sample[]; existingDocuments: SampleAttachment[]; organizationId: number; actor: string; busy: boolean; onClose: () => void; onBack: () => void; onSave: (items: Sample[], documents?: RegistrationDocuments) => Promise<boolean>
}) {
  const [result, setResult] = useState<BatchResult | null>(null)
  const [name, setName] = useState('')
  const [reading, setReading] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [errorsOnly, setErrorsOnly] = useState(true)
  const [documents, setDocuments] = useState(emptyDocumentDraft)
  const [documentError, setDocumentError] = useState('')
  const invalid = result?.rows.filter(row => row.errors.length).length ?? 0
  const knownMarkings = result ? countKnownMarkings(result.rows, records, organizationId) : 0
  const ready = result != null && !result.error && result.rows.length > 0 && invalid === 0
  async function download() {
    setPreparing(true)
    try {
      const { createSampleTemplate } = await import('./workbook')
      const data = await createSampleTemplate()
      const url = URL.createObjectURL(new Blob([data], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}))
      const link = document.createElement('a'); link.href = url; link.download = 'шаблон-реестра-проб.xlsx'; link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setResult({rows:[], error:'Не удалось подготовить шаблон. Попробуйте ещё раз.'}) }
    finally { setPreparing(false) }
  }
  async function load(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    setResult(null)
    if (!file) { setName(''); return }
    setName(file.name)
    if (file.size > 2 * 1024 * 1024) { setResult({rows:[], error:'Файл больше 2 МБ.'}); return }
    if (!/\.(xlsx|csv)$/i.test(file.name)) { setResult({rows:[], error:'Выберите файл XLSX или CSV.'}); return }
    setReading(true)
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const { readSampleWorkbook } = await import('./workbook')
        setResult(await readSampleWorkbook(await file.arrayBuffer(), records, organizationId))
      } else setResult(parseBatch(await file.text(), records, organizationId))
    }
    catch { setResult({rows:[], error:'Не удалось прочитать файл. Проверьте формат XLSX или CSV UTF-8.'}) }
    finally { setReading(false) }
  }
  async function submit() {
    if (!ready || !result || busy || reading) return
    setReading(true); setDocumentError('')
    try {
      const files = await prepareDocuments(documents)
      const items = batchSamples(result.rows, organizationId, new Date().toISOString(), actor, records)
      if (await onSave(items, files)) onClose()
    } catch (error) { setDocumentError(error instanceof Error ? error.message : 'Не удалось прочитать документы.') }
    finally { setReading(false) }
  }
  return <Card className="overflow-hidden shadow-sm">
      <div className="border-b p-6"><h2 className="text-lg font-semibold">Загрузка партии проб</h2><p className="mt-1 text-sm text-muted-foreground">Одна строка — одна проба. Все пробы будут зарегистрированы в текущей организации со статусом «Поступила». Для запланированного отбора используйте ручной ввод.</p></div>
      <div className="space-y-4 p-6">
        <div className="space-y-2 text-sm text-muted-foreground"><p>1. Скачайте шаблон XLSX, заполните лист «Пробы» в Excel и сохраните файл. Не меняйте названия столбцов.</p><p>2. Выберите файл и проверьте строки. Даты: ДД.ММ.ГГГГ или ГГГГ-ММ-ДД; тип пробы выберите из списка в шаблоне. За один раз — до 1000 строк. Также можно загрузить CSV UTF-8.</p><p>Обязательны тип пробы, месторождение, скважина, дата поступления и местонахождение. ID присваивается автоматически при регистрации. Исходную маркировку можно указать дополнительно; значения столбцов «ID» или «Лабораторный шифр» в старых шаблонах сохранятся как исходная маркировка.</p></div>
        <Button type="button" variant="outline" onClick={() => void download()} disabled={preparing}><Download aria-hidden /> {preparing ? 'Подготовка…' : 'Скачать шаблон XLSX'}</Button>
        <p className="text-sm text-muted-foreground">Для подпробы укажите ID уже зарегистрированной родительской пробы в соответствующем столбце. Тип, месторождение, скважина, пласт, интервал и дата отбора подпробы наследуются от родителя: оставьте эти поля пустыми или укажите те же значения. Интервал подпробы можно указать отдельно. Для самостоятельной пробы оставьте ID родителя пустым.</p>
        <label className="grid gap-2 text-sm font-medium">Файл с пробами<Input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={event => void load(event)} disabled={busy || reading} /></label>
        {name && <p className="text-xs text-muted-foreground">Выбран файл: {name}</p>}
        {reading ? <p role="status" className="text-sm text-muted-foreground">Читаем файл…</p> : null}
        {result?.error ? <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{result.error}</p> : null}
        <RegistrationDocumentsField draft={documents} onChange={setDocuments} existing={existingDocuments} batch disabled={busy || reading} />
        {documentError && <p role="alert" className="text-sm text-destructive">{documentError}</p>}
        {knownMarkings > 0 && <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">В реестре уже встречается исходная маркировка у строк: {knownMarkings}. Проверьте, не загружали ли вы эти пробы ранее. Совпадение маркировки не обязательно означает повтор.</p>}
        {result && result.rows.length > 0 ? <section aria-label="Проверка файла" className="space-y-3"><p className="text-sm"><strong>{name}</strong>: строк с пробами — {result.rows.length}; {invalid ? `с ошибками — ${invalid}` : 'ошибок не найдено'}. {invalid ? 'Исправьте файл и выберите его заново: без этого ни одна строка не будет сохранена.' : 'ID будут присвоены при регистрации; входной контроль не проведён.'}</p>{invalid > 0 && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={errorsOnly} onChange={event => setErrorsOnly(event.target.checked)} /> Показать только строки с ошибками</label>}<div className="max-h-64 overflow-auto rounded-md border"><table className="w-full min-w-[580px] text-left text-sm"><thead className="sticky top-0 bg-muted"><tr><th className="p-2">Строка</th><th className="p-2">Исходная маркировка</th><th className="p-2">Тип пробы / скважина</th><th className="p-2">Проверка</th></tr></thead><tbody>{result.rows.filter(row => !invalid || !errorsOnly || row.errors.length > 0).map(row=><tr key={row.line} className="border-t align-top"><td className="p-2">{row.line}</td><td className="p-2">{row.fields.code || '—'}</td><td className="p-2">{row.fields.kind || '—'} / {row.fields.well || '—'}</td><td className={`p-2 ${row.errors.length ? 'text-destructive' : 'text-muted-foreground'}`}>{row.errors.length ? row.errors.join('; ') : 'Готово'}</td></tr>)}</tbody></table></div></section> : null}
      </div>
      <div className="flex shrink-0 flex-wrap justify-between gap-2 border-t p-4 sm:px-6"><Button type="button" variant="ghost" onClick={onBack} disabled={busy || reading}>Назад к выбору</Button><div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose} disabled={busy || reading}>Отмена</Button><Button type="button" onClick={() => void submit()} disabled={!ready || busy || reading}><Upload aria-hidden /> Зарегистрировать{ready ? ` (${result.rows.length})` : ''}</Button></div></div>
  </Card>
}
