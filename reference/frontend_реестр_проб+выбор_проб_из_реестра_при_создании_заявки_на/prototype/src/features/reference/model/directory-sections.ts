import {
  DIRECTORY_CATALOG_SECTIONS,
  type DirectoryCatalogSection,
  type DirectoryDefinition,
} from '../../../entities/personnel/model/types'

export const DIRECTORY_SECTION_IDS = ['all', ...DIRECTORY_CATALOG_SECTIONS] as const

export type DirectorySectionId = (typeof DIRECTORY_SECTION_IDS)[number]

const STARTER_SECTIONS: Record<string, DirectorySectionId[]> = {
  departments: ['org-structure', 'personnel'],
  workplaces: ['org-structure', 'personnel'],
  positions: ['personnel'],
  'qualification-status': ['personnel'],
}

function storedSections(definition: DirectoryDefinition): DirectoryCatalogSection[] {
  if (!definition.sections?.length) return []
  return definition.sections.filter((section): section is DirectoryCatalogSection =>
    (DIRECTORY_CATALOG_SECTIONS as readonly string[]).includes(section),
  )
}

export function directorySections(definition: DirectoryDefinition): DirectorySectionId[] {
  const explicit = storedSections(definition)
  if (explicit.length) return explicit
  const mapped = STARTER_SECTIONS[definition.key]
  if (mapped?.length) return mapped
  return ['other']
}

export function directoryPrimaryCatalogSection(definition: DirectoryDefinition): DirectoryCatalogSection {
  const section = directorySections(definition)[0]
  if (section && section !== 'all') return section
  return 'other'
}

export function primarySection(definition: DirectoryDefinition): DirectorySectionId {
  return directorySections(definition)[0] ?? 'other'
}

export function sectionCounts(directories: DirectoryDefinition[]): Record<DirectorySectionId, number> {
  const counts = Object.fromEntries(DIRECTORY_SECTION_IDS.map((id) => [id, 0])) as Record<DirectorySectionId, number>
  counts.all = directories.length
  for (const item of directories) {
    for (const section of directorySections(item)) {
      counts[section] += 1
    }
  }
  return counts
}

export function filterDirectoriesBySection<T extends DirectoryDefinition>(
  directories: T[],
  sectionId: DirectorySectionId,
): T[] {
  if (sectionId === 'all') return directories
  return directories.filter((item) => directorySections(item).includes(sectionId))
}

export function filterDirectoriesBySectionQuery<T extends DirectoryDefinition>(
  directories: T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return directories
  return directories.filter((item) =>
    item.title.toLowerCase().includes(needle)
    || item.key.toLowerCase().includes(needle)
    || item.description.toLowerCase().includes(needle),
  )
}
