import { useTranslation } from 'react-i18next'
import RootPageLayout from '../../../widgets/root-page-layout'
import { routes } from '../../../shared/lib/routes'
import { useWorkspaceHref } from '../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { Outlet } from 'react-router-dom'

interface NavItem {
    label: string
    href?: string
    onClick?: () => void
}

const SchedulerPage = () => {
    const { t } = useTranslation()
    const href = useWorkspaceHref()

    const navItems: NavItem[] = [
        {
            label: t('scheduler-page.tasks'),
            href: href(routes.scheduler.tasks(), 'project'),
        },
        {
            label: t('scheduler-page.tasks-template'),
            href: href(routes.scheduler.templates(), 'project'),
        },
        // {
        //     label: t('scheduler-page.tasks-statuses'),
        //     href: routes.scheduler.statuses(),
        // },
        // {
        //     label: t('scheduler-page.roadmap'),
        //     href: routes.scheduler.roadmap(),
        // },
    ]

    return (
        <RootPageLayout navItems={navItems}>
            <div className="h-full w-full">
                <div className="pl-2 min-w-0">
                <Outlet />
                </div>
            </div>
        </RootPageLayout>
    )
}

export default SchedulerPage