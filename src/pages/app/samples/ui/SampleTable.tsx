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
import { SampleInspectionBadge, SampleStatusBadge } from './SampleBadges'
import { SampleTreeToggle } from './SampleTreeToggle'

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
      <TableHeader>
        <TableRow>
          <TableHead className="w-[16%] pl-9 pr-3">{t('samples.columns.id')}</TableHead>
          <TableHead className="w-[7%] px-3">{t('samples.columns.type')}</TableHead>
          <TableHead className="w-[9.5%] px-3">{t('samples.columns.field')}</TableHead>
          <TableHead className="w-[7%] px-3">{t('samples.columns.well')}</TableHead>
          <TableHead className="w-[5%] px-3">{t('samples.columns.formation')}</TableHead>
          <TableHead className="w-[10%] px-3">{t('samples.columns.interval')}</TableHead>
          <TableHead className="w-[7%] px-3">{t('samples.columns.collected')}</TableHead>
          <TableHead className="w-[8.5%] px-3">{t('samples.columns.received')}</TableHead>
          <TableHead className="w-[12%] px-3">{t('samples.columns.stage')}</TableHead>
          <TableHead className="w-[11%] px-3">{t('samples.columns.inspection')}</TableHead>
          <TableHead className="w-[11.5%] px-3">{t('samples.columns.location')}</TableHead>
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
              <TableCell className="pl-2 pr-3">
                <div className="flex min-w-0 items-start gap-1" style={{ paddingLeft: `${Math.min(row.depth, 6) * 16}px` }}>
                  {row.hasChildren ? (
                    <SampleTreeToggle
                      expanded={row.expanded}
                      label={t(row.expanded ? 'samples.tree.collapse' : 'samples.tree.expand', { code: item.code })}
                      onToggle={() => onToggle(item.id, row.expanded)}
                    />
                  ) : <span className="inline-block size-6 shrink-0" aria-hidden />}
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
              <TableCell className="truncate px-3" title={typeKey ? t(typeKey) : type}>{typeKey ? t(typeKey) : type}</TableCell>
              <TableCell className="truncate px-3" title={text(item.field)}>{text(item.field)}</TableCell>
              <TableCell className="truncate px-3" title={text(well)}>{text(well)}</TableCell>
              <TableCell className="truncate px-3" title={text(item.formation)}>{text(item.formation)}</TableCell>
              <TableCell className="px-3" title={intervalTitle}>
                <span className="block truncate">{intervalText}</span>
                {interval.inherited ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{t('samples.interval.inherited-short')}</span> : null}
              </TableCell>
              <TableCell className="whitespace-nowrap px-3">{sampleDay(item.collectedAt, dash)}</TableCell>
              <TableCell className="whitespace-nowrap px-3">{sampleDay(item.receivedAt, dash)}</TableCell>
              <TableCell className="px-3"><SampleStatusBadge value={displaySampleStage(item.stage)} /></TableCell>
              <TableCell className="whitespace-nowrap px-3"><SampleInspectionBadge value={item.inspection} /></TableCell>
              <TableCell className="truncate px-3" title={text(item.location)}>{text(item.location)}</TableCell>
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
