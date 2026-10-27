import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { SessionState, WorkspaceAccess } from './types'

const initialState: SessionState = {
  phase: 'unknown',
  accessState: 'unknown',
  installationPhase: 'ready',
  subjectId: null,
  epoch: 0,
  generation: 0,
  error: null,
  schemaMismatch: false,
  mockWriteLocked: false,
  mockWritesUnavailable: false,
  omitWorkspaceReturn: false,
}

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    beginBootstrap(state) {
      state.phase = 'loading'
      state.subjectId = null
      state.error = null
      state.mockWriteLocked = false
      state.mockWritesUnavailable = false
      state.omitWorkspaceReturn = false
    },
    advanceGeneration(state) {
      state.generation += 1
    },
    setAnonymous(state) {
      state.phase = 'anonymous'
      state.accessState = 'unknown'
      state.subjectId = null
      state.error = null
    },
    setAuthenticated(state, action: PayloadAction<{ subjectId: number | null; accessState: WorkspaceAccess }>) {
      state.phase = 'authenticated'
      state.subjectId = action.payload.subjectId
      state.accessState = action.payload.accessState
      state.error = null
      state.omitWorkspaceReturn = false
    },
    noteUserLogout(state) {
      state.omitWorkspaceReturn = true
    },
    clearWorkspaceReturnOmission(state) {
      state.omitWorkspaceReturn = false
    },
    setAccessState(state, action: PayloadAction<WorkspaceAccess>) {
      if (state.phase !== 'authenticated') return
      state.accessState = action.payload
    },
    setBootstrapError(state, action: PayloadAction<'network' | 'server'>) {
      state.phase = 'error'
      state.error = action.payload
    },
    setInstallationPhase(state, action: PayloadAction<SessionState['installationPhase']>) {
      state.installationPhase = action.payload
    },
    setSchemaMismatch(state, action: PayloadAction<boolean>) {
      state.schemaMismatch = action.payload
    },
    setMockWriteLocked(state, action: PayloadAction<boolean>) {
      state.mockWriteLocked = action.payload
    },
    setMockWritesUnavailable(state, action: PayloadAction<boolean>) {
      state.mockWritesUnavailable = action.payload
    },
    bumpEpoch(state) {
      state.epoch += 1
    },
  },
})

export const sessionActions = sessionSlice.actions
export const sessionReducer = sessionSlice.reducer

export const selectSession = (state: { session: SessionState }) => state.session
