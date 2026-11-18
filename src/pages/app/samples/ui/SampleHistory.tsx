import { useTranslation } from 'react-i18next'
import type { SampleEvent } from '../../../../entities/sample'
import { formatSampleEventWhen } from '../model/display'

export function SampleHistory({
  events,
  loading,
  failed,
}: {
  events: readonly SampleEvent[]
  loading: boolean
  failed: boolean
}) {
  const { t, i18n } = useTranslation()
  const ordered = [...events].reverse()
  return (
    <section aria-labelledby="sample-history-title">
      <div className="border-b border-border px-4 py-4 md:px-6">
        <h2 id="sample-history-title" className="text-base font-semibold text-foreground">{t('samples.history.title')}</h2>
      </div>
      <div className="px-4 py-4 text-sm text-foreground md:px-6">
        {failed ? <p className="text-destructive" role="alert">{t('samples.history.error')}</p> : null}
        {loading ? <p className="text-muted-foreground" role="status">{t('samples.history.loading')}</p> : null}
        {!failed && !loading && ordered.length === 0 ? <p className="text-muted-foreground">{t('samples.history.empty')}</p> : null}
        {!failed && !loading && ordered.length > 0 ? (
          <ol className="space-y-4 border-l border-border pl-4">
            {ordered.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="relative space-y-1">
                <span className="absolute -left-[1.3125rem] top-1.5 size-2.5 rounded-full border-2 border-card bg-primary" aria-hidden />
                <p className="break-words font-medium">{entry.text}</p>
                <p className="text-muted-foreground">
                  {entry.actor?.trim() || t('samples.history.unknown-author')}
                  {' · '}
                  {formatSampleEventWhen(entry.at, i18n.language)}
                </p>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  )
}
