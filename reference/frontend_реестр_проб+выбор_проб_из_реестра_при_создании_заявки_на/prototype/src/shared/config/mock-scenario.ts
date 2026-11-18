import { MOCK_DATA_NAMESPACE } from './runtime'

/** Separate IndexedDB database. It is not a copy of the demonstration namespace. */
export const PERSONAL_MOCK_NAMESPACE = 'inlog:mock:personal-v1'

/** Persisted choice. A running document does not re-read it after startup. */
export const MOCK_SCENARIO_STORAGE_KEY = 'inlog:mock:scenario'

export type MockScenario = 'demo' | 'personal'

type ScenarioStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/**
 * Frozen for this document. Another tab can change storage, but this page
 * keeps the namespace it opened with until a full reload.
 */
let captured: MockScenario | null = null

export function readStoredScenario(storage: ScenarioStorage | null = defaultStorage()): MockScenario {
  const raw = storage?.getItem(MOCK_SCENARIO_STORAGE_KEY)
  return raw === 'personal' ? 'personal' : 'demo'
}

export function documentScenario(): MockScenario {
  if (captured == null) captured = readStoredScenario()
  return captured
}

export function documentMockNamespace(): string {
  return documentScenario() === 'personal' ? PERSONAL_MOCK_NAMESPACE : MOCK_DATA_NAMESPACE
}

export function namespaceForScenario(scenario: MockScenario): string {
  return scenario === 'personal' ? PERSONAL_MOCK_NAMESPACE : MOCK_DATA_NAMESPACE
}

/** Writes the next document's choice. It does not retarget the document that is already open. */
export function persistScenarioChoice(scenario: MockScenario, storage: ScenarioStorage | null = defaultStorage()) {
  storage?.setItem(MOCK_SCENARIO_STORAGE_KEY, scenario)
}

/** Tests only. Production switches reload instead of calling this. */
export function resetDocumentScenarioForTests(next?: MockScenario) {
  captured = next ?? null
}

function defaultStorage(): ScenarioStorage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    return null
  }
  return null
}
