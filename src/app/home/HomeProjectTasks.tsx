import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { useGetTasksQuery } from '../../entities/task/model/taskSlice'
import type { Task } from '../../entities/task/model/types'
import { workspaceHref } from '../../features/org-project-selector/model/workspace-context'
import { routes } from '../../shared/lib/routes'
import { Button } from '../../shared/ui/button'

type Props = {
  organizationId: number
  projectId: number
  tasksTo: string
  projectName?: string
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

function taskHref(base: string, slug: string): string {
  const params = new URLSearchParams(base.split('?')[1] ?? '')
  params.set('task', slug)
  return `${routes.scheduler.tasks()}?${params.toString()}`
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--home-bg)] px-2.5 py-1 text-xs leading-4 text-[var(--home-title)]">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--home-secondary)]" aria-hidden />
      <span className="break-words">{label}</span>
    </span>
  )
}

export function HomeProjectTasks({ organizationId, projectId, tasksTo, projectName }: Props) {
  const { t, i18n } = useTranslation()
  const tasks = useGetTasksQuery(
    { projectId, params: { limit: 5, offset: 0 } },
    { skip: false },
  )
  const rows = tasks.currentData?.results ?? []
  const base = workspaceHref(routes.scheduler.tasks(), 'project', { organizationId, projectId }, true)
  const projectLabel = projectName?.trim()
  const linkClass = 'rounded-sm font-medium break-words underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <section className="home-surface min-w-0 p-4" aria-busy={tasks.isFetching && !tasks.currentData}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{t('home.project-tasks')}</h2>
          {projectLabel ? <p className="mt-0.5 break-words text-sm text-[var(--home-secondary)]">{projectLabel}</p> : null}
        </div>
        <Link to={tasksTo} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {t('home.all-tasks')}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      {tasks.isError && (
        <div className="mt-3 space-y-2" role="alert">
          <p className="text-sm">{t('home.tasks-error')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void tasks.refetch()}>
            {t('workspace.retry')}
          </Button>
        </div>
      )}
      {!tasks.isError && !tasks.currentData && (
        <p className="mt-3 text-sm text-[var(--home-secondary)]">{t('home.tasks-loading')}</p>
      )}
      {!tasks.isError && tasks.currentData && rows.length === 0 && (
        <p className="mt-3 text-sm text-[var(--home-secondary)]">{t('home.tasks-empty')}</p>
      )}
      {rows.length > 0 && (
        <>
          <ul className="mt-2 divide-y divide-[var(--home-border)] lg:hidden">
            {rows.map((task) => {
              const status = statusLabel(task, i18n.language)
              const due = dueLabel(task)
              return (
                <li key={task.id}>
                  <Link to={taskHref(base, task.slug)} className="flex flex-col gap-1.5 py-3 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="break-words font-medium">{task.name}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      {status ? <StatusBadge label={status} /> : null}
                      {due ? <span className="text-sm text-[var(--home-secondary)]">{due}</span> : null}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          <div className="mt-3 hidden lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--home-border)] text-left text-xs text-[var(--home-secondary)]">
                  <th scope="col" className="px-2 py-2 font-medium">{t('home.task-name')}</th>
                  <th scope="col" className="px-2 py-2 font-medium">{t('home.task-status')}</th>
                  <th scope="col" className="w-32 px-2 py-2 font-medium">{t('home.task-due')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((task) => {
                  const status = statusLabel(task, i18n.language)
                  const due = dueLabel(task)
                  return (
                    <tr key={task.id} className="border-b border-[var(--home-border)] last:border-0">
                      <td className="px-2 py-3">
                        <Link to={taskHref(base, task.slug)} className={linkClass}>
                          {task.name}
                        </Link>
                      </td>
                      <td className="px-2 py-3">
                        {status ? <StatusBadge label={status} /> : null}
                      </td>
                      <td className="px-2 py-3 text-[var(--home-secondary)]">{due}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
