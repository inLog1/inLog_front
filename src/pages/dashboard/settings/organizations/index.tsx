import { OrganizationsAndProjects } from '../../../../features/organizations-and-projects'

const OrganizationsPage = () => (
  <div className="flex h-[calc(100dvh-4rem)] min-h-0 w-full min-w-0 p-3 sm:h-[calc(100dvh-4.5rem)] sm:p-4">
    <OrganizationsAndProjects mode="organizations" />
  </div>
)

export default OrganizationsPage
