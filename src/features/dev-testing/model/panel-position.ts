/**
 * Below the header and to the right of the desktop sidebar, so the launcher
 * does not cover logout or the form actions at the top of the page.
 * The open panel uses the same corner and cannot extend past the viewport.
 */
export const MOCK_TEST_PANEL_LAUNCHER = 'fixed bottom-3 left-3 z-30 flex max-w-[calc(100vw-1.5rem)] flex-col items-start gap-2 md:left-64'
export const MOCK_TEST_PANEL_OPEN = 'fixed bottom-3 left-3 z-30 max-h-[70vh] w-[min(20rem,calc(100vw-1.5rem))] overflow-auto rounded-xl border border-border bg-card p-3 text-xs text-card-foreground shadow-lg md:left-64'
