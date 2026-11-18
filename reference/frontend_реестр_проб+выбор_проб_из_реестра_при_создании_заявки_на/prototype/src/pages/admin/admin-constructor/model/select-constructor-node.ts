import type { AdminPanelNode } from '../../../../entities/admin/model/types'
import { getTopmostNodeId } from '../../../../features/constructor/constructor-tree/utils'

/**
 * `currentNodes` is the query `currentData` for the organization now on screen.
 * While that list is absent, the previous organization's nodes must not stay selected.
 */
export function selectConstructorNode(
  currentNodes: readonly Pick<AdminPanelNode, 'id' | 'parent'>[] | undefined,
  nodeParam: number | null,
): number | null {
  if (!currentNodes?.length) return null
  if (nodeParam != null && currentNodes.some((node) => node.id === nodeParam)) return nodeParam
  return getTopmostNodeId(currentNodes as AdminPanelNode[])
}

/** A write started on one organization and node does not belong to a later screen. */
export function constructorResultMatchesScreen(
  started: { organizationId: number; nodeId?: number | null },
  screen: { organizationId: number | null; nodeId: number | null },
): boolean {
  if (started.organizationId !== screen.organizationId) return false
  if (started.nodeId == null) return true
  return started.nodeId === screen.nodeId
}
