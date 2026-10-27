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
  tasksTo: string
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

export function HomeProjectTasks({ organizationId, projectId, tasksTo }: Props) {
  const { t, i18n } = useTranslation()
  const tasks = useGetTasksQuery(
    { projectId, params: { limit: 5, offset: 0 } },
    { skip: false },
  )
  const rows = tasks.currentData?.results ?? []
  const base = workspaceHref(routes.scheduler.tasks(), 'project', { organizationId, projectId }, true)

  return (
    <section className="min-w-0 rounded-xl border border-border bg-card p-4" aria-busy={tasks.isFetching && !tasks.currentData}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{t('home.project-tasks')}</h2>
        <Link to={tasksTo} className="text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t('home.all-tasks')}</Link>
      </div>
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
        <div className="mt-3 max-w-full overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-2 py-2 font-medium">{t('home.task-name')}</th>
                <th className="px-2 py-2 font-medium">{t('home.task-status')}</th>
                <th className="px-2 py-2 font-medium">{t('home.task-due')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((task) => {
                const status = statusLabel(task, i18n.language)
                const due = dueLabel(task)
                const params = new URLSearchParams(base.split('?')[1] ?? '')
                params.set('task', task.slug)
                return (
                  <tr key={task.id} className="border-b border-border last:border-0">
                    <td className="px-2 py-2">
                      <Link
                        to={`${routes.scheduler.tasks()}?${params.toString()}`}
                        className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {task.name}
                      </Link>
                    </td>
                    <td className="px-2 py-2">
                      {status ? <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">{status}</span> : null}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{due}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
