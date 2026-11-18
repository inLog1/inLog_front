const KEY = 'inlog:task-compose'

/** A task compose request is only started when a project is already selected. */
export function shouldComposeTask(projectId: number | null): boolean {
  return typeof projectId === 'number' && Number.isInteger(projectId) && projectId > 0
}

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
