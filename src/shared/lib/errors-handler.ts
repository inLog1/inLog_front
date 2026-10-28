import { t, type TFunction } from 'i18next';
import { toast } from 'sonner'

// Тип для типичной ошибки от твоего бэкенда
interface BackendErrorResponse {
  detail?: string
  messages?: string[]
  fieldsErrors?: Array<{ field: string; message: string }>
  [key: string]: any
}

// Проверяем, является ли ошибка от RTK Query
function organizationFailure(code: string, translFunc: TFunction<["translation", ...string[]], undefined>): string | null {
  if (code === 'forbidden' || code === 'blocked' || code === 'pending') return translFunc('errors.organization-forbidden')
  if (code === 'invalid_organization' || code === 'invalid_project' || code === 'invalid_revision') return translFunc('errors.organization-invalid')
  if (code === 'invalid_identity') return translFunc('errors.organization-identity')
  if (code === 'stale_write') return translFunc('errors.organization-stale')
  if (code === 'mock_writer_held' || code === 'writer_lock_unavailable') return translFunc('errors.writer-held')
  return null
}

function isRTKQueryError(error: unknown): error is { status: number; data: BackendErrorResponse } {
  return (error as any).status && (error as any).data
}

export const errorsHandler = (
  error: unknown,
  translFunc: TFunction<["translation", ...string[]], undefined> = t // fallback, если t не передан
) => {

  // 1. Сетевые ошибки или таймауты
  if (error instanceof Error && error.message === 'Network Error') {
    toast.error(translFunc('errors.network-error'))
    return
  }

  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status
    if (status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR') {
      toast.error(translFunc('errors.network-error'))
      return
    }
  }

  // 2. Ошибки RTK Query / Fetch
  if (isRTKQueryError(error)) {
    const { status, data } = error

    // Общие серверные ошибки без детализации
    if ([404, 500, 405].includes(Number(status)) && !data?.detail) {
      toast.error(translFunc('errors.server-error'))
      return
    }

    if (typeof data?.code === 'string') {
      const known = organizationFailure(data.code, translFunc)
      if (known) {
        toast.error(known)
        return
      }
    }

    // 3. Ошибка с detail (самый частый случай)
    if (data?.detail) {
      toast.error(data.detail)
      return
    }

    if (typeof data?.code === 'string') {
      toast.error(data.code)
      return
    }

    // 4. Ошибки в messages (массив строк)
    if (data?.messages?.length) {
      data.messages.forEach((msg: string) => {
        toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg))
      })
      return
    }

    // 5. Field-specific ошибки (fieldsErrors или просто объект { field: ['msg'] })
    if (data?.fieldsErrors?.length) {
      data.fieldsErrors.forEach((err: { field: string; message: string }) => {
        toast.error(`${err.field}: ${err.message}`)
      })
      return
    }

    // 6. Объект с полями-ошибками (старый формат { email: ['invalid'] })
    if (typeof data === 'object' && data !== null) {
      Object.entries(data).forEach(([field, messages]) => {
        if (Array.isArray(messages)) {
          messages.forEach((msg) => {
            toast.error(`${field}: ${msg}`)
          })
        } else if (typeof messages === 'string') {
          toast.error(`${field}: ${messages}`)
        }
      })
      return
    }

    // 7. Последний fallback
    toast.error(translFunc('errors.something-went-wrong'))
    return
  }

  // 8. Любая другая неизвестная ошибка
  toast.error(translFunc('errors.something-went-wrong'))
}