import {
  Building2,
  FlaskConical,
  LayoutGrid,
  MoreHorizontal,
  Ruler,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../../shared/lib/utils'
import { Input } from '../../../shared/ui/input'
import {
  DIRECTORY_SECTION_IDS,
  type DirectorySectionId,
  sectionCounts,
} from '../model/directory-sections'
import type { DirectoryDefinition } from '../../../entities/personnel/model/types'

const SECTION_ICONS: Record<Exclude<DirectorySectionId, 'all'>, LucideIcon> = {
  equipment: Wrench,
  'test-requests': FlaskConical,
  'org-structure': Building2,
  personnel: Users,
  measurements: Ruler,
  other: MoreHorizontal,
}

export function DirectoryCategorySidebar({
  directories,
  sectionId,
  sectionQuery,
  onSectionChange,
  onSectionQueryChange,
}: {
  directories: DirectoryDefinition[]
  sectionId: DirectorySectionId
  sectionQuery: string
  onSectionChange: (sectionId: DirectorySectionId) => void
  onSectionQueryChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const counts = sectionCounts(directories)
  const needle = sectionQuery.trim().toLowerCase()
  const visibleSections = DIRECTORY_SECTION_IDS.filter((id) => {
    if (!needle) return true
    return t(`directories.sections.${id}`).toLowerCase().includes(needle)
  })

  return (
    <aside className="rounded-xl border border-border bg-card p-3 lg:w-[280px] lg:shrink-0">
      <Input
        value={sectionQuery}
        onChange={(event) => onSectionQueryChange(event.target.value)}
        placeholder={t('directories.search-sections')}
        aria-label={t('directories.search-sections')}
        className="mb-3"
      />
      <nav className="flex flex-col gap-1" aria-label={t('directories.sections-nav')}>
        {visibleSections.map((id) => {
          const Icon = id === 'all' ? LayoutGrid : SECTION_ICONS[id]
          const active = sectionId === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSectionChange(id)}
              className={cn(
                'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                active
                  ? 'border-primary/30 bg-primary/10 font-medium text-primary'
                  : 'border-transparent text-foreground hover:bg-muted/60',
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                <span className="truncate">{t(`directories.sections.${id}`)}</span>
              </span>
              <span className={cn('shrink-0 text-xs tabular-nums', active ? 'text-primary' : 'text-muted-foreground')}>
                {counts[id]}
              </span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
