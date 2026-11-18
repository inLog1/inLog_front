import { Card } from "../../../shared/ui/card"

import { BookOpen, Gauge, GraduationCap, Stethoscope, User } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/ui/tabs"
import Employee from "./Employee"


const Profile = () => {
    const { t } = useTranslation()

    const tabsConfig = [
        {
            id: 'profile',
            label: t('profile-page.employee'),
            icon: User,
            content: (
                <Card className="p-6 bg-card/80 backdrop-blur-sm border-border/50 shadow-2xl">
                    <Employee />
                </Card>
            ),
        },
        {
            id: 'methods',
            label: t('profile-page.methods'),
            icon: BookOpen,
            content: (
                <Card className="p-6 bg-card/80 backdrop-blur-sm border-border/50 shadow-2xl">
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">{t('profile-page.working-methods')}</h3>
                        <p className="text-muted-foreground">
                            {t('profile-page.methods-tab-placeholder')}
                        </p>
                    </div>
                </Card>
            ),
        },
        {
            id: 'education',
            label: t('profile-page.education'),
            icon: GraduationCap,
            content: (
                <Card className="p-6 bg-card/80 backdrop-blur-sm border-border/50 shadow-2xl">
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">{t('profile-page.education-history')}</h3>
                        <p className="text-muted-foreground">
                            {t('profile-page.education-tab-placeholder')}
                        </p>
                    </div>
                </Card>
            ),
        },
        {
            id: 'medical',
            label: t('profile-page.medical-examinations'),
            icon: Stethoscope,
            content: (
                <Card className="p-6 bg-card/80 backdrop-blur-sm border-border/50 shadow-2xl">
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">{t('profile-page.medical-examinations')}</h3>
                        <p className="text-muted-foreground">
                            {t('profile-page.medical-tab-placeholder')}
                        </p>
                    </div>
                </Card>
            ),
        },
        {
            id: 'quality',
            label: t('profile-page.quality-measures'),
            icon: Gauge,
            content: (
                <Card className="p-6 bg-card/80 backdrop-blur-sm border-border/50 shadow-2xl">
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">{t('profile-page.quality-measures')}</h3>
                        <p className="text-muted-foreground">
                            {t('profile-page.quality-tab-placeholder')}
                        </p>
                    </div>
                </Card>
            ),
        },
    ]


    return (
        <div className="container ">
            <div className="space-y-6">
                <Tabs defaultValue="profile" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 gap-2 bg-transparent h-auto p-0">
                        {tabsConfig.map((tab) => {
                            const Icon = tab.icon
                            return (
                                <TabsTrigger
                                    key={tab.id}
                                    value={tab.id}
                                    className="cursor-pointer flex items-center gap-2 data-[state=active]:bg-accent data-[state=active]:text-primary-foreground py-3 px-4 hover:bg-accent/10"
                                >
                                    <Icon className="h-4 w-4" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                </TabsTrigger>
                            )
                        })}
                    </TabsList>

                    {tabsConfig.map((tab) => (
                        <TabsContent
                            key={tab.id}
                            value={tab.id}
                            className="mt-4 focus-visible:outline-none focus-visible:ring-0"
                        >
                            {tab.content}
                        </TabsContent>
                    ))}
                </Tabs>
            </div>
        </div>
    )
}

export default Profile