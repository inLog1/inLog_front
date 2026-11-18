import { useCallback, useState } from 'react'
import type { AdminDeleteEntityType } from '../ui/AdminDeleteConfirmDialog'

export interface AdminDeleteTarget {
  type: AdminDeleteEntityType
  name: string
  onConfirm: () => Promise<void>
}

export function useAdminDeleteDialog() {
  const [target, setTarget] = useState<AdminDeleteTarget | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const openDeleteDialog = useCallback((nextTarget: AdminDeleteTarget) => {
    setTarget(nextTarget)
  }, [])

  const closeDeleteDialog = useCallback(() => {
    if (!isDeleting) {
      setTarget(null)
    }
  }, [isDeleting])

  const confirmDelete = useCallback(async () => {
    if (!target) {
      return
    }

    setIsDeleting(true)
    try {
      await target.onConfirm()
      setTarget(null)
    } finally {
      setIsDeleting(false)
    }
  }, [target])

  return {
    target,
    isDeleting,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDelete,
  }
}
