import { Link, useLocation } from "react-router-dom"
import { cn } from "../../shared/lib/utils"
import { OrgProjectSelector } from "../../features/org-project-selector"
import { routes } from "../../shared/lib/routes"
import { ResponsiveSplit } from "../../shared/ui/responsive-split"

interface NavItem {
  label: string
  icon?: React.ReactNode
  href?: string
  onClick?: () => void
}

interface RootPageLayoutProps {
  children: React.ReactNode
  navItems: NavItem[]
}

const RootPageLayout = ({ 
  children, 
  navItems,
}: RootPageLayoutProps) => {
  const location = useLocation()
  const showOrgSelector =
    location.pathname.includes(routes.scheduler.list()) ||
    location.pathname.includes(routes.admin.constructor()) ||
    location.pathname.includes(routes.admin.reports())

  if (navItems.length === 0 && !showOrgSelector) {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col p-3 sm:p-4">
        <div className="min-h-0 flex-1 overflow-auto">
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 w-full">
      <ResponsiveSplit
        asideDefaultSize="28%"
        asideMinSize="300px"
        asideMaxSize="40%"
        mainDefaultSize="72%"
        mainMinSize="60%"
        aside={<PageRail navItems={navItems} />}
        main={
          <div className="flex h-full min-h-0 min-w-0 flex-col p-3 sm:p-4 lg:py-4 lg:pl-1 lg:pr-0">
            <div className="min-h-0 min-w-0 flex-1 lg:mr-4">
              {children}
            </div>
          </div>
        }
      />
    </div>
  )
}

function PageRail({ navItems }: { navItems: NavItem[] }) {
  const location = useLocation()

  const isActive = (href: string) => {
    return location.pathname.includes(href)
  }

  return (
    <nav className="h-full p-3 sm:p-4 lg:border-r lg:border-border">
      {location.pathname.includes(routes.scheduler.list()) && (
        <div className="mb-4">
          <OrgProjectSelector type="all" />
        </div>
      )}
      {(location.pathname.includes(routes.admin.constructor()) ||
        location.pathname.includes(routes.admin.reports())) && (
        <div className="mb-4">
          <OrgProjectSelector type="organization" />
        </div>
      )}

      <div className="space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.label}
            to={item.href ?? ''}
            onClick={item.onClick}
            className={cn(
              "flex cursor-pointer items-center gap-2 w-full rounded-lg p-2 transition-all duration-300 hover:bg-accent/50",
              isActive(item.href ?? '') && 'bg-accent text-accent-foreground'
            )}
          >
            {item.icon && <span className="h-4 w-4">{item.icon}</span>}
            <span className="truncate text-sm">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}

export default RootPageLayout
