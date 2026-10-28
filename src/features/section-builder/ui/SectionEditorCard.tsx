import type { ReactNode } from 'react'

export function SectionEditorCard({
  index,
  title,
  hint,
  children,
}: {
  index: string
  title: string
  hint: string
  children: ReactNode
}) {
  return (
    <section className="min-w-0 rounded-[14px] border border-border bg-card p-4 text-card-foreground sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-[13px] font-semibold text-primary" aria-hidden>
          {index}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground sm:text-lg">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  )
}
