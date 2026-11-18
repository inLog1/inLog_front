import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { applyPopstate, historyIndex, internalLinkTarget, locationKey } from './leave-guard'

/**
 * Blocks in-app links, browser back/forward, and tab close while `active`.
 * The popstate listener is registered once, outside React, because a listener
 * added from an effect does not receive the browser's own back/forward event.
 * The undo step is swallowed too: if the router sees it, the editor reloads
 * and the unsaved values disappear. This hook does not save.
 */

type PopGuard = {
  active: () => boolean
  here: () => string
  hereIndex: () => number | null
  skipPops: { current: number }
  prompt: (url: string) => void
}

let popGuard: PopGuard | null = null

function onWindowPop(event: PopStateEvent) {
  if (!popGuard) return
  const plan = applyPopstate({
    skipping: popGuard.skipPops.current,
    active: popGuard.active(),
    here: popGuard.here(),
    destination: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    hereIndex: popGuard.hereIndex(),
    destinationIndex: historyIndex(window.history.state),
  })
  popGuard.skipPops.current = plan.skipping
  if (plan.action !== 'stop') return
  event.stopImmediatePropagation()
  if (plan.undo != null) {
    const undo = plan.undo
    // go() during the popstate task is ignored for forward, so restore on
    // the next turn. The following pop is swallowed via skipPops.
    window.setTimeout(() => window.history.go(undo), 30)
    if (plan.prompt) popGuard.prompt(plan.prompt)
  }
}

if (typeof window !== 'undefined') {
  const host = window as Window & { __inlogFormPop?: (event: PopStateEvent) => void; __inlogFormPopBound?: boolean }
  host.__inlogFormPop = onWindowPop
  if (!host.__inlogFormPopBound) {
    host.__inlogFormPopBound = true
    window.addEventListener('popstate', (event) => host.__inlogFormPop?.(event), true)
  }
}

export function useLeaveGuard(active: boolean) {
  const location = useLocation()
  const here = locationKey(location)
  const [nextUrl, setNextUrl] = useState<string | null>(null)
  const activeRef = useRef(active)
  const hereRef = useRef(here)
  const hereIndexRef = useRef<number | null>(null)
  const skipPops = useRef(0)

  useEffect(() => {
    activeRef.current = active
    hereRef.current = here
    hereIndexRef.current = historyIndex(window.history.state)
  }, [active, here])

  useEffect(() => {
    if (!active) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const anchor = event.target.closest('a')
      if (!(anchor instanceof HTMLAnchorElement)) return
      const next = internalLinkTarget({
        href: anchor.getAttribute('href'),
        target: anchor.target,
        button: event.button,
        modified: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
        defaultPrevented: event.defaultPrevented,
        origin: window.location.origin,
        current: hereRef.current,
        base: window.location.href,
      })
      if (!next) return
      event.preventDefault()
      event.stopPropagation()
      setNextUrl(next)
    }
    const guard: PopGuard = {
      active: () => activeRef.current,
      here: () => hereRef.current,
      hereIndex: () => hereIndexRef.current,
      skipPops,
      prompt: setNextUrl,
    }
    popGuard = guard
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      if (popGuard === guard) popGuard = null
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
