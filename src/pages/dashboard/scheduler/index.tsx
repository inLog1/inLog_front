import { useTranslation } from 'react-i18next'
import RootPageLayout from '../../../widgets/root-page-layout'
import { routes } from '../../../shared/lib/routes'
import { Outlet } from 'react-router-dom'

interface NavItem {
    label: string
    href?: string
    onClick?: () => void
}

const SchedulerPage = () => {
    const { t } = useTranslation()

    const navItems: NavItem[] = [
        {
            label: t('scheduler-page.tasks'),
            href: routes.scheduler.tasks(),
        },
        {
            label: t('scheduler-page.tasks-template'),
            href: routes.scheduler.templates(),
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
            <div className="h-full min-h-0 w-full">
                <div className="h-full min-h-0 min-w-0">
                <Outlet />
                </div>
            </div>
        </RootPageLayout>
    )
}

export default SchedulerPage