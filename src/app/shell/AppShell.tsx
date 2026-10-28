import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, Building2, FileText, LayoutDashboard, ListTodo, PanelsTopLeft, PieChart, Shield, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { matchPath, Outlet, useLocation } from 'react-router-dom'
import { sectionPath } from '../../entities/section'
import { sectionIcon } from '../../features/section-builder/ui/icons'
import { useOrganizationSectionLinks } from '../navigation/use-section-navigation'
import {
  APP_SECTIONS,
  sectionByPath,
  showsProjectSelector,
  visibleNavigation,
  type AppSection,
} from '../navigation/catalog'
import { useNavigationInput } from '../navigation/use-navigation'
import { useWorkspaceHref } from '../../features/org-project-selector/model/useEnsureOrgProjectParams'
import type { WorkspaceLinkScope } from '../../features/org-project-selector/model/workspace-context'
import { isPlatformConsolePath, routes } from '../../shared/lib/routes'
import { useGetMeQuery } from '../../entities/user/model/userSlice'
import { PageHeadingProvider, usePageHeading, type PageCrumb } from '../../shared/ui/page'
import { Header } from '../../widgets/header'
import { Sidebar, SidebarDrawer, type SidebarGroupModel, type SidebarLinkModel } from '../../widgets/sidebar'

const ICONS: Record<string, LucideIcon> = {
  home: LayoutDashboard,
  tasks: ListTodo,
  constructor: Wrench,
  forms: FileText,
  reports: PieChart,
  notifications: Bell,
  access: Shield,
  sections: PanelsTopLeft,
  'organizations-settings': Building2,
}

function linkScope(section: AppSection): WorkspaceLinkScope {
  if (section.context === 'project') return 'project'
  if (section.context === 'organization') return 'organization'
  return 'app'
}

export function AppShell() {
  return (
    <PageHeadingProvider>
      <Shell />
    </PageHeadingProvider>
  )
}

function Shell() {
  const { t } = useTranslation()
  useGetMeQuery()
  const location = useLocation()
  const href = useWorkspaceHref()
  const navigation = useNavigationInput()
  const pageLabel = usePageHeading()
  const locationKey = `${location.pathname}${location.search}`
  const [menuPath, setMenuPath] = useState<string | null>(null)
  const menuOpen = menuPath === locationKey
  const closeMenu = useCallback(() => setMenuPath(null), [])
  const openMenu = useCallback(() => setMenuPath(locationKey), [locationKey])
  const shell = isPlatformConsolePath(location.pathname) ? 'platform' : 'user'

  useEffect(() => {
    document.documentElement.dataset.shell = shell
    return () => {
      delete document.documentElement.dataset.shell
    }
  }, [shell])

  const sections = visibleNavigation(navigation)
  const organizationSections = useOrganizationSectionLinks(navigation.organizationId, navigation.grants, navigation.enforceGrants)

  const groups = useMemo<SidebarGroupModel[]>(() => {
    const toLink = (section: AppSection): SidebarLinkModel => ({
      id: section.id,
      label: t(section.labelKey),
      to: href(section.path, linkScope(section)),
      icon: ICONS[section.id] ?? LayoutDashboard,
      end: section.id === 'home',
    })
    const primary = sections.filter((section) => section.group === 'primary')
    const published = organizationSections.items.map((item) => ({
      id: item.id,
      label: item.title,
      to: href(sectionPath(item.id), 'organization'),
      icon: sectionIcon(item.iconKey),
    }))
    const work = sections.filter((section) => section.group === 'work').map(toLink)
    const settings = sections.filter((section) => section.group === 'settings').map(toLink)
    return [
      { id: 'primary', label: t('home.title'), items: primary.map(toLink) },
      { id: 'work', label: t('shell.work'), items: [...published, ...work] },
      { id: 'settings', label: t('shell.settings'), items: settings },
    ].filter((group) => group.items.length > 0)
  }, [href, organizationSections.items, sections, t])

  const profile = APP_SECTIONS.find((section) => section.id === 'profile')
  const home = sections.find((section) => section.id === 'home')
  const current = sectionByPath(location.pathname)
  const onWorkSection = matchPath({ path: '/workspace/sections/:sectionId', end: true }, location.pathname)
  const profileTo = profile ? href(profile.path, 'app') : '/settings/profile'
  const homeTo = home ? href(home.path, 'app') : href(routes.dashboard(), 'app')
  const area = t('shell.area')
  const currentLabel = pageLabel
    ?? (onWorkSection ? t('nav.section-page') : current && current.id !== 'home' ? t(current.labelKey) : null)
  const crumbs: PageCrumb[] = currentLabel
    ? [{ label: area, to: homeTo }, { label: currentLabel }]
    : [{ label: area }]
  const accountNote = navigation.systemCapabilities.includes('corporate_superadmin')
    ? t('home.owner-badge')
    : undefined

  return (
    <div data-shell={shell} className="flex h-screen min-w-0 overflow-hidden bg-background text-foreground">
      <div className="hidden h-full shrink-0 md:flex">
        <Sidebar homeTo={homeTo} groups={groups} profileTo={profileTo} accountNote={accountNote} />
      </div>
      <SidebarDrawer open={menuOpen} onClose={closeMenu}>
        <Sidebar homeTo={homeTo} groups={groups} profileTo={profileTo} accountNote={accountNote} onNavigate={closeMenu} />
      </SidebarDrawer>
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <Header
          crumbs={crumbs}
          showProject={showsProjectSelector(location.pathname)}
          menuOpen={menuOpen}
          onOpenMenu={openMenu}
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-background pb-16">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
