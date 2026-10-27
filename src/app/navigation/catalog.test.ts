import { describe, expect, it } from 'vitest'
import { can } from '../../entities/access/model/grants'
import type { EffectiveGrant } from '../../entities/access/model/types'
import { createSeed } from '../mocks/db/seed'
import { toSnapshot } from '../mocks/auth/flow'
import {
  APP_SECTIONS,
  homeSetupCards,
  homeWorkCards,
  sectionAccess,
  shouldLoadProjectTasks,
  showRequestsNotice,
  visibleNavigation,
  visibleQuickActions,
  type NavigationInput,
} from './catalog'

const organization = { type: 'organization' as const, organizationId: 101, corporationId: 1 }
const otherOrganization = { type: 'organization' as const, organizationId: 102, corporationId: 1 }
const project = { type: 'project' as const, projectId: 1001, organizationId: 101, corporationId: 1 }

function grant(resource: string, action: string, scope: EffectiveGrant['scope'] = organization): EffectiveGrant {
  return { id: `${resource}.${action}`, resource, action, scope }
}

function input(patch: Partial<NavigationInput> = {}): NavigationInput {
  return {
    enforceGrants: true,
    grantsPending: false,
    grants: [],
    organizationId: null,
    projectId: null,
    systemCapabilities: [],
    ...patch,
  }
}

