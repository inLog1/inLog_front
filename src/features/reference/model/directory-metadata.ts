import {
  DIRECTORY_CATALOG_SECTIONS,
  type DirectoryCatalogSection,
  type DirectoryDefinition,
  type DirectorySource,
} from '../../../entities/personnel/model/types'
import { STARTER_DIRECTORY_KEYS } from '../../../entities/personnel/model/template'
import { directoryPrimaryCatalogSection } from './directory-sections'

export const DIRECTORY_CREATE_TYPES = ['manual'] as const
export type DirectoryCreateType = (typeof DIRECTORY_CREATE_TYPES)[number]

export function directoryTypeKey(definition: DirectoryDefinition): string {
  if (definition.source.type === 'manual') return 'manual'
  return `registry-${definition.source.registry}`
}

export function directorySourceFromCreateType(type: DirectoryCreateType): DirectorySource {
  if (type === 'manual') return { type: 'manual' }
  return { type: 'manual' }
}

export function isDirectoryTypeLocked(definition: DirectoryDefinition): boolean {
  return definition.source.type === 'registry'
}

export function canDeleteDirectoryDefinition(definition: DirectoryDefinition): boolean {
  if (definition.source.type === 'registry') return false
  return !(STARTER_DIRECTORY_KEYS as readonly string[]).includes(definition.key)
}

export function catalogSectionOptions(): DirectoryCatalogSection[] {
  return [...DIRECTORY_CATALOG_SECTIONS]
}

export function initialCatalogSection(definition: DirectoryDefinition): DirectoryCatalogSection {
  return directoryPrimaryCatalogSection(definition)
}
