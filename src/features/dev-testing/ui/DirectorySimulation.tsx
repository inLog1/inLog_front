import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import {
  useGetDirectorySimulationQuery,
  useSaveDirectoryEmployeeMutation,
  useSyncDirectoryEmployeesMutation,
} from '../model/devApi'

const empty = {
  id: '',
  givenName: '',
  surname: '',
  email: '',
  organizationId: '',
  externalSubject: '',
}

export function DirectorySimulation() {
  const { t } = useTranslation()
  const directory = useGetDirectorySimulationQuery()
  const [saveEmployee, saveState] = useSaveDirectoryEmployeeMutation()
  const [syncEmployees, syncState] = useSyncDirectoryEmployeesMutation()
  const [form, setForm] = useState(empty)
  const [message, setMessage] = useState<string | null>(null)

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setMessage(null)
    try {
      await saveEmployee({
        id: form.id.trim(),
        givenName: form.givenName.trim(),
        surname: form.surname.trim(),
        email: form.email.trim(),
        organizationId: Number(form.organizationId),
        externalSubject: form.externalSubject.trim(),
        providerId: 'mock-corporate',
      }).unwrap()
      setForm(empty)
      setMessage(t('dev-panel.directory-saved'))
    } catch {
      setMessage(t('dev-panel.directory-failed'))
    }
  }

  const sync = async () => {
    setMessage(null)
    try {
      const report = await syncEmployees().unwrap()
      setMessage(t('dev-panel.directory-synced', { created: report.created.length, updated: report.updated.length }))
    } catch {
      setMessage(t('dev-panel.directory-failed'))
    }
  }

  return (
    <section className="mt-4 rounded-lg border border-dashed border-border p-3">
      <h2 className="text-sm font-semibold">{t('dev-panel.directory-title')}</h2>
      <p className="mt-1 text-muted-foreground">{t('dev-panel.directory-note')}</p>
      <form className="mt-3 space-y-2" onSubmit={(event) => void save(event)}>
        <Field label={t('dev-panel.directory-hr-id')} value={form.id} onChange={(value) => setForm({ ...form, id: value })} />
        <Field label={t('fields.first-name')} value={form.givenName} onChange={(value) => setForm({ ...form, givenName: value })} />
        <Field label={t('fields.surname')} value={form.surname} onChange={(value) => setForm({ ...form, surname: value })} />
        <Field label={t('login-page.work-email')} value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
        <label className="grid gap-1 text-xs">
          <Label>{t('dev-panel.directory-organization')}</Label>
          <select
            className="h-9 rounded-md border border-border bg-background px-2"
            value={form.organizationId}
            onChange={(event) => setForm({ ...form, organizationId: event.target.value })}
            required
          >
            <option value="">{t('access.choose')}</option>
            {directory.data?.organizations.map((item) => (
              <option key={item.id} value={item.id}>{item.shortName}</option>
            ))}
          </select>
        </label>
        <Field label={t('dev-panel.directory-subject')} value={form.externalSubject} onChange={(value) => setForm({ ...form, externalSubject: value })} />
        <Button type="submit" size="sm" variant="outline" disabled={saveState.isLoading}>{t('dev-panel.directory-add')}</Button>
      </form>
      <ul className="mt-3 space-y-1 text-xs">
        {directory.data?.employees.map((item) => (
          <li key={item.id}>{item.surname} {item.givenName} · {item.email} · {item.externalSubject}</li>
        ))}
      </ul>
      <Button type="button" size="sm" className="mt-3" onClick={() => void sync()} disabled={syncState.isLoading}>
        {t('dev-panel.directory-sync')}
      </Button>
      {message ? <p className="mt-2" role="status">{message}</p> : null}
    </section>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-xs">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} required />
    </label>
  )
}
