import { beforeEach, describe, expect, it } from 'vitest'
import { indexedDB } from 'fake-indexeddb'
import { loginWithPassword } from '../auth/flow'
import { PUBLIC_FIXTURE_PASSWORD } from '../db/constants'
import { ensureMockState, updateMockState } from '../db/repository'
import { createSeed } from '../db/seed'
import type { MockState } from '../db/types'
import {
  addComment,
  addDoer,
  addFile,
  addSupervisor,
  createTask,
  deleteFile,
  editComment,
  listTasks,
  MAX_TASK_FILE_BYTES,
  readTask,
  removeSupervisor,
  updateTask,
} from './service'

function session(email: string, state = createSeed()) {
  const login = loginWithPassword(state, email, PUBLIC_FIXTURE_PASSWORD)
  const token = (login.body as { access_token?: string }).access_token ?? ''
  return { state: login.state, token }
}

function bodyOf(result: { body: unknown }) {
  return result.body as { count?: number; results?: { slug: string; name: string; project: number }[]; name?: string; code?: string; file?: string }
}

describe('legacy task mocks', () => {
  beforeEach(() => {
    globalThis.indexedDB = indexedDB
  })

  it('keeps the same slug in two projects as two tasks and pages the filtered total', () => {
    const employee = session('employee.a@example.test')
    const projectA = readTask(employee.state, employee.token, 1001, 'shared-sample')
    const projectB = readTask(employee.state, employee.token, 1002, 'shared-sample')
    expect(projectA.status).toBe(200)
    expect(bodyOf(projectA).name).toBe('Образец А-1')
    expect(projectB.status).toBe(403)
    expect(JSON.stringify(projectB.body)).not.toContain('Образец Б-1')

    const laboratoryB = session('employee.b@example.test')
    const own = readTask(laboratoryB.state, laboratoryB.token, 1002, 'shared-sample')
    expect(bodyOf(own).name).toBe('Образец Б-1')

    const changed = updateTask(employee.state, employee.token, 1001, 'shared-sample', { name: 'Образец А-1 изменён' })
    expect(changed.status).toBe(200)
    const viewer = session('employee.b@example.test', changed.state)
    const stillB = readTask(viewer.state, viewer.token, 1002, 'shared-sample')
    expect(bodyOf(stillB).name).toBe('Образец Б-1')

    const parents = listTasks(employee.state, employee.token, 1001, {
      limit: 1,
      offset: 0,
      template: false,
      taskType: 'parent',
    })
    expect(parents.status).toBe(200)
    expect(bodyOf(parents).results).toHaveLength(1)
    expect(bodyOf(parents).count).toBe(2)
  })

  it('rejects a parent, participant, or status from another project and does not change the task', () => {
    const employee = session('employee.a@example.test')
    const before = employee.state.tasks.find((task) => task.slug === 'a1-child')
    const foreignParent = createTask(employee.state, employee.token, 1001, { name: 'Чужая связь', parent: 9101 })
    expect(foreignParent.status).toBe(400)
    expect(foreignParent.state.tasks).toEqual(employee.state.tasks)
    const foreignStatus = updateTask(employee.state, employee.token, 1001, 'a1-child', { status: 511 })
    expect(foreignStatus.status).toBe(400)
    expect(foreignStatus.state.tasks.find((task) => task.id === before?.id)?.statusId).toBe(before?.statusId)
    const foreignDoer = addDoer(employee.state, employee.token, 1001, 'shared-sample', 4)
    expect(foreignDoer.status).toBe(400)
    expect(foreignDoer.state).toBe(employee.state)
  })

  it('does not give the laboratory administrator task access and keeps a read-only grant from writing', () => {
    const admin = session('admin.a@example.test')
    const listed = listTasks(admin.state, admin.token, 1001, { limit: 10, offset: 0, template: false })
    expect(listed.status).toBe(403)
    expect(JSON.stringify(listed.body)).not.toContain('Образец')

    const reader = createSeed()
    const employee = reader.roles.find((role) => role.id === 'role-employee')
    if (!employee) throw new Error('missing employee role')
    employee.grantIds = ['g-tasks', 'g-projects']
    const limited = session('employee.a@example.test', reader)
    expect(readTask(limited.state, limited.token, 1001, 'shared-sample').status).toBe(200)
    const denied = createTask(limited.state, limited.token, 1001, { name: 'Нельзя' })
    expect(denied.status).toBe(403)
    expect(denied.state.tasks).toHaveLength(reader.tasks.length)
    expect(updateTask(limited.state, limited.token, 1001, 'shared-sample', { name: 'Нельзя' }).status).toBe(403)
    expect(addComment(limited.state, limited.token, 1001, 'shared-sample', 'Нельзя').status).toBe(403)
    expect(addDoer(limited.state, limited.token, 1001, 'shared-sample', 3).status).toBe(403)
    expect(addFile(limited.state, limited.token, 1001, 'shared-sample', {
      filename: 'no.txt',
      mimeType: 'text/plain',
      bytes: new Uint8Array([1]),
    }).status).toBe(403)
    expect(limited.state.tasks).toEqual(reader.tasks)
  })

  it('stores a comment and a file for the task owner and refuses a foreign edit or an oversized file', () => {
    const employee = session('employee.a@example.test')
    const comment = addComment(employee.state, employee.token, 1001, 'shared-sample', 'Новая заметка')
    expect(comment.status).toBe(201)
    const commentId = (comment.body as { id: number }).id
    const other = session('owner@example.test', comment.state)
    const stolen = editComment(other.state, other.token, 1001, 'shared-sample', commentId, 'Чужая правка')
    expect(stolen.status).toBe(403)
    expect(stolen.state.taskComments.find((item) => item.id === commentId)?.text).toBe('Новая заметка')

    const file = addFile(employee.state, employee.token, 1001, 'shared-sample', {
      filename: 'note.txt',
      mimeType: 'text/plain',
      bytes: new Uint8Array([1, 2, 3]),
    })
    expect(file.status).toBe(201)
    expect(String((file.body as { file?: string }).file)).not.toContain('blob:')
    expect(String((file.body as { file?: string }).file)).toContain('/content/')
    const removed = deleteFile(file.state, employee.token, 1001, 'shared-sample', (file.body as { id: number }).id)
    expect(removed.status).toBe(204)
    expect(removed.state.taskFiles.some((item) => item.filename === 'note.txt')).toBe(false)

    const huge = addFile(employee.state, employee.token, 1001, 'shared-sample', {
      filename: 'big.bin',
      mimeType: 'application/octet-stream',
      bytes: new Uint8Array(MAX_TASK_FILE_BYTES + 1),
    })
    expect(huge.status).toBe(413)
    expect(huge.state.taskFiles).toEqual(employee.state.taskFiles)
  })

  it('replaces a supervisor as two checked requests and leaves the task without one if the second is refused', () => {
    const employee = session('employee.a@example.test')
    const current = employee.state.tasks.find((task) => task.slug === 'shared-sample' && task.projectId === 1001)
    const removed = removeSupervisor(employee.state, employee.token, 1001, 'shared-sample', current?.supervisor?.id ?? 0)
    expect(removed.status).toBe(200)
    const refused = addSupervisor(removed.state, employee.token, 1001, 'shared-sample', 4)
    expect(refused.status).toBe(400)
    expect(refused.state.tasks.find((task) => task.id === current?.id)?.supervisor).toBeNull()
    const added = addSupervisor(removed.state, employee.token, 1001, 'shared-sample', 3)
    expect(added.status).toBe(200)
    expect(added.state.tasks.find((task) => task.id === current?.id)?.supervisor?.userId).toBe(3)
  })

  it('keeps a created task after the document is opened again and does not touch the other project', async () => {
    const namespace = `inlog:mock:test-tasks-${crypto.randomUUID()}`
    await ensureMockState(namespace)
    const box: { state?: MockState; token?: string } = {}
    await updateMockState((state) => {
      const login = loginWithPassword(state, 'employee.a@example.test', PUBLIC_FIXTURE_PASSWORD)
      box.token = login.state.sessions[0]?.accessToken
      box.state = login.state
      return login.state
    }, namespace)
    await updateMockState((state) => {
      const created = createTask(state, box.token ?? '', 1001, { name: 'После перезагрузки', parent: 9001 })
      expect(created.status).toBe(201)
      return created.state
    }, namespace)
    const opened = await ensureMockState(namespace)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    const created = opened.state.tasks.find((task) => task.projectId === 1001 && task.name === 'После перезагрузки')
    const other = opened.state.tasks.find((task) => task.projectId === 1002 && task.slug === 'shared-sample')
    expect(created?.parentId).toBe(9001)
    expect(other?.name).toBe('Образец Б-1')
  })
})
