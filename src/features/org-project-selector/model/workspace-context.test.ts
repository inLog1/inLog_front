import { describe, expect, it } from 'vitest'
import { grantAllows } from '../../../entities/access/model/grants'
import type { EffectiveGrant } from '../../../entities/access/model/types'
import {
  applyAutoSelection,
  canQueryOrganization,
  canQueryProject,
  parseRouteId,
  preserveLocationSearch,
  projectsOfOrganization,
  resolveOrganization,
  resolveProject,
  searchWithoutWorkspace,
  selectOrganizationParams,
  selectProjectParams,
  workspaceHref,
} from './workspace-context'

const org = (id: number) => ({ id })
const project = (id: number, organizationId: number) => ({ id, organizationId })
const ready = <T>(items: T[]) => ({ status: 'ready' as const, items })

describe('workspace context', () => {
  it('parses only a positive integer id', () => {
    expect(parseRouteId(null)).toEqual({ kind: 'absent' })
    expect(parseRouteId('')).toEqual({ kind: 'absent' })
    expect(parseRouteId('101')).toEqual({ kind: 'id', id: 101 })
    expect(parseRouteId('0').kind).toBe('invalid')
    expect(parseRouteId('-1').kind).toBe('invalid')
    expect(parseRouteId('10abc').kind).toBe('invalid')
    expect(parseRouteId('1.5').kind).toBe('invalid')
    expect(parseRouteId('01').kind).toBe('invalid')
  })

  it('auto-selects the only organization and asks for a choice when several exist', () => {
    expect(resolveOrganization(ready([org(101)]), null, { status: 'idle' })).toMatchObject({
      status: 'ready',
      organizationId: 101,
      autoOrgId: '101',
    })
    expect(resolveOrganization(ready([org(101), org(102)]), null, { status: 'idle' })).toMatchObject({
      status: 'choose',
      reason: 'choose-organization',
      organizationId: null,
      autoOrgId: null,
    })
  })

  it('does not replace an explicit invalid, unknown, or foreign organization with the first available one', () => {
    const listed = ready([org(101)])
    expect(resolveOrganization(listed, 'nope', { status: 'idle' })).toMatchObject({
      status: 'not-found',
      reason: 'invalid-organization',
      autoOrgId: null,
    })
    expect(resolveOrganization(listed, '999', { status: 'not-found' })).toMatchObject({
      status: 'not-found',
      reason: 'unknown-organization',
      organizationId: null,
    })
    expect(resolveOrganization(listed, '102', { status: 'forbidden' })).toMatchObject({
      status: 'forbidden',
      reason: 'forbidden-organization',
      organizationId: null,
      autoOrgId: null,
    })
    expect(resolveOrganization({ status: 'error', items: [] }, null, { status: 'idle' })).toMatchObject({
      status: 'error',
      reason: 'organizations-error',
    })
    expect(resolveOrganization(ready([]), null, { status: 'idle' })).toMatchObject({
      status: 'empty',
      reason: 'organizations-empty',
    })
  })

  it('keeps a foreign project out of the selected organization and does not adopt a late payload', () => {
    const latePayload = ready([project(1001, 101), project(1002, 102)])
    expect(projectsOfOrganization(latePayload.items, 102).map((item) => item.id)).toEqual([1002])
    const resolved = resolveProject(102, latePayload, '1001', { status: 'ready', organizationId: 101 })
    expect(resolved).toMatchObject({
      status: 'forbidden',
      reason: 'project-organization-mismatch',
      projectId: null,
      autoProjectId: null,
    })
    expect(canQueryProject(resolved.status, resolved.projectId)).toBe(false)
  })

  it('auto-selects one project, offers a choice for several, and reports a real empty list separately from an error', () => {
    const one = resolveProject(101, ready([project(1001, 101)]), null, { status: 'idle' })
    expect(one).toMatchObject({ status: 'ready', projectId: 1001, autoProjectId: '1001' })
    expect(canQueryProject(one.status, one.projectId)).toBe(true)

    expect(resolveProject(101, ready([project(1001, 101), project(1003, 101)]), null, { status: 'idle' })).toMatchObject({
      status: 'choose',
      reason: 'choose-project',
      projectId: null,
    })
    expect(resolveProject(201, ready([]), null, { status: 'idle' })).toMatchObject({
      status: 'empty',
      reason: 'projects-empty',
    })
    expect(resolveProject(101, { status: 'error', items: [] }, null, { status: 'idle' })).toMatchObject({
      status: 'error',
      reason: 'projects-error',
    })
    expect(resolveProject(101, { status: 'loading', items: [project(1001, 101)] }, '1001', { status: 'idle' })).toMatchObject({
      status: 'loading',
      projectId: null,
    })
  })

  it('classifies an explicit project id without substituting another project', () => {
    const listed = ready([project(1001, 101)])
    expect(resolveProject(101, listed, 'bad', { status: 'idle' }).reason).toBe('invalid-project')
    expect(resolveProject(101, listed, '404', { status: 'not-found' })).toMatchObject({
      status: 'not-found',
      reason: 'unknown-project',
      autoProjectId: null,
    })
    expect(resolveProject(101, listed, '1002', { status: 'forbidden' })).toMatchObject({
      status: 'forbidden',
      reason: 'forbidden-project',
      projectId: null,
    })
    expect(canQueryOrganization('loading', 101)).toBe(false)
    expect(canQueryOrganization('ready', 101)).toBe(true)
  })

  it('fills only missing params and clears dependent params on an explicit switch', () => {
    const current = new URLSearchParams('task=old&node=4&tab=2')
    const filled = applyAutoSelection(current, { org: '101', project: '1001' })
    expect(filled?.toString()).toBe('task=old&node=4&tab=2&org=101&project=1001')
    expect(applyAutoSelection(new URLSearchParams('org=999'), { org: '101', project: '1001' })).toBeNull()
    expect(applyAutoSelection(new URLSearchParams('org=102&task=keep'), { org: null, project: '1002' })?.toString())
      .toBe('org=102&task=keep&project=1002')

    const switched = selectOrganizationParams(new URLSearchParams('org=101&project=1001&task=slug&node=8&tab=3'), 102)
    expect(switched.get('org')).toBe('102')
    expect(switched.get('project')).toBeNull()
    expect(switched.get('task')).toBeNull()
    expect(switched.get('node')).toBeNull()
    expect(switched.get('tab')).toBeNull()

    const nextProject = selectProjectParams(new URLSearchParams('org=101&project=1001&task=slug&node=8'), 1003)
    expect(nextProject.get('project')).toBe('1003')
    expect(nextProject.get('task')).toBeNull()
    expect(nextProject.get('node')).toBe('8')
    expect(preserveLocationSearch('/scheduler/tasks', '?org=101&project=1001&task=slug')).toEqual({
      pathname: '/scheduler/tasks',
      search: '?org=101&project=1001&task=slug',
    })
  })

  it('builds section links from the verified workspace and leaves public links and logout clean', () => {
    const verified = { organizationId: 101, projectId: 1001 }
    expect(workspaceHref('/scheduler', 'project', verified, true)).toBe('/scheduler?org=101&project=1001')
    expect(workspaceHref('/admin/constructor', 'organization', verified, true)).toBe('/admin/constructor?org=101&project=1001')
    expect(workspaceHref('/admin/reports', 'organization', verified, false)).toBe('/admin/reports?org=101')
    expect(workspaceHref('/scheduler/tasks', 'project', { organizationId: 101, projectId: null }, false)).toBe('/scheduler/tasks?org=101')
    expect(workspaceHref('/login', 'public', verified, true)).toBe('/login')
    expect(workspaceHref('/settings/profile', 'app', verified, true)).not.toContain('task=')
    expect(searchWithoutWorkspace('?org=101&project=1001&task=slug&node=8&tab=2&next=1')).toBe('?next=1')
    expect(searchWithoutWorkspace('?org=101&project=1003')).toBe('')
  })

  it('lets a project grant open that project and not the rest of the organization', () => {
    const grants: EffectiveGrant[] = [
      {
        id: 'g-tasks',
        resource: 'tasks',
        action: 'read',
        scope: { type: 'project', projectId: 1001, organizationId: 101, corporationId: 1 },
      },
    ]
    expect(grantAllows(grants, 'tasks', 'read', { organizationId: 101, projectId: 1001 })).toBe(true)
    expect(grantAllows(grants, 'tasks', 'read', { organizationId: 101, projectId: 1003 })).toBe(false)
    expect(grantAllows(grants, 'constructor.schema', 'update', { organizationId: 101, projectId: null })).toBe(false)
    expect(grantAllows(grants, 'tasks', 'update', { organizationId: 101, projectId: 1001 })).toBe(false)
    expect(grantAllows(
      [{ id: 'name', resource: 'tasks', action: 'read', scope: { type: 'organization', organizationId: 101, corporationId: 1 } }],
      'reports',
      'generate',
      { organizationId: 101, projectId: null },
    )).toBe(false)
  })
})
