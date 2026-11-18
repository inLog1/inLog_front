import {
  ALL_SAMPLE_INSPECTIONS,
  ALL_SAMPLE_STAGES,
  ALL_SAMPLE_TYPES,
  SAMPLE_INSPECTIONS,
  SAMPLE_ROOT_PAGE_SIZES,
  SAMPLE_STAGES,
  SAMPLE_TYPES,
  buildSampleTree,
  displaySampleStage,
  filterSamples,
  flattenSampleTree,
  sampleRootPageCount,
  sliceSampleRoots,
  type Sample,
  type SampleListCounts,
  type SampleListFilters,
  type SampleRootPageSize,
  type VisibleSampleTreeRow,
} from '../../../../entities/sample'

export type RegistryFilters = SampleListFilters

export function emptyRegistryFilters(): RegistryFilters {
  return {
    search: '',
    sampleType: ALL_SAMPLE_TYPES,
    stage: ALL_SAMPLE_STAGES,
    inspection: ALL_SAMPLE_INSPECTIONS,
  }
}

export function registryFiltersActive(filters: RegistryFilters): boolean {
  const blank = emptyRegistryFilters()
  return filters.search.trim() !== ''
    || filters.sampleType !== blank.sampleType
    || filters.stage !== blank.stage
    || filters.inspection !== blank.inspection
}

export function isSampleRootPageSize(value: number): value is SampleRootPageSize {
  return (SAMPLE_ROOT_PAGE_SIZES as readonly number[]).includes(value)
}

export type RegistryFacetOption = { value: string; count: number }

export function facetOptions(counts: Map<string, number>, values: readonly string[]): RegistryFacetOption[] {
  return values.map((value) => ({ value, count: counts.get(value) ?? 0 }))
}

export function typeFilterValues(): string[] {
  return [ALL_SAMPLE_TYPES, 'Не указан', ...SAMPLE_TYPES]
}

export function inspectionFilterValues(): string[] {
  return [ALL_SAMPLE_INSPECTIONS, ...SAMPLE_INSPECTIONS]
}

export function stageFilterValues(samples: readonly Sample[]): string[] {
  const base = [ALL_SAMPLE_STAGES, 'Не указан', ...SAMPLE_STAGES]
  const known = new Set<string>(base)
  const extra: string[] = []
  for (const item of samples) {
    const stage = displaySampleStage(item.stage) ?? 'Не указан'
    if (!known.has(stage)) {
      known.add(stage)
      extra.push(stage)
    }
  }
  return [...base, ...extra]
}

export type RegistryPage = {
  filteredCount: number
  counts: SampleListCounts
  rootCount: number
  pages: number
  page: number
  rows: VisibleSampleTreeRow[]
}

/**
 * Search and filters come from the domain helper.
 * Pages count root samples; each returned root is flattened with its children.
 */
export function registryPage(
  records: readonly Sample[],
  filters: RegistryFilters,
  page: number,
  pageSize: number,
  expanded: ReadonlySet<string>,
  collapsed: ReadonlySet<string>,
): RegistryPage {
  const { filtered, counts } = filterSamples(records, filters)
  const ordered = filterSamples(records, emptyRegistryFilters()).filtered
  const roots = buildSampleTree(ordered, filtered)
  const pages = sampleRootPageCount(roots.length, pageSize)
  const safePage = Math.min(Math.max(page, 1), pages)
  const rows = flattenSampleTree(sliceSampleRoots(roots, safePage, pageSize), expanded, collapsed, true)
  return {
    filteredCount: filtered.length,
    counts,
    rootCount: roots.length,
    pages,
    page: safePage,
    rows,
  }
}
