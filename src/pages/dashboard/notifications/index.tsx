import { useTranslation } from "react-i18next"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../shared/ui/tabs"
import { NotificationsList } from "../../../features/notifications/notifications-list"
import NotificationsSettings from "../../../features/notifications/notifications-settings/ui/NotificationsSettings"

const NotificationsPage = () => {
    const { t } = useTranslation()

    return (
        <div className="min-w-0">
            <Tabs defaultValue="all">
                <TabsList>
                    <TabsTrigger value="all">
                        {t('notifications-page.all-notifications')}
                    </TabsTrigger>
                    <TabsTrigger value="settings">
                        {t('notifications-page.settings')}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="all">
                    <NotificationsList />
                </TabsContent>

                <TabsContent value="settings">
                    <NotificationsSettings />
                </TabsContent>
            </Tabs>
        </div>
    )
}

export default NotificationsPage
