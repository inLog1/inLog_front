export function focusFormField(root: ParentNode | null, field: string) {
  const shell = root?.querySelector<HTMLElement>(`[data-field="${CSS.escape(field)}"]`)
  if (!shell) return
  shell.scrollIntoView({ behavior: 'smooth', block: 'center' })
  const control = shell.querySelector<HTMLElement>('input, textarea, button, select, [role="checkbox"]')
  control?.focus()
}
