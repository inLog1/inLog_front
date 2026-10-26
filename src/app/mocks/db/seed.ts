import { MOCK_NAMESPACE, MOCK_PROVIDER_ID, MOCK_SCHEMA_VERSION } from './constants'
import type { MockState } from './types'

const corporation = { type: 'corporation' as const, corporationId: 1 }
const org = (organizationId: number) => ({
  type: 'organization' as const,
  organizationId,
  corporationId: 1,
})

export function createSeed(): MockState {
  return {
    schemaVersion: MOCK_SCHEMA_VERSION,
    namespace: MOCK_NAMESPACE,
    installationPhase: 'ready',
    authMode: 'mixed',
    accessVersion: 1,
    corporation: { id: 1, name: 'Демо-корпорация' },
    users: [
      { id: 1, email: 'owner@example.test', name: 'Алина', patronymic: 'Сергеевна', surname: 'Власова', position: 'Координатор установки', legacyRole: 'super_admin', status: 'active' },
      { id: 2, email: 'admin.a@example.test', name: 'Борис', patronymic: 'Ильич', surname: 'Лебедев', position: 'Администратор лаборатории', legacyRole: 'member', status: 'active' },
      { id: 3, email: 'employee.a@example.test', name: 'Кира', patronymic: 'Олеговна', surname: 'Соколова', position: 'Сотрудник лаборатории', legacyRole: 'member', status: 'active' },
      { id: 4, email: 'employee.b@example.test', name: 'Глеб', patronymic: 'Павлович', surname: 'Морозов', position: 'Сотрудник лаборатории', legacyRole: 'member', status: 'active' },
      { id: 5, email: 'customer@example.test', name: 'Нина', patronymic: 'Андреевна', surname: 'Орлова', position: 'Представитель заказчика', legacyRole: 'member', status: 'active' },
      { id: 6, email: 'pending@example.test', name: 'Павел', patronymic: 'Романович', surname: 'Ершов', position: 'Сотрудник без назначений', legacyRole: 'member', status: 'active' },
    ],
    identities: [
      { id: 'idn-owner', providerId: MOCK_PROVIDER_ID, externalSubject: 'sub-owner', email: 'owner@example.test', userId: 1 },
      { id: 'idn-admin-a', providerId: MOCK_PROVIDER_ID, externalSubject: 'sub-admin-a', email: 'admin.a@example.test', userId: 2 },
      { id: 'idn-employee-a', providerId: MOCK_PROVIDER_ID, externalSubject: 'sub-employee-a', email: 'employee.a@example.test', userId: 3 },
      { id: 'idn-employee-b', providerId: MOCK_PROVIDER_ID, externalSubject: 'sub-employee-b', email: 'employee.b@example.test', userId: 4 },
      { id: 'idn-customer', providerId: MOCK_PROVIDER_ID, externalSubject: 'sub-customer', email: 'customer@example.test', userId: 5 },
      { id: 'idn-pending', providerId: MOCK_PROVIDER_ID, externalSubject: 'sub-pending', email: 'pending@example.test', userId: 6 },
      { id: 'idn-owner-shadow', providerId: MOCK_PROVIDER_ID, externalSubject: 'sub-owner-shadow', email: 'owner@example.test', userId: null },
    ],
    organizations: [
      { id: 101, corporationId: 1, kind: 'laboratory', fullName: 'Лаборатория А', shortName: 'Лаб. А', address: 'Демо, корпус А' },
      { id: 102, corporationId: 1, kind: 'laboratory', fullName: 'Лаборатория Б', shortName: 'Лаб. Б', address: 'Демо, корпус Б' },
      { id: 201, corporationId: 1, kind: 'customer', fullName: 'Организация-заказчик', shortName: 'Заказчик', address: 'Демо, офис заказчика' },
    ],
    projects: [
      { id: 1001, organizationId: 101, corporationId: 1, name: 'Проект А-1' },
      { id: 1002, organizationId: 102, corporationId: 1, name: 'Проект Б-1' },
    ],
    memberships: [
      { id: 'mem-1-101', userId: 1, organizationId: 101, kind: 'laboratory' },
      { id: 'mem-1-102', userId: 1, organizationId: 102, kind: 'laboratory' },
      { id: 'mem-1-201', userId: 1, organizationId: 201, kind: 'customer' },
      { id: 'mem-2-101', userId: 2, organizationId: 101, kind: 'laboratory' },
      { id: 'mem-3-101', userId: 3, organizationId: 101, kind: 'laboratory' },
      { id: 'mem-4-102', userId: 4, organizationId: 102, kind: 'laboratory' },
      { id: 'mem-5-201', userId: 5, organizationId: 201, kind: 'customer' },
    ],
    grants: [
      { id: 'g-org-manage', resource: 'organizations', action: 'manage' },
      { id: 'g-assign', resource: 'assignments', action: 'update' },
      { id: 'g-projects', resource: 'projects', action: 'read' },
      { id: 'g-test', resource: 'test-resource', action: 'read' },
      { id: 'g-members-manage', resource: 'members', action: 'manage' },
      { id: 'g-tasks', resource: 'tasks', action: 'read' },
      { id: 'g-requests-read', resource: 'requests', action: 'read' },
      { id: 'g-requests-create', resource: 'requests', action: 'create' },
    ],
    roles: [
      { id: 'role-owner', displayName: 'Координатор', grantIds: ['g-org-manage', 'g-assign', 'g-projects', 'g-test', 'g-members-manage'] },
      { id: 'role-lab-admin', displayName: 'Администратор лаборатории', grantIds: ['g-members-manage', 'g-assign', 'g-projects', 'g-test'] },
      { id: 'role-employee', displayName: 'Сотрудник', grantIds: ['g-tasks', 'g-projects'] },
      { id: 'role-customer', displayName: 'Заказчик', grantIds: ['g-requests-read', 'g-requests-create'] },
      { id: 'role-decoy', displayName: 'corporate_superadmin', grantIds: [] },
    ],
    assignments: [
      { id: 'asg-owner', userId: 1, roleId: 'role-owner', scope: corporation },
      { id: 'asg-admin', userId: 2, roleId: 'role-lab-admin', scope: org(101) },
      { id: 'asg-employee-a', userId: 3, roleId: 'role-employee', scope: org(101) },
      { id: 'asg-employee-b', userId: 4, roleId: 'role-employee', scope: org(102) },
      { id: 'asg-customer', userId: 5, roleId: 'role-customer', scope: org(201) },
    ],
    delegations: [
      {
        id: 'dlg-admin-to-employee-a',
        fromUserId: 2,
        toUserId: 3,
        grant: {
          id: 'g-members-read-delegated',
          resource: 'members',
          action: 'read',
          scope: org(101),
        },
      },
    ],
    systemCapabilities: [{ userId: 1, code: 'corporate_superadmin' }],
    sessions: [],
    fault: null,
  }
}
