export function useSuspenseQuery<T>(query: {
    data?: T
    isLoading: boolean
    error?: any
  }) {
    if (query.error) {
      throw query.error
    }
  
    if (query.isLoading) {
      throw new Promise(() => {})
    }
  
    return query.data
  }