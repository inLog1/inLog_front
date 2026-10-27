import { useEffect, useState } from 'react'

/** Asks before an in-app link or a tab close. It does not save by itself. */
export function useLeaveGuard(active: boolean) {
  const [nextUrl, setNextUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a')
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target && anchor.target !== '_self') return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return
      const url = new URL(href, window.location.href)
      if (url.origin !== window.location.origin) return
      const here = `${window.location.pathname}${window.location.search}`
      const there = `${url.pathname}${url.search}`
      if (here === there) return
      event.preventDefault()
      event.stopPropagation()
      setNextUrl(`${url.pathname}${url.search}${url.hash}`)
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [active])

  return {
    nextUrl,
    dismiss() {
      setNextUrl(null)
    },
  }
}
