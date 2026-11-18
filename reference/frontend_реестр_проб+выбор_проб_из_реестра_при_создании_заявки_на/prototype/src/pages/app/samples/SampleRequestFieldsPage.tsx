import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronLeft, LockKeyhole } from 'lucide-react'
import { toast } from 'sonner'
import { selectSession } from '../../../entities/session'
import { ensureMockState, updateMockState } from '../../../app/mocks/db/repository'
import { WorkspaceStatus } from '../../../features/org-project-selector'
import { useWorkspaceHref } from '../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { useWorkspaceSection } from '../../../features/org-project-selector/model/useWorkspaceSection'
import { documentMockNamespace } from '../../../shared/config/mock-scenario'
import { routes } from '../../../shared/lib/routes'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { PageHeader, WorkPage } from '../../../shared/ui/page'
import { mayDeleteSample } from './access'
import { getRequestSampleFields, REQUEST_SAMPLE_FIELDS, REQUIRED_REQUEST_SAMPLE_FIELDS, setRequestSampleFields, type RequestSampleField } from './requestFields'

const fieldGroups: { title:string; description:string; keys:RequestSampleField[] }[] = [
  { title:'Идентификация', description:'Как отличить пробу от других.', keys:['sampleType','externalCode'] },
  { title:'Происхождение и отбор', description:'Откуда и когда отобрана проба.', keys:['field','well','formation','interval','collectedAt'] },
  { title:'Поступление и хранение', description:'Сведения о передаче и размещении пробы.', keys:['receivedAt','location','container','quantity','supplier','document','conditions'] },
  { title:'Входной контроль', description:'Дополнительные сведения о результате проверки.', keys:['inspectionNote'] },
]

export function SampleRequestFieldsPage() {
  const section = useWorkspaceSection('organization', { resource:'requests', action:'read' })
  if (section.kind !== 'ready') return <WorkspaceStatus status={section.status} reason={section.reason} onRetry={section.refetch} />
  return <Settings organizationId={section.organizationId} key={section.organizationId} />
}

function Settings({ organizationId }: { organizationId: number }) {
  const { subjectId } = useSelector(selectSession)
  const href = useWorkspaceHref()
  const listHref = href(routes.samples.list(), 'organization')
  const [fields, setFields] = useState<RequestSampleField[] | null>(null)
  const [savedFields, setSavedFields] = useState<RequestSampleField[] | null>(null)
  const [allowed, setAllowed] = useState(false)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    void ensureMockState(documentMockNamespace()).then(result => {
      if (!active) return
      if (!result.ok) { setFailed(true); return }
      setAllowed(mayDeleteSample(result.state, subjectId, organizationId))
      const stored = getRequestSampleFields(result.state, organizationId)
      setFields(stored)
      setSavedFields(stored)
    }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [organizationId, subjectId])
  async function save() {
    if (!fields || !allowed || busy) return
    setBusy(true)
    try {
      const next = await updateMockState(state => setRequestSampleFields(state, subjectId, organizationId, fields), documentMockNamespace())
      const stored = getRequestSampleFields(next, organizationId)
      setFields(stored)
      setSavedFields(stored)
      toast.success('Настройки сохранены')
    } catch (error) { toast.error(error instanceof Error && error.message === 'forbidden' ? 'Нет прав на изменение настройки' : 'Не удалось сохранить настройки') }
    finally { setBusy(false) }
  }
  const dirty = !!fields && !!savedFields && (fields.length !== savedFields.length || fields.some(field => !savedFields.includes(field)))
  return <WorkPage>
    <PageHeader breadcrumbs={[{label:'Реестр проб',to:listHref},{label:'Поля для заявок'}]} title="Поля проб для заявок" description="Настройте, какие сведения о пробах вашей организации будут видны участникам заявки." />
    {failed ? <p className="text-sm text-destructive">Не удалось загрузить настройки. Обновите страницу.</p> : !fields ? <p className="text-sm text-muted-foreground">Загрузка…</p> : !allowed ? <Card className="p-6 text-sm">Настраивать поля могут администратор организации и суперадминистратор.</Card> : <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <Card className="min-w-0 overflow-hidden shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6"><div><h2 className="text-base font-semibold">Доступные сведения</h2><p className="mt-1 text-sm text-muted-foreground">Отметьте поля, которые нужны для работы с пробами в заявках.</p></div><div className="flex flex-wrap gap-1"><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={()=>setFields(REQUEST_SAMPLE_FIELDS.map(field=>field.key))}>Выбрать все</Button><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={()=>setFields([...REQUIRED_REQUEST_SAMPLE_FIELDS])}>Только обязательные</Button></div></div>
        <div className="space-y-6 px-5 py-5 sm:px-6">
          <section><div className="mb-3 flex items-start gap-2"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /><div><h3 className="text-sm font-semibold">Всегда доступны</h3><p className="mt-1 text-xs text-muted-foreground">Эти поля нужны для идентификации пробы, её происхождения и оценки состояния.</p></div></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{REQUIRED_REQUEST_SAMPLE_FIELDS.map(key=><div key={key} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm"><CheckCircle2 className="size-4 shrink-0 text-muted-foreground" aria-hidden /><span>{REQUEST_SAMPLE_FIELDS.find(field=>field.key===key)?.label}</span></div>)}</div></section>
          {fieldGroups.map(group=><section key={group.title} className="border-t border-border pt-5"><h3 className="text-sm font-semibold">{group.title}</h3><p className="mt-1 text-xs text-muted-foreground">{group.description}</p><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{group.keys.map(key=>{const label=REQUEST_SAMPLE_FIELDS.find(field=>field.key===key)?.label; const checked=fields.includes(key); return <label key={key} className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors ${checked ? 'border-primary/30 bg-primary/5' : 'border-border hover:bg-muted/40'}`}><input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={checked} disabled={busy} onChange={event=>setFields(previous => previous ? event.target.checked ? [...previous, key] : previous.filter(value=>value!==key) : previous)} /><span>{label}</span></label>})}</div></section>)}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4 sm:px-6"><Button type="button" disabled={busy || !dirty} onClick={()=>void save()}>{busy ? 'Сохранение…' : 'Сохранить изменения'}</Button>{dirty && <Button type="button" variant="ghost" disabled={busy} onClick={()=>setFields(savedFields ? [...savedFields] : null)}>Отменить изменения</Button>}<Button type="button" variant="outline" asChild><Link to={listHref}><ChevronLeft aria-hidden /> К реестру</Link></Button><span role="status" className="text-xs text-muted-foreground">{dirty ? 'Есть несохранённые изменения' : 'Настройки сохранены'}</span></div>
      </Card>
      <Card className="space-y-4 p-5 shadow-sm lg:sticky lg:top-4"><div><h2 className="text-sm font-semibold">Будет доступно в заявке</h2><p className="mt-1 text-xs text-muted-foreground">Выбрано полей: {fields.length} из {REQUEST_SAMPLE_FIELDS.length}</p></div><ul className="max-h-64 space-y-1.5 overflow-y-auto text-sm text-muted-foreground">{REQUEST_SAMPLE_FIELDS.filter(field=>fields.includes(field.key)).map(field=><li key={field.key} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden /><span>{field.label}</span></li>)}</ul><p className="border-t border-border pt-3 text-xs text-muted-foreground">Настройка действует для проб текущей организации, выбранных в заявке. Изменения вступят в силу после сохранения.</p></Card>
    </div>}
  </WorkPage>
}
