import type { MockTask, MockTaskComment, MockTaskFile, MockTaskStatus, MockTaskTag } from '../db/types'

/**
 * Demo tasks for a fresh document.
 * Projects A and B each have a task named by the same slug and different content.
 * Saved documents receive this catalog only when the task arrays are missing.
 */
export function taskFixtures(): {
  taskStatuses: MockTaskStatus[]
  taskTags: MockTaskTag[]
  tasks: MockTask[]
  taskComments: MockTaskComment[]
  taskFiles: MockTaskFile[]
} {
  const statuses: MockTaskStatus[] = [
    { id: 501, projectId: 1001, nameEn: 'No status', nameRu: 'Без статуса', position: 1 },
    { id: 502, projectId: 1001, nameEn: 'In progress', nameRu: 'В работе', position: 2 },
    { id: 503, projectId: 1001, nameEn: 'Closed', nameRu: 'Закрыта', position: 3 },
    { id: 511, projectId: 1002, nameEn: 'No status', nameRu: 'Без статуса', position: 1 },
    { id: 512, projectId: 1002, nameEn: 'In progress', nameRu: 'В работе', position: 2 },
    { id: 513, projectId: 1002, nameEn: 'Closed', nameRu: 'Закрыта', position: 3 },
    { id: 521, projectId: 1003, nameEn: 'No status', nameRu: 'Без статуса', position: 1 },
    { id: 522, projectId: 1003, nameEn: 'In progress', nameRu: 'В работе', position: 2 },
    { id: 523, projectId: 1003, nameEn: 'Closed', nameRu: 'Закрыта', position: 3 },
  ]
  const tags: MockTaskTag[] = [
    { id: 801, projectId: 1001, name: 'геология', isSystemic: false },
    { id: 802, projectId: 1001, name: 'лаборатория', isSystemic: false },
    { id: 811, projectId: 1002, name: 'геология', isSystemic: false },
    { id: 812, projectId: 1002, name: 'поле', isSystemic: false },
  ]
  const tasks: MockTask[] = [
    {
      id: 9001,
      projectId: 1001,
      slug: 'shared-sample',
      name: 'Образец А-1',
      description: 'Задача лаборатории А, проект А-1',
      creatorId: 3,
      priority: 'important',
      statusId: 501,
      statusPosition: 1,
      dueDateStart: '2026-03-01',
      dueDateEnd: '2026-03-20',
      parentId: null,
      archived: false,
      isTemplate: false,
      tagIds: [801],
      doers: [{ id: 1, userId: 7 }],
      supervisor: { id: 1, userId: 3 },
      createdAt: '2026-03-01T08:00:00.000Z',
    },
    {
      id: 9002,
      projectId: 1001,
      slug: 'a1-child',
      name: 'Подзадача А-1',
      description: 'Дочерняя задача проекта А-1',
      creatorId: 3,
      priority: 'medium',
      statusId: 501,
      statusPosition: 1,
      dueDateStart: '2026-03-02',
      dueDateEnd: '2026-03-12',
      parentId: 9001,
      archived: false,
      isTemplate: false,
      tagIds: [],
      doers: [],
      supervisor: null,
      createdAt: '2026-03-02T08:00:00.000Z',
    },
    {
      id: 9003,
      projectId: 1001,
      slug: 'a1-closed',
      name: 'Закрытая А-1',
      description: 'Закрытая задача проекта А-1',
      creatorId: 3,
      priority: 'low',
      statusId: 503,
      statusPosition: 1,
      dueDateStart: '2026-02-01',
      dueDateEnd: '2026-02-10',
      parentId: null,
      archived: false,
      isTemplate: false,
      tagIds: [],
      doers: [],
      supervisor: null,
      createdAt: '2026-02-01T08:00:00.000Z',
    },
    {
      id: 9004,
      projectId: 1001,
      slug: 'a1-template',
      name: 'Шаблон А-1',
      description: 'Шаблон проекта А-1',
      creatorId: 3,
      priority: 'medium',
      statusId: 501,
      statusPosition: 1,
      dueDateStart: '2026-04-01',
      dueDateEnd: '2026-04-10',
      parentId: null,
      archived: false,
      isTemplate: true,
      tagIds: [],
      doers: [],
      supervisor: null,
      createdAt: '2026-04-01T08:00:00.000Z',
    },
    {
      id: 9101,
      projectId: 1002,
      slug: 'shared-sample',
      name: 'Образец Б-1',
      description: 'Задача лаборатории Б, проект Б-1',
      creatorId: 4,
      priority: 'critical',
      statusId: 511,
      statusPosition: 1,
      dueDateStart: '2026-05-01',
      dueDateEnd: '2026-05-15',
      parentId: null,
      archived: false,
      isTemplate: false,
      tagIds: [811],
      doers: [{ id: 2, userId: 4 }],
      supervisor: { id: 2, userId: 4 },
      createdAt: '2026-05-01T08:00:00.000Z',
    },
    {
      id: 9102,
      projectId: 1002,
      slug: 'b1-only',
      name: 'Только Б',
      description: 'Задача, которой нет в лаборатории А',
      creatorId: 4,
      priority: 'medium',
      statusId: 512,
      statusPosition: 1,
      dueDateStart: '2026-05-02',
      dueDateEnd: '2026-05-18',
      parentId: null,
      archived: false,
      isTemplate: false,
      tagIds: [],
      doers: [],
      supervisor: null,
      createdAt: '2026-05-02T08:00:00.000Z',
    },
    {
      id: 9201,
      projectId: 1003,
      slug: 'a2-only',
      name: 'Задача А-2',
      description: 'Задача второго проекта лаборатории А',
      creatorId: 3,
      priority: 'important',
      statusId: 521,
      statusPosition: 1,
      dueDateStart: '2026-06-01',
      dueDateEnd: '2026-06-12',
      parentId: null,
      archived: false,
      isTemplate: false,
      tagIds: [],
      doers: [],
      supervisor: null,
      createdAt: '2026-06-01T08:00:00.000Z',
    },
  ]
  const comments: MockTaskComment[] = [
    {
      id: 1,
      taskId: 9001,
      projectId: 1001,
      userId: 3,
      text: 'Комментарий к образцу А-1',
      createdAt: '2026-03-03T09:00:00.000Z',
    },
  ]
  return { taskStatuses: statuses, taskTags: tags, tasks, taskComments: comments, taskFiles: [] }
}

export function taskFixturesForProjects(projectIds: readonly number[]) {
  const allow = new Set(projectIds)
  const full = taskFixtures()
  const tasks = full.tasks.filter((task) => allow.has(task.projectId))
  const taskIds = new Set(tasks.map((task) => task.id))
  return {
    taskStatuses: full.taskStatuses.filter((status) => allow.has(status.projectId)),
    taskTags: full.taskTags.filter((tag) => allow.has(tag.projectId)),
    tasks,
    taskComments: full.taskComments.filter((comment) => taskIds.has(comment.taskId)),
    taskFiles: full.taskFiles.filter((file) => taskIds.has(file.taskId)),
  }
}
