import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGetTasksQuery } from '../../entities/task/model/taskSlice'
import type { Task } from '../../entities/task/model/types'
import { workspaceHref } from '../../features/org-project-selector/model/workspace-context'
import { routes } from '../../shared/lib/routes'
import { Button } from '../../shared/ui/button'

type Props = {
  organizationId: number
  projectId: number
}

function statusLabel(task: Task, language: string): string | null {
  const status = task.status
  if (!status) return null
  const label = language.startsWith('en')
    ? status.name_en || status.name
    : status.name_ru || status.name
  const text = label?.trim()
  return text ? text : null
}

function dueLabel(task: Task): string | null {
  const value = task.due_date_end
  if (typeof value !== 'string') return null
  const day = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const [year, month, date] = day.split('-')
  return `${date}.${month}.${year}`
}

export function HomeProjectTasks({ organizationId, projectId }: Props) {
  const { t, i18n } = useTranslation()
  const tasks = useGetTasksQuery(
    { projectId, params: { limit: 5, offset: 0 } },
    { skip: false },
  )
  const rows = tasks.currentData?.results ?? []
  const base = workspaceHref(routes.scheduler.tasks(), 'project', { organizationId, projectId }, true)

  return (
    <section className="rounded-xl border border-border bg-card p-4" aria-busy={tasks.isFetching && !tasks.currentData}>
      <h2 className="text-base font-semibold">{t('home.project-tasks')}</h2>
      {tasks.isError && (
        <div className="mt-3 space-y-2" role="alert">
          <p className="text-sm text-muted-foreground">{t('home.tasks-error')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void tasks.refetch()}>
            {t('workspace.retry')}
          </Button>
        </div>
      )}
      {!tasks.isError && !tasks.currentData && (
        <p className="mt-3 text-sm text-muted-foreground">{t('home.tasks-loading')}</p>
      )}
      {!tasks.isError && tasks.currentData && rows.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">{t('home.tasks-empty')}</p>
      )}
      {rows.length > 0 && (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((task) => {
            const status = statusLabel(task, i18n.language)
            const due = dueLabel(task)
            const params = new URLSearchParams(base.split('?')[1] ?? '')
            params.set('task', task.slug)
            return (
              <li key={task.id}>
                <Link
                  to={`${routes.scheduler.tasks()}?${params.toString()}`}
                  className="flex min-w-0 flex-col gap-0.5 rounded-md py-2 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="truncate text-sm font-medium">{task.name}</span>
                  {(status || due) && (
                    <span className="truncate text-xs text-muted-foreground">
                      {[status, due].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
