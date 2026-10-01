import { Link, useLocation } from "react-router-dom"
import { cn } from "../../shared/lib/utils"
import { OrgProjectSelector } from "../../features/org-project-selector"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "../../shared/ui/resizable"
import { routes } from "../../shared/lib/routes"

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

    const isActive = (href: string) => {
        return location.pathname.includes(href)
    }

    const showOrgSelector =
      location.pathname.includes(routes.scheduler.list()) ||
      location.pathname.includes(routes.admin.constructor()) ||
      location.pathname.includes(routes.admin.reports())

    if (navItems.length === 0 && !showOrgSelector) {
      return (
        <div className="h-[calc(100vh-64px-8px)] w-full min-w-0 p-4">
          {children}
        </div>
      )
    }

  return (
    <div className="h-[calc(100vh-64px-8px)] w-full">
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        <ResizablePanel
          defaultSize="28%"
          minSize="300px"
          maxSize="40%"
        >
          <nav className="h-full p-4 border-r border-border ">
            {
              location.pathname.includes(routes.scheduler.list()) && (
                <div className="mb-4">
                  <OrgProjectSelector type="all" />
                </div>
              )
            }
            {
              (location.pathname.includes(routes.admin.constructor()) ||
                location.pathname.includes(routes.admin.reports())) && (
                <div className="mb-4">
                  <OrgProjectSelector type="organization" />
                </div>
              )
            }
            
            <div className="space-y-1">
              {navItems.map((item) => (
                <Link 
                  key={item.label} 
                  to={item.href ?? ''} 
                  onClick={item.onClick} 
                  className={cn(
                    "flex cursor-pointer items-center gap-2 p-2 rounded-lg w-full transition-all duration-300 hover:bg-accent/50",
                    isActive(item.href ?? '') && 'bg-accent text-accent-foreground'
                  )}
                >
                  {item.icon && <span className="w-4 h-4">{item.icon}</span>}
                  <span className="text-sm truncate">{item.label}</span>
                </Link>
              ))}
            </div>
          </nav>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize="72%" minSize="60%" className="min-w-0">
          <div className="h-full p-4 pr-0 pl-1 min-w-0">
            <div className="h-[calc(100vh-64px-16px-8px)] pr-0 mr-4 min-w-0">
              {children}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

export default RootPageLayout