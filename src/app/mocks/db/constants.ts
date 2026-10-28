export { MOCK_DATA_NAMESPACE as MOCK_NAMESPACE } from '../../../shared/config/runtime'

/** IndexedDB database version. It is not the document schema and stays put so an open tab is not upgraded. */
export const MOCK_DB_VERSION = 1
/** Document schema. Older versions migrate in place; a newer unknown version is left untouched. */
export const MOCK_SCHEMA_VERSION = 9
export const MOCK_PROVIDER_ID = 'mock-corporate'
/** How long one tab keeps the writer lease after its last mock read or write. */
export const MOCK_WRITER_LEASE_MS = 60_000

export const PUBLIC_FIXTURE_PASSWORD = 'InlogDemo2026!'
