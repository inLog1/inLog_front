export type FormListActionKind = 'configure' | 'fill' | 'records' | 'tables'

export type FormListAction = {
  kind: FormListActionKind
  href: string
}

export type FormListActionInput = {
  canUpdate: boolean
  canRecords: boolean
  canViews: boolean
  published: boolean
  hrefs: Record<FormListActionKind, string>
}

/** Primary action is the first permitted destination. The menu keeps the rest. */
export function formListActions(input: FormListActionInput): { primary: FormListAction | null; menu: FormListAction[] } {
  const available: FormListAction[] = []
  if (input.canUpdate) available.push({ kind: 'configure', href: input.hrefs.configure })
  if (input.published) available.push({ kind: 'fill', href: input.hrefs.fill })
  if (input.canRecords) available.push({ kind: 'records', href: input.hrefs.records })
  if (input.canViews) available.push({ kind: 'tables', href: input.hrefs.tables })
  const [primary = null, ...menu] = available
  return { primary, menu }
}
