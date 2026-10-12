'use client'
import {
  Building2,
  ChevronRight,
  FolderKanban,
  ListTodo
} from 'lucide-react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
  
  import { useTranslation } from 'react-i18next'
import { selectUser } from '../../entities/user/model/selectors'
import { canAccessSection, canSeeHomeTasks, homeTasksPath } from '../../shared/lib/available-features'
import { routes } from '../../shared/lib/routes'
import { Button } from '../../shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card'


const Dashboard = () => {
    const { t } = useTranslation()
    const user = useSelector(selectUser)
    const quickLinks = [
      canAccessSection(user, 'organizations') && {
        icon: <Building2 className="h-6 w-6" />,
        title: t('dashboard-page.organizations'),
        description: t('dashboard-page.organizations-description'),
        to: routes.settings.organizations(),
      },
      canAccessSection(user, 'projects') && {
        icon: <FolderKanban className="h-6 w-6" />,
        title: t('dashboard-page.projects'),
        description: t('dashboard-page.projects-description'),
        to: routes.settings.projects(),
      },
      canSeeHomeTasks(user) && {
        icon: <ListTodo className="h-6 w-6" />,
        title: t('dashboard-page.tasks'),
        description: t('dashboard-page.tasks-description'),
        to: homeTasksPath(user),
      },
    ].filter((item) => item !== false)

    return (
        <div className="h-full overflow-y-auto">
      <Card className="m-3 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 sm:m-4">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary sm:text-3xl">
            {t('dashboard-page.welcome')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground leading-relaxed">
            {t('dashboard-page.description')}
          </p>

          {quickLinks.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {quickLinks.map((item) => (
                <QuickLinkCard
                  key={item.to}
                  icon={item.icon}
                  title={item.title}
                  description={item.description}
                  to={item.to}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

  
    </div>
    )
}


export default Dashboard



function QuickLinkCard({
    icon,
    title,
    description,
    to,
  }: {
    icon: React.ReactNode
    title: string
    description: string
    to: string
  }) {
    return (
      <Button asChild variant="outline" className="flex h-auto flex-col items-start gap-2 whitespace-normal px-4 py-5 text-left text-foreground hover:bg-primary/5 hover:text-foreground sm:px-6 sm:py-6">
        <Link to={to}>
          <div className="text-primary">{icon}</div>
          <div className="font-medium text-foreground">{title}</div>
          <p className="text-sm text-muted-foreground">{description}</p>
          <ChevronRight className="h-4 w-4 mt-2 text-muted-foreground" />
        </Link>
      </Button>
    )
  }