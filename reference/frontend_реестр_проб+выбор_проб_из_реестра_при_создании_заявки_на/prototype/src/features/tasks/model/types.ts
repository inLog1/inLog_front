import type { DateRange } from "react-day-picker"
import type { TaskTypeFilter } from "../../../entities/task/model/types"

export interface TasksFilterValues {
    dateRange?: DateRange
    taskType?: TaskTypeFilter
}