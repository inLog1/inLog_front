import type { SetStateAction } from "react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { useGetStatusesQuery } from "../../../../entities/task/model/taskSlice"
import type { TasksFilterParams } from "../../../../entities/task/model/types"
import useDebounce from "../../../../shared/lib/hooks/use-deboucne"
import { Input } from "../../../../shared/ui/input"
import type { RoadmapColumnOption, RoadmapDetalizationMode } from "../model/types"
import RoadmapDetalization from "./RoadmapDetalization"
import { RoadmapFilter } from "./RoadmapFilter"
import RoadmapSettings from "./RoadmapSettings"

interface Props {
    disabled: boolean
    initialValues: Partial<TasksFilterParams>
    viewMode: RoadmapDetalizationMode
    columnSettings: { showTable: boolean; visibleColumns: RoadmapColumnOption[] }
    onChangeColumnSettings?: (settings: { showTable: boolean; visibleColumns: RoadmapColumnOption[] }) => void
    setViewMode: (viewMode: RoadmapDetalizationMode) => void
    onFilterChange: (params: SetStateAction<Partial<TasksFilterParams>>) => void
}


const RoadmapControls = (props: Props) => {
    const { t } = useTranslation()
    const { disabled, initialValues, viewMode, columnSettings, onChangeColumnSettings, setViewMode, onFilterChange } = props

    const [searchParams] = useSearchParams()

    const projectId = searchParams.get('project')

    const { data: statuses } = useGetStatusesQuery({ projectId: Number(projectId) }, { skip: !projectId })

    const [searchValue, setSearchValue] = useState('')

    const debouncedSearchValue = useDebounce(searchValue, 500)

    const handleFilterChange = (params: Partial<TasksFilterParams>) => {
        onFilterChange(prev => ({
            ...prev,
            ...params,
        }))
    }

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchValue(e.target.value)
    }

    const handleResetFilter = () => {
        onFilterChange({...initialValues, name__icontains: searchValue})
    }

    useEffect(() => {
        if (debouncedSearchValue!==initialValues.name__icontains) {
            onFilterChange(prev => ({
                ...prev,
                name__icontains: debouncedSearchValue,
            }))
        }
    }, [debouncedSearchValue, initialValues.name__icontains])

    return (
        <div className="grid grid-cols-1 gap-3 pl-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6">
            <div className="col-span-1 w-full flex items-center gap-2">
                <div className="space-y-2 w-full flex items-center gap-2">
                    <Input
                        value={searchValue}
                        onChange={handleSearchChange}
                        placeholder={t('fields.search')}
                        className="w-full"
                    />
                </div>
            </div>
            <div className="flex items-center gap-2">
                <RoadmapFilter
                    statuses={statuses || []}
                    onFilterChange={handleFilterChange}
                    resetFilter={handleResetFilter}
                    initialValues={initialValues}
                    disabled={disabled}
                />
                <RoadmapDetalization
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                />
                <RoadmapSettings
                    value={columnSettings}
                    onChange={onChangeColumnSettings}
                />
            </div>
        </div>
    )
}

export default RoadmapControls