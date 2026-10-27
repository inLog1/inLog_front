import { Link, useLocation } from "react-router-dom"
import type { ReactNode } from "react"
import { cn } from "../../shared/lib/utils"

interface NavItem {
  label: string
  icon?: ReactNode
  href?: string
  onClick?: () => void
}

interface RootPageLayoutProps {
  children: ReactNode
  navItems: NavItem[]
}

const RootPageLayout = ({
  children,
  navItems,
}: RootPageLayoutProps) => {
  const location = useLocation()

  const isActive = (href: string) => {
    const path = href.split('?')[0]
    return location.pathname === path || location.pathname.startsWith(`${path}/`)
  }

  if (navItems.length === 0) {
    return (
      <div className="h-full min-h-0 w-full min-w-0 overflow-auto p-4">
        {children}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col lg:flex-row">
      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border p-2 lg:w-56 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r">
        {navItems.map((item) => (
          <Link
            key={item.label}
            to={item.href ?? ''}
            onClick={item.onClick}
            className={cn(
              "flex min-w-0 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:shrink",
              item.href && isActive(item.href) && 'bg-accent text-accent-foreground',
            )}
          >
            {item.icon && <span className="h-4 w-4">{item.icon}</span>}
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto p-2">
        {children}
      </div>
    </div>
  )
}

export default RootPageLayout
