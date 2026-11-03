/** Builds in-module links while preserving org query params. */
export function referenceModuleHref(
  pathname: string,
  search: URLSearchParams,
  mode: 'directories-root' | 'without-directory',
): string {
  const next = new URLSearchParams(search)
  if (mode === 'directories-root') {
    next.delete('tab')
    next.delete('directory')
    next.delete('catalog')
  } else {
    next.delete('directory')
  }
  const qs = next.toString()
  return qs ? `${pathname}?${qs}` : pathname
}
