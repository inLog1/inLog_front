import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQuery } from './clientApi'

export const platformApi = createApi({
  reducerPath: 'platformApi',
  baseQuery,
  tagTypes: ['Capabilities', 'SessionAccess', 'Installation', 'DevAccounts', 'AccessControl', 'Forms', 'TableViews', 'Sections'],
  endpoints: () => ({}),
})
