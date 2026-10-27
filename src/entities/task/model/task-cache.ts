export function taskListQueryMatchesProject(originalArgs: unknown, projectId: number): boolean {
  if (!originalArgs || typeof originalArgs !== 'object') return false
  return (originalArgs as { projectId?: unknown }).projectId === projectId
}
