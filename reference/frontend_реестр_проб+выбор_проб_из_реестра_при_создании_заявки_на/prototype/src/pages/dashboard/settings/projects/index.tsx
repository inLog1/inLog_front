import { OrganizationsAndProjects } from '../../../../features/organizations-and-projects'

const ProjectsPage = () => (
  <div className="flex h-[calc(100dvh-4rem)] min-h-0 w-full min-w-0 py-3 sm:h-[calc(100dvh-4.5rem)] sm:py-4">
    <OrganizationsAndProjects mode="projects" />
  </div>
)

export default ProjectsPage
