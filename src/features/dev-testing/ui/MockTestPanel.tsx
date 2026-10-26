import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import { sessionActions } from '../../../entities/session'
import { requestLogout } from '../../../shared/api/session-events'
import { readAccessToken } from '../../../shared/api/session-storage'
import { routes } from '../../../shared/lib/routes'
import { Button } from '../../../shared/ui/button'
import {
  useGetDevAccountsQuery,
  useResetDevFixturesMutation,
  useSwitchDevUserMutation,
  useUpdateDevSettingsMutation,
} from '../model/devApi'
import { beginDevSwitch, isCurrentDevSwitch } from '../model/dev-switch'

export function MockTestPanel() {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const accounts = useGetDevAccountsQuery()
  const [switchUser] = useSwitchDevUserMutation()
  const [updateSettings] = useUpdateDevSettingsMutation()
  const [resetFixtures] = useResetDevFixturesMutation()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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
    await resetFixtures().unwrap()
    await requestLogout({ reason: 'reset', callApi: false })
    dispatch(sessionActions.bumpEpoch())
    navigate(routes.login())
  }

  if (!open) {
    return (
      <button
        type="button"
        className="fixed bottom-4 right-4 z-50 rounded-full border border-border bg-card px-3 py-2 text-xs text-card-foreground shadow"
        onClick={() => setOpen(true)}
      >
        {t('dev-panel.title')}
      </button>
    )
  }

  return (
    <aside className="fixed bottom-4 right-4 z-50 max-h-[70vh] w-[320px] overflow-auto rounded-xl border border-border bg-card p-3 text-xs text-card-foreground shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <strong>{t('dev-panel.title')}</strong>
        <button type="button" onClick={() => setOpen(false)}>{t('dev-panel.hide')}</button>
      </div>
      <p className="mb-2 text-muted-foreground">{t('dev-panel.caption')}</p>
      <div className="space-y-1">
        {accounts.data?.map((account) => (
          <button
            key={account.id}
            type="button"
            className="block w-full rounded border px-2 py-1 text-left"
            onClick={() => void quickSwitch(account.id)}
          >
            <span className="block font-medium">{account.fullName || account.email}</span>
            <span className="text-muted-foreground">
              {account.email} · {account.accessState} · {account.systemCapabilities.join(', ') || t('dev-panel.no-capability')}
            </span>
          </button>
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
      <Button type="button" size="sm" className="mt-3" variant="destructive" onClick={() => void reset()}>
        {t('dev-panel.reset')}
      </Button>
      {message && <p className="mt-2" role="status">{message}</p>}
    </aside>
  )
}

export default MockTestPanel
