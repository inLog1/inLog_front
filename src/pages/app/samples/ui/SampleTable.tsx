import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  displaySampleInterval,
  displaySampleStage,
  displayWell,
  sampleTypeOf,
  type Sample,
  type VisibleSampleTreeRow,
} from '../../../../entities/sample'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../shared/ui/table'
import { sampleDay } from '../model/display'
import { sampleTypeMessageKey } from '../model/labels'
import {
  SAMPLE_REGISTRY_TABLE_COLUMN_ORDER,
  sampleRegistryColumnWidthPercent,
} from '../model/registry-table-columns'
import { SampleInspectionBadge, SampleStatusBadge } from './SampleBadges'
import { SampleTreeToggle } from './SampleTreeToggle'

const registryCellPadding = 'px-3'
const registryIdCellPadding = 'pl-2 pr-2'

export function SampleTable({
  rows,
  samples,
  hrefFor,
  onOpen,
  onToggle,
}: {
  rows: readonly VisibleSampleTreeRow[]
  samples: readonly Sample[]
  hrefFor: (sampleId: string) => string
  onOpen: (sampleId: string) => void
  onToggle: (sampleId: string, expanded: boolean) => void
}) {
  const { t } = useTranslation()
  const dash = t('samples.dash')
  const text = (value: string) => {
    const trimmed = value.trim()
    return trimmed ? trimmed : dash
  }
  return (
    <Table className="min-w-[82rem] table-fixed">
      <colgroup>
        {SAMPLE_REGISTRY_TABLE_COLUMN_ORDER.map((key) => (
          <col key={key} style={{ width: `${sampleRegistryColumnWidthPercent(key)}%` }} />
        ))}
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead className={registryIdCellPadding}>{t('samples.columns.id')}</TableHead>
          <TableHead className={registryCellPadding}>{t('samples.columns.type')}</TableHead>
          <TableHead className={registryCellPadding}>{t('samples.columns.field')}</TableHead>
          <TableHead className={registryCellPadding}>{t('samples.columns.well')}</TableHead>
          <TableHead className={registryCellPadding}>{t('samples.columns.formation')}</TableHead>
          <TableHead className={registryCellPadding}>{t('samples.columns.interval')}</TableHead>
          <TableHead className={registryCellPadding}>{t('samples.columns.collected')}</TableHead>
          <TableHead className={registryCellPadding}>{t('samples.columns.received')}</TableHead>
          <TableHead className={registryCellPadding}>{t('samples.columns.stage')}</TableHead>
          <TableHead className={registryCellPadding}>{t('samples.columns.inspection')}</TableHead>
          <TableHead className={registryCellPadding}>{t('samples.columns.location')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const item = row.sample
          const interval = displaySampleInterval(item)
          const intervalText = text(interval.value)
          const intervalTitle = intervalTitleOf(item, interval.inherited, dash, t)
          const type = sampleTypeOf(item)
          const typeKey = sampleTypeMessageKey(type)
          const parent = item.parentId ? samples.find((sample) => sample.id === item.parentId) : undefined
          const well = displayWell(item.well)
          return (
            <TableRow
              key={item.id}
              className={`cursor-pointer ${row.depth > 0 ? 'bg-muted/30' : ''} ${row.matches ? '' : 'text-muted-foreground'}`}
              onClick={(event) => {
                const target = event.target
                if (target instanceof Element && target.closest('a, button')) return
                onOpen(item.id)
              }}
            >
              <TableCell className={registryIdCellPadding}>
                <div
                  className="flex min-w-0 items-start gap-1"
                  style={row.depth > 0 ? { paddingLeft: `${Math.min(row.depth, 6) * 16}px` } : undefined}
                >
                  {row.hasChildren ? (
                    <SampleTreeToggle
                      expanded={row.expanded}
                      label={t(row.expanded ? 'samples.tree.collapse' : 'samples.tree.expand', { code: item.code })}
                      onToggle={() => onToggle(item.id, row.expanded)}
                    />
                  ) : null}
                  <div className="min-w-0">
                    <Link
                      to={hrefFor(item.id)}
                      className="block min-w-0 truncate font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title={item.code}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {item.code}
                    </Link>
                    {item.parentId && row.depth === 0 ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {t('samples.tree.child')}
                        {' · '}
                        {parent ? (
                          <Link className="underline-offset-4 hover:underline" to={hrefFor(parent.id)} onClick={(event) => event.stopPropagation()}>
                            {parent.code}
                          </Link>
                        ) : t('samples.tree.parent-missing')}
                      </p>
                    ) : null}
                  </div>
                </div>
              </TableCell>
              <TableCell className={`truncate ${registryCellPadding}`} title={typeKey ? t(typeKey) : type}>{typeKey ? t(typeKey) : type}</TableCell>
              <TableCell className={`truncate ${registryCellPadding}`} title={text(item.field)}>{text(item.field)}</TableCell>
              <TableCell className={`truncate ${registryCellPadding}`} title={text(well)}>{text(well)}</TableCell>
              <TableCell className={`truncate ${registryCellPadding}`} title={text(item.formation)}>{text(item.formation)}</TableCell>
              <TableCell className={registryCellPadding} title={intervalTitle}>
                <span className="block truncate">{intervalText}</span>
                {interval.inherited ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{t('samples.interval.inherited-short')}</span> : null}
              </TableCell>
              <TableCell className={`whitespace-nowrap ${registryCellPadding}`}>{sampleDay(item.collectedAt, dash)}</TableCell>
              <TableCell className={`whitespace-nowrap ${registryCellPadding}`}>{sampleDay(item.receivedAt, dash)}</TableCell>
              <TableCell className={registryCellPadding}><SampleStatusBadge value={displaySampleStage(item.stage)} /></TableCell>
              <TableCell className={`whitespace-nowrap ${registryCellPadding}`}><SampleInspectionBadge value={item.inspection} /></TableCell>
              <TableCell className={`truncate ${registryCellPadding}`} title={text(item.location)}>{text(item.location)}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function intervalTitleOf(
  sample: Sample,
  inherited: boolean,
  dash: string,
  t: (key: string, options?: Record<string, string>) => string,
): string {
  const origin = sample.interval.trim() || dash
  if (!sample.parentId) return sample.interval.trim() || dash
  if (inherited) return t('samples.interval.inherited', { origin })
  return t('samples.interval.own', { own: sample.subsampleInterval?.trim() || dash, origin })
}
