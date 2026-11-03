import type { DirectoryDefinition } from '../../../entities/personnel/model/types'
import type { DirectorySectionId } from './directory-sections'
import { filterDirectoriesBySection, filterDirectoriesBySectionQuery, primarySection } from './directory-sections'

export type DirectorySortKey = 'title' | 'section' | 'type' | 'status'
export type SortDirection = 'asc' | 'desc'

export const DIRECTORY_PAGE_SIZES = [10, 20, 50] as const

export function sortDirectories<T extends DirectoryDefinition>(
  directories: T[],
  sortKey: DirectorySortKey,
  direction: SortDirection,
): T[] {
  const factor = direction === 'asc' ? 1 : -1
  return [...directories].sort((left, right) => {
    if (sortKey === 'title') return left.title.localeCompare(right.title, 'ru') * factor
    if (sortKey === 'section') {
      return primarySection(left).localeCompare(primarySection(right), 'ru') * factor
    }
    if (sortKey === 'type') {
      const leftType = left.source.type === 'registry' ? left.source.registry : 'manual'
      const rightType = right.source.type === 'registry' ? right.source.registry : 'manual'
      return leftType.localeCompare(rightType, 'ru') * factor
    }
    return Number(left.archived) - Number(right.archived) === 0
      ? left.title.localeCompare(right.title, 'ru') * factor
      : (Number(left.archived) - Number(right.archived)) * factor
  })
}

export function paginateDirectories<T>(items: T[], page: number, pageSize: number): T[] {
  const safePage = Math.max(1, page)
  const start = (safePage - 1) * pageSize
  return items.slice(start, start + pageSize)
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

export function filterDirectoryList<T extends DirectoryDefinition>(
  directories: T[],
  sectionId: DirectorySectionId,
  query: string,
): T[] {
  return filterDirectoriesBySectionQuery(filterDirectoriesBySection(directories, sectionId), query)
}
