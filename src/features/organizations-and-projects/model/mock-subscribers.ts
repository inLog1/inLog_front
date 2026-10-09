import { useSyncExternalStore } from 'react'
import type { AdminUserBrief } from '../../../entities/platform-admin/model/types'
import type { MembershipRole } from '../../../shared/types/membership-access'

export type SubscriberEntityKind = 'organization' | 'project'

export interface MockSubscriber {
    id: number
    email: string
    fullName: string
    role: MembershipRole
}

const PEOPLE: Omit<MockSubscriber, 'id'>[] = [
    { email: 'anna.petrova@inlog.ru', fullName: 'Анна Петрова', role: 'admin' },
    { email: 'ivan.smirnov@inlog.ru', fullName: 'Иван Смирнов', role: 'user' },
    { email: 'maria.volkova@inlog.ru', fullName: 'Мария Волкова', role: 'user' },
    { email: 'sergey.orlov@inlog.ru', fullName: 'Сергей Орлов', role: 'admin' },
    { email: 'elena.kuznetsova@inlog.ru', fullName: 'Елена Кузнецова', role: 'user' },
    { email: 'boris.pavlov@inlog.ru', fullName: 'Борис Павлов', role: 'user' },
    { email: 'galina.novikova@inlog.ru', fullName: 'Галина Новикова', role: 'admin' },
    { email: 'roman.fedorov@inlog.ru', fullName: 'Роман Федоров', role: 'user' },
]

const SUBSCRIBER_COUNTS = [5, 6, 8]

const hiddenByEntity = new Map<string, Set<number>>()
let revision = 0
const listeners = new Set<() => void>()

function entityKey(kind: SubscriberEntityKind, id: number) {
    return `${kind}:${id}`
}

function emit() {
    revision += 1
    listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export function useSubscribersRevision() {
    return useSyncExternalStore(subscribe, () => revision, () => revision)
}

export function mockSubscribersFor(entityId: number): MockSubscriber[] {
    const size = SUBSCRIBER_COUNTS[Math.abs(entityId) % SUBSCRIBER_COUNTS.length]
    const start = Math.abs(entityId) % PEOPLE.length
    const ordered = [...PEOPLE.slice(start), ...PEOPLE.slice(0, start)]
    return ordered.slice(0, size).map((person, index) => ({
        ...person,
        id: -(start * 20 + index + 1),
    }))
}

export function toSubscriberUser(subscriber: MockSubscriber): AdminUserBrief {
    const [name, surname] = subscriber.fullName.split(' ')
    return {
        id: subscriber.id,
        email: subscriber.email,
        full_name: subscriber.fullName,
        name,
        surname,
    }
}

export function visibleMockSubscribers(kind: SubscriberEntityKind, entityId: number) {
    const hidden = hiddenByEntity.get(entityKey(kind, entityId))
    return mockSubscribersFor(entityId).filter((subscriber) => !hidden?.has(subscriber.id))
}

export function hideMockSubscriber(kind: SubscriberEntityKind, entityId: number, subscriberId: number) {
    const key = entityKey(kind, entityId)
    const hidden = hiddenByEntity.get(key) ?? new Set<number>()
    hidden.add(subscriberId)
    hiddenByEntity.set(key, hidden)
    emit()
}
