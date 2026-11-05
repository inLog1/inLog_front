import { Outlet } from 'react-router-dom'
import { useConsumeAccessLocationHint, useScrubAccessWorkspaceParams } from '../../../../features/access-management/model/access-address'

export function AccessRouteShell() {
  useConsumeAccessLocationHint()
  useScrubAccessWorkspaceParams()
  return <Outlet />
}
