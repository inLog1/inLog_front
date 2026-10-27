export type QuerySubscription = {
  unsubscribe: () => void
}

export function releaseQuerySubscriptions(subscriptions: QuerySubscription[]) {
  const pending = subscriptions.splice(0, subscriptions.length)
  for (const subscription of pending) subscription.unsubscribe()
}
