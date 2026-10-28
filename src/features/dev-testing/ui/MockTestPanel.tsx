import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import { selectSession, sessionActions } from '../../../entities/session'
import { requestLogout } from '../../../shared/api/session-events'
import { readAccessToken } from '../../../shared/api/session-storage'
import { routes } from '../../../shared/lib/routes'
import { cn } from '../../../shared/lib/utils'
import { badgeVariants } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import {
  useGetDevAccountsQuery,
  useResetDevFixturesMutation,
  useSwitchDevUserMutation,
  useUpdateDevSettingsMutation,
} from '../model/devApi'
import { beginDevSwitch, isCurrentDevSwitch } from '../model/dev-switch'
import { MOCK_TEST_PANEL_LAUNCHER, MOCK_TEST_PANEL_OPEN } from '../model/panel-position'

export function MockTestPanel() {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const writeLocked = useSelector(selectSession).mockWriteLocked
  const writesUnavailable = useSelector(selectSession).mockWritesUnavailable
  const navigate = useNavigate()
  const location = useLocation()
  const accounts = useGetDevAccountsQuery()
  const [switchUser] = useSwitchDevUserMutation()
  const [updateSettings] = useUpdateDevSettingsMutation()
  const [resetFixtures] = useResetDevFixturesMutation()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const refreshSession = () => {
    dispatch(sessionActions.beginBootstrap())
    dispatch(sessionActions.bumpEpoch())
    if (location.pathname === routes.login()) navigate(routes.dashboard())
  }

  const quickSwitch = async (userId: number) => {
    const ticket = beginDevSwitch()
    setMessage(null)
    await requestLogout({ reason: 'switch', callApi: false, navigate: false })
    if (!isCurrentDevSwitch(ticket)) return
    try {
      await switchUser({ userId }).unwrap()
      if (!isCurrentDevSwitch(ticket)) return
      refreshSession()
    } catch {
      if (!isCurrentDevSwitch(ticket)) return
      setMessage(t('dev-panel.switch-failed'))
      dispatch(sessionActions.bumpEpoch())
    }
  }

  const changeMode = async (authMode: 'local' | 'sso' | 'mixed') => {
    await requestLogout({ reason: 'preset', callApi: false, navigate: false })
    await updateSettings({ authMode }).unwrap()
    dispatch(sessionActions.bumpEpoch())
    navigate(routes.login())
  }

  const changePreset = async (installationPhase: 'ready' | 'uninitialized') => {
    if (!window.confirm(t('dev-panel.preset-confirm'))) return
    await requestLogout({ reason: 'preset', callApi: false, navigate: false })
    await updateSettings({ installationPhase }).unwrap()
    dispatch(sessionActions.bumpEpoch())
    navigate(routes.login())
  }

  const setFault = async (path: string, kind: 'unauthorized' | 'forbidden' | 'network' | 'server' | 'cancel') => {
    await updateSettings({ fault: { path, kind } }).unwrap()
    setMessage(t('dev-panel.fault-armed', { path }))
  }

  const checkForbidden = async () => {
    await updateSettings({ fault: { path: 'mock/test-resource/', kind: 'forbidden' } }).unwrap()
    const token = readAccessToken()
    const response = await fetch('/mock-api/mock/test-resource/?organization=101', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    setMessage(`${response.status}`)
  }

  const reset = async () => {
    if (!window.confirm(t('dev-panel.reset-confirm'))) return
    try {
      await resetFixtures().unwrap()
    } catch (error) {
      const code = error && typeof error === 'object' && 'data' in error
        && (error as { data?: { code?: unknown } }).data?.code
      setMessage(t(code === 'mock_writer_held' ? 'dev-panel.reset-blocked' : 'dev-panel.reset-failed'))
      return
    }
    await requestLogout({ reason: 'reset', callApi: false })
    dispatch(sessionActions.bumpEpoch())
    navigate(routes.login())
  }

  const copyValue = async (accountId: number, field: 'email' | 'password', value: string) => {
    const key = `${accountId}:${field}`
    const markCopied = () => {
      setMessage(null)
      setCopied(key)
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1500)
    }
    try {
      await navigator.clipboard.writeText(value)
      markCopied()
    } catch {
      const area = document.createElement('textarea')
      area.value = value
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.left = '0'
      area.style.top = '0'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.focus()
      area.select()
      const copiedNow = document.execCommand('copy')
      area.remove()
      if (copiedNow) markCopied()
      else setMessage(t('dev-panel.copy-failed'))
    }
  }

  const addSwitchAuthor = async () => {
    await updateSettings({ ensureFormsSwitchAuthor: true }).unwrap()
    setMessage(t('dev-panel.switch-author-ready'))
  }

  if (!open) {
    return (
      <div className={MOCK_TEST_PANEL_LAUNCHER}>
        {writesUnavailable && <p className="rounded-xl border border-border bg-card p-3 text-xs text-card-foreground shadow-lg" role="status">{t('dev-panel.writes-unavailable')}</p>}
        {writeLocked && <p className="rounded-xl border border-border bg-card p-3 text-xs text-card-foreground shadow-lg" role="status">{t('dev-panel.reset-blocked')}</p>}
        <button
          type="button"
          className="rounded-full border border-border bg-card px-3 py-2 text-xs text-card-foreground shadow"
          onClick={() => setOpen(true)}
        >
          {t('dev-panel.title')}
        </button>
      </div>
    )
  }

  return (
    <aside className={MOCK_TEST_PANEL_OPEN}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 py-2">
        <strong className="text-sm">{t('dev-panel.title')}</strong>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>{t('dev-panel.hide')}</Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      <p className="mb-3 text-muted-foreground">{t('dev-panel.caption')}</p>
      {writesUnavailable && <p className="mb-3 rounded-md bg-muted px-2 py-1.5 text-muted-foreground" role="status">{t('dev-panel.writes-unavailable')}</p>}
      {writeLocked && <p className="mb-3 rounded-md bg-muted px-2 py-1.5 text-muted-foreground" role="status">{t('dev-panel.reset-blocked')}</p>}
      <div className="space-y-2">
        {accounts.data?.map((account) => (
          <div
            key={account.id}
            className="rounded-lg border border-border bg-background px-3 py-2 shadow-sm"
          >
            <button
              type="button"
              className="block w-full rounded-md text-left text-sm font-medium text-foreground hover:text-primary"
              onClick={() => void quickSwitch(account.id)}
            >
              {account.fullName || account.email}
            </button>
            <div className="mt-1 flex items-center gap-1">
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{account.email}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0"
                aria-label={copied === `${account.id}:email` ? t('dev-panel.copied') : t('dev-panel.copy-email')}
                onClick={() => void copyValue(account.id, 'email', account.email)}
              >
                {copied === `${account.id}:email` ? <Check /> : <Copy />}
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
                {t('dev-panel.password')} {account.password}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0"
                aria-label={copied === `${account.id}:password` ? t('dev-panel.copied') : t('dev-panel.copy-password')}
                onClick={() => void copyValue(account.id, 'password', account.password)}
              >
                {copied === `${account.id}:password` ? <Check /> : <Copy />}
              </Button>
            </div>
            <span className="mt-2 flex flex-wrap gap-1">
              <span className={cn(badgeVariants({ variant: 'secondary' }), 'font-normal')}>
                {t(`dev-panel.access-${account.accessState}`)}
              </span>
              <span className={cn(badgeVariants({ variant: 'outline' }), 'font-normal')}>
                {account.systemCapabilities.join(', ') || t('dev-panel.no-capability')}
              </span>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        <Button type="button" size="sm" variant="outline" onClick={() => void changeMode('local')}>local</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void changeMode('sso')}>sso</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void changeMode('mixed')}>mixed</Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Button type="button" size="sm" variant="outline" onClick={() => void changePreset('ready')}>{t('dev-panel.ready')}</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void changePreset('uninitialized')}>{t('dev-panel.uninitialized')}</Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Button type="button" size="sm" variant="outline" onClick={() => void setFault('auth/token/verify/', 'unauthorized')}>401</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void checkForbidden()}>403</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void setFault('users/me/', 'network')}>{t('dev-panel.network')}</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void setFault('users/me/', 'server')}>5xx</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void setFault('auth/mock-sso/complete/', 'cancel')}>{t('dev-panel.sso-cancel')}</Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {accounts.data?.map((account) => (
          <Button
            key={`block-${account.id}`}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void updateSettings(account.status === 'blocked'
              ? { clearBlockedUserId: account.id }
              : { blockedUserId: account.id }).then(() => dispatch(sessionActions.bumpEpoch()))}
          >
            {account.status === 'blocked' ? t('dev-panel.unblock') : t('dev-panel.block')} {account.email}
          </Button>
        ))}
      </div>
      <Button type="button" size="sm" className="mt-3" variant="outline" onClick={() => void addSwitchAuthor()}>
        {t('dev-panel.switch-author')}
      </Button>
      <Button type="button" size="sm" className="mt-3" variant="destructive" onClick={() => void reset()}>
        {t('dev-panel.reset')}
      </Button>
      {message && <p className="mt-2" role="status">{message}</p>}
      </div>
    </aside>
  )
}

export default MockTestPanel
