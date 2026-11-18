import { useTranslation } from "react-i18next"
import { Tabs, TabsList, TabsTrigger } from "../../../../shared/ui/tabs"
import { 
  CalendarDays, 
  CalendarRange, 
  Calendar,
  ScrollText
} from "lucide-react"
import { cn } from "../../../../shared/lib/utils"

type ViewMode = "day" | "week" | "month" | "year"

interface Props {
    viewMode: ViewMode
    setViewMode: (viewMode: ViewMode) => void
}

const RoadmapDetalization = (props: Props) => {
    const { viewMode, setViewMode } = props
    const { t } = useTranslation()

    const viewModes: { value: ViewMode; icon: React.ReactNode; title: string }[] = [
        { value: "day", icon: <CalendarDays className="h-4 w-4" />, title: t('tasks-page.roadmap.days') },
        { value: "week", icon: <ScrollText className="h-4 w-4" />, title: t('tasks-page.roadmap.weeks') },
        { value: "month", icon: <CalendarRange className="h-4 w-4" />, title: t('tasks-page.roadmap.months') },
        { value: "year", icon: <Calendar className="h-4 w-4" />, title: t('tasks-page.roadmap.years') }
    ]

    return (
        <Tabs
            value={viewMode}
            onValueChange={(value) => setViewMode(value as ViewMode)}
            className="w-auto"
        >
            <TabsList className="h-9 rounded-lg bg-muted p-1 gap-2">
                {viewModes.map((mode) => (
                    <TabsTrigger
                        key={mode.value}
                        value={mode.value}
                        title={mode.title}
                        className={cn(
                            "rounded-md flex items-center justify-center gap-2 cursor-pointer",
                            "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                            "transition-all"
                        )}
                    >
                        {mode.icon}
                        <span>{mode.title}</span>
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    )
}

export default RoadmapDetalization