describe('navigation catalog', () => {
  it('uses operational grants and ignores a delegation-only right', () => {
    const delegated: EffectiveGrant = {
      id: 'delegated-tasks',
      resource: 'tasks',
      action: 'read',
      scope: organization,
    }
    const withoutOperation = input()
    expect(visibleNavigation(withoutOperation).map((item) => item.id)).toEqual(['home'])
    expect(visibleQuickActions(withoutOperation)).toEqual([])
    const mistaken = input({ grants: [{ ...delegated, resource: 'members', action: 'read' }] })
    expect(visibleNavigation(mistaken).some((item) => item.id === 'tasks')).toBe(false)
    expect(sectionAccess(
      { id: 'tasks', labelKey: '', descriptionKey: '', path: '/scheduler/tasks', group: 'work', context: 'project', surface: 'navigation' },
      input({ grants: [grant('tasks', 'create')] }),
    )).toBe('unavailable')
  })

  it('keeps tasks available before a project is chosen and hides them when the right does not exist', () => {
    const employee = input({
      grants: [grant('tasks', 'read'), grant('tasks', 'create')],
      organizationId: 101,
    })
    expect(visibleNavigation(employee).some((item) => item.id === 'tasks')).toBe(true)
    expect(sectionAccess(
      visibleNavigation(employee).find((item) => item.id === 'tasks')!,
      employee,
    )).toBe('needs-context')
    expect(visibleQuickActions(employee)).toEqual(['create-task'])
    expect(shouldLoadProjectTasks(employee)).toBe(false)

    const ready = input({
      grants: [grant('tasks', 'read', project), grant('tasks', 'create', project)],
      organizationId: 101,
      projectId: 1001,
    })
    expect(shouldLoadProjectTasks(ready)).toBe(true)
    expect(visibleQuickActions(ready)).toEqual(['create-task'])

    const otherProject = input({
      grants: [grant('tasks', 'read', project), grant('tasks', 'create', project)],
      organizationId: 101,
      projectId: 1003,
    })
    expect(visibleNavigation(otherProject).some((item) => item.id === 'tasks')).toBe(true)
    expect(visibleQuickActions(otherProject)).toEqual([])
    expect(shouldLoadProjectTasks(otherProject)).toBe(false)
  })

  it('does not let constructor schema read open forms, or forms read open the constructor', () => {
    const schema = input({
      grants: [grant('constructor.schema', 'read')],
      organizationId: 101,
    })
    expect(visibleNavigation(schema).some((item) => item.id === 'forms')).toBe(false)
    expect(visibleNavigation(schema).some((item) => item.id === 'constructor')).toBe(true)
    const forms = input({
      grants: [grant('forms', 'read')],
      organizationId: 101,
    })
    expect(visibleNavigation(forms).some((item) => item.id === 'forms')).toBe(true)
    expect(visibleNavigation(forms).some((item) => item.id === 'constructor')).toBe(false)
    expect(visibleNavigation(forms).some((item) => item.id === 'reports')).toBe(false)
    expect(sectionAccess(
      visibleNavigation(forms).find((item) => item.id === 'forms')!,
      input({ grants: [grant('forms', 'update')], organizationId: 101 }),
    )).toBe('unavailable')
  })

  it('does not treat constructor or report actions as substitutes for each other', () => {
    const schemaOnly = input({
      grants: [grant('constructor.schema', 'read'), grant('constructor.schema', 'update')],
      organizationId: 101,
    })
    expect(visibleQuickActions(schemaOnly)).toEqual(['open-constructor'])
    expect(shouldLoadProjectTasks(schemaOnly)).toBe(false)
    const recordsOnly = input({
      grants: [grant('constructor.records', 'read')],
      organizationId: 101,
    })
    expect(visibleNavigation(recordsOnly).some((item) => item.id === 'constructor')).toBe(false)
    const reports = input({
      grants: [grant('reports', 'read'), grant('reports', 'generate', otherOrganization)],
      organizationId: 101,
    })
    expect(visibleNavigation(reports).some((item) => item.id === 'reports')).toBe(true)
    expect(visibleQuickActions(reports)).toEqual([])
  })

  it('does not turn a corporate capability into a bypass when operational grants are empty', () => {
    const empty = input()
    expect(homeWorkCards(empty).map((item) => item.id)).toEqual([])
    expect(homeSetupCards(empty).map((item) => item.id)).toEqual([])
    expect(showRequestsNotice(empty)).toBe(false)
    expect(visibleNavigation(empty).some((item) => item.id === 'platform-admin' || item.id === 'geo-mechanics')).toBe(false)
  })

  it('shows the customer notice only from request grants and does not open laboratory sections', () => {
    const customer = input({
      grants: [grant('requests', 'read', { type: 'organization', organizationId: 201, corporationId: 1 }), grant('requests', 'create', { type: 'organization', organizationId: 201, corporationId: 1 })],
      organizationId: 201,
    })
    expect(showRequestsNotice(customer)).toBe(true)
    expect(visibleNavigation(customer).map((item) => item.id)).toEqual(['home'])
    expect(shouldLoadProjectTasks(customer)).toBe(false)
  })

  it('keeps implemented sections in live without pretending grants were checked', () => {
    const live = input({ enforceGrants: false, grants: [] })
    expect(visibleNavigation(live).map((item) => item.id)).toEqual([
      'home', 'tasks', 'reports', 'forms', 'sections', 'access', 'constructor',
    ])
    expect(visibleQuickActions(live)).toEqual(['create-task', 'open-constructor', 'build-report'])
    expect(shouldLoadProjectTasks(live)).toBe(false)
    expect(shouldLoadProjectTasks({ ...live, organizationId: 101, projectId: 1001 })).toBe(true)
    expect(showRequestsNotice(live)).toBe(false)
  })

  it('opens access management from capability or assignments.update and not from a title', () => {
    const access = {
      id: 'access',
      labelKey: 'nav.access',
      descriptionKey: 'nav.access-description',
      path: '/settings/access',
      group: 'settings' as const,
      context: 'organization' as const,
      surface: 'navigation' as const,
    }
    const capability = input({ systemCapabilities: ['corporate_superadmin'], organizationId: 101 })
    expect(sectionAccess(access, capability)).toBe('allowed')
    expect(visibleNavigation(capability).some((item) => item.id === 'tasks')).toBe(false)
    expect(visibleNavigation(input({ grants: [grant('assignments', 'update')], organizationId: 101 })).some((item) => item.id === 'access')).toBe(true)
    expect(visibleNavigation(input({ grants: [grant('assignments', 'update', otherOrganization)], organizationId: 101 })).some((item) => item.id === 'access')).toBe(true)
    expect(sectionAccess(access, input({ grants: [grant('assignments', 'update', otherOrganization)], organizationId: 101 }))).toBe('denied-here')
    expect(visibleNavigation(input({ grants: [grant('tasks', 'read')] })).some((item) => item.id === 'access')).toBe(false)
  })

  it('gives the fresh-seed reader records access without write actions or rights for saved employees', () => {
    const snapshot = toSnapshot(createSeed())
    const laboratory = { type: 'organization' as const, organizationId: 101, corporationId: 1 }
    expect(can(snapshot, 8, 'constructor.schema', 'read', laboratory)).toBe(true)
    expect(can(snapshot, 8, 'constructor.records', 'read', laboratory)).toBe(true)
    expect(can(snapshot, 8, 'constructor.records', 'create', laboratory)).toBe(false)
    expect(can(snapshot, 8, 'constructor.records', 'update', laboratory)).toBe(false)
    expect(can(snapshot, 8, 'constructor.records', 'delete', laboratory)).toBe(false)
    expect(can(snapshot, 8, 'constructor.schema', 'create', laboratory)).toBe(false)
    expect(can(snapshot, 8, 'constructor.schema', 'update', laboratory)).toBe(false)
    expect(can(snapshot, 8, 'constructor.schema', 'delete', laboratory)).toBe(false)
    expect(can(snapshot, 3, 'constructor.records', 'read', laboratory)).toBe(false)
    expect(createSeed().users.some((user) => user.email === 'constructor.reader@example.test')).toBe(true)
  })

  it('opens the section desk from create or update and not from read or the superadmin capability', () => {
    const desk = {
      id: 'sections',
      labelKey: 'nav.sections',
      descriptionKey: 'nav.sections-description',
      path: '/settings/sections',
      group: 'settings' as const,
      context: 'organization' as const,
      surface: 'navigation' as const,
    }
    expect(visibleNavigation(input({ grants: [grant('sections', 'update')], organizationId: 101 })).some((item) => item.id === 'sections')).toBe(true)
    expect(visibleNavigation(input({ grants: [grant('sections', 'create')], organizationId: 101 })).some((item) => item.id === 'sections')).toBe(true)
    expect(visibleNavigation(input({ grants: [grant('sections', 'read')], organizationId: 101 })).some((item) => item.id === 'sections')).toBe(false)
    expect(sectionAccess(desk, input({ systemCapabilities: ['corporate_superadmin'], organizationId: 101 }))).toBe('unavailable')
    expect(APP_SECTIONS.filter((item) => item.path.startsWith('/workspace/sections'))).toEqual([])
  })

  it('keeps work and setup apart and leaves profile, notifications and table catalogs out of the menu', () => {
    expect(APP_SECTIONS.find((item) => item.id === 'tasks')?.group).toBe('work')
    expect(APP_SECTIONS.find((item) => item.id === 'reports')?.group).toBe('work')
    expect(APP_SECTIONS.find((item) => item.id === 'forms')?.group).toBe('settings')
    expect(APP_SECTIONS.find((item) => item.id === 'sections')?.group).toBe('settings')
    expect(APP_SECTIONS.find((item) => item.id === 'access')?.group).toBe('settings')
    expect(APP_SECTIONS.find((item) => item.id === 'constructor')?.group).toBe('settings')
    expect(APP_SECTIONS.find((item) => item.id === 'profile')?.surface).toBe('account')
    expect(APP_SECTIONS.find((item) => item.id === 'notifications')?.surface).toBe('account')
    expect(APP_SECTIONS.some((item) => item.id === 'table-views' || item.path.includes('table-views'))).toBe(false)
    expect(APP_SECTIONS.find((item) => item.id === 'platform-admin')?.surface).toBe('preserved')
    const employee = input({
      grants: [grant('tasks', 'read'), grant('forms', 'read'), grant('reports', 'read')],
      organizationId: 101,
    })
    expect(homeWorkCards(employee).map((item) => item.id)).toEqual(['tasks', 'reports'])
    expect(homeSetupCards(employee).map((item) => item.id)).toEqual(['forms'])
    expect(visibleNavigation(employee).some((item) => item.id === 'profile' || item.id === 'notifications' || item.id === 'access')).toBe(false)
  })
})
