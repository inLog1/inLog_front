const KEY = 'inlog:task-compose'

export function requestCreateTask(): void {
  try {
    sessionStorage.setItem(KEY, 'create')
  } catch {
    // The tasks screen still opens; the person can use its create button.
  }
}

export function peekCreateTaskRequest(): boolean {
  try {
    return sessionStorage.getItem(KEY) === 'create'
  } catch {
    return false
  }
}

export function clearCreateTaskRequest(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Nothing else stores this flag.
  }
}
