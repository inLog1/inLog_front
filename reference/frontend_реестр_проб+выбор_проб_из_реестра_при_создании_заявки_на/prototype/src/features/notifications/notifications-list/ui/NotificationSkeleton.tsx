import { Skeleton } from '../../../../shared/ui/skeleton'

const NotificationSkeleton = () => (
  <div className="relative rounded-md border border-border p-3 sm:p-4">
    <div className="mb-2 flex items-center justify-end gap-2 sm:absolute sm:right-3 sm:top-3 sm:mb-0">
      <Skeleton className="h-3 w-20 sm:h-3.5 sm:w-24" />
      <Skeleton className="h-3.5 w-3.5 rounded-sm sm:h-4 sm:w-4" />
    </div>

    <div className="space-y-1 sm:pr-14">
      <Skeleton className="h-4 w-44 max-w-full" />
      <Skeleton className="h-4 w-28 max-w-full" />
    </div>

    <div className="mt-2.5 flex items-center gap-2">
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      <Skeleton className="h-4 w-36 max-w-full" />
    </div>

    <Skeleton className="mt-2.5 h-4 w-full max-w-md" />

    <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
      <Skeleton className="h-9 w-full rounded-md sm:w-20" />
      <Skeleton className="h-9 w-full rounded-md sm:w-20" />
    </div>
  </div>
)

export default NotificationSkeleton
