import { BedDouble, BedSingle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { WellLogPlotDemo } from "../../../features/geo-mechanics/well-log-plot"
import { WellLogPlotTwoTracksDemo } from "../../../features/geo-mechanics/well-log-plot/ui/WellLogTwoPlotDemo"
import { Card } from "../../../shared/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/ui/tabs"

const GeoMechanicsPage = () => {
    const { t } = useTranslation()

    const tabsConfig = [
        {
            id: 'single-track-graphics',
            label: t('geo-mechanics-page.single-track-graphics'),
            icon: BedSingle,
            content: (
                <Card className="p-6 bg-card/80 backdrop-blur-sm border-border/50 shadow-2xl">
                    <WellLogPlotDemo />
                </Card>
            ),
        },
        {
            id: 'double-track-graphics',
            label: t('geo-mechanics-page.double-track-graphics'),
                icon: BedDouble,
            content: (
                <Card className="p-6 bg-card/80 backdrop-blur-sm border-border/50 shadow-2xl">
                    <WellLogPlotTwoTracksDemo />
                </Card>
            ),
        },  
    ]

    return (
        <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 py-4" >
            <h1 className="text-2xl font-bold mb-4">{t('geo-mechanics-page.graphics')}</h1>


            <Tabs defaultValue="single-track-graphics" className="w-full">
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
    )
}

export default GeoMechanicsPage