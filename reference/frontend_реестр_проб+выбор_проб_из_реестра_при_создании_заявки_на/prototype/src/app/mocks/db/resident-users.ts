import { PERSONAL_MOCK_NAMESPACE } from '../../../shared/config/mock-scenario'
import type { MockState, MockUser } from './types'

/**
 * Fictional people kept beside a manually registered owner.
 * A name here is not a role and does not grant corporate_superadmin.
 * Only the personal installation receives them. Demonstration and other namespaces stay as they are.
 */
export const RESIDENT_USERS: readonly MockUser[] = [
  { id: 21, email: 'resident.kuznetsov@example.test', name: 'Андрей', patronymic: 'Кириллович', surname: 'Кузнецов', position: 'Заведующий лабораторией', legacyRole: 'member', status: 'active', fixturePassword: false },
  { id: 22, email: 'resident.morozova@example.test', name: 'Арина', patronymic: 'Михайловна', surname: 'Морозова', position: 'Ответственный за приём', legacyRole: 'member', status: 'active', fixturePassword: false },
  { id: 23, email: 'resident.sidorov@example.test', name: 'Кирилл', patronymic: 'Олегович', surname: 'Сидоров', position: 'Инженер-лаборант', legacyRole: 'member', status: 'active', fixturePassword: false },
  { id: 24, email: 'resident.volkova@example.test', name: 'Мария', patronymic: 'Андреевна', surname: 'Волкова', position: 'Петрограф', legacyRole: 'member', status: 'active', fixturePassword: false },
  { id: 25, email: 'resident.ershova@example.test', name: 'Полина', patronymic: 'Сергеевна', surname: 'Ершова', position: 'Геолог', legacyRole: 'member', status: 'active', fixturePassword: false },
  { id: 26, email: 'resident.belov@example.test', name: 'Даниил', patronymic: 'Игоревич', surname: 'Белов', position: 'Лаборант', legacyRole: 'member', status: 'active', fixturePassword: false },
  { id: 27, email: 'resident.sorokina@example.test', name: 'Елена', patronymic: 'Викторовна', surname: 'Сорокина', position: 'Методист', legacyRole: 'member', status: 'active', fixturePassword: false },
  { id: 28, email: 'resident.novikov@example.test', name: 'Павел', patronymic: 'Алексеевич', surname: 'Новиков', position: 'Инженер', legacyRole: 'member', status: 'active', fixturePassword: false },
  { id: 29, email: 'resident.frolova@example.test', name: 'Ольга', patronymic: 'Дмитриевна', surname: 'Фролова', position: 'Документовед', legacyRole: 'member', status: 'active', fixturePassword: false },
  { id: 30, email: 'resident.gromov@example.test', name: 'Илья', patronymic: 'Николаевич', surname: 'Громов', position: 'Специалист по качеству', legacyRole: 'member', status: 'active', fixturePassword: false },
]

export function withResidentUsers(state: MockState): MockState {
  if (state.installationPhase !== 'ready' || state.namespace !== PERSONAL_MOCK_NAMESPACE) return state
  const emails = new Set(state.users.map((user) => user.email))
  const used = new Set(state.users.map((user) => user.id))
  const missing = RESIDENT_USERS.filter((user) => !emails.has(user.email))
  if (missing.length === 0) return state
  let nextId = state.users.reduce((max, user) => Math.max(max, user.id), 0) + 1
  const added = missing.map((user) => {
    const id = used.has(user.id) ? nextId++ : user.id
    used.add(id)
    if (id >= nextId) nextId = id + 1
    return { ...user, id }
  })
  return { ...state, users: [...state.users, ...added] }
}
