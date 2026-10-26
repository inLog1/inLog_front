export type SessionPhase = 'unknown' | 'loading' | 'authenticated' | 'anonymous' | 'error'
export type WorkspaceAccess = 'unknown' | 'ready' | 'pending' | 'blocked'

export type SessionState = {
  phase: SessionPhase
  accessState: WorkspaceAccess
  installationPhase: 'uninitialized' | 'owner-assigned' | 'configuring' | 'ready'
  subjectId: number | null
  epoch: number
  generation: number
  error: 'network' | 'server' | null
  schemaMismatch: boolean
}
