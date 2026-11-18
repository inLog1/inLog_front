import { X } from 'lucide-react'
import type { FC, SetStateAction } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import type { AdminPanelNodeTab } from '../../../../entities/admin/model/types'
import { cn } from '../../../../shared/lib/utils'
import type { LanguageType } from '../../../../shared/types/enums'
import { Button } from '../../../../shared/ui/button'
import { Input } from '../../../../shared/ui/input'
import { Label } from '../../../../shared/ui/label'

interface SelectOption {
    label: string
    value: string
}

export type TabValidationError = {
    name_ru?: string[]
    name_en?: string[]

}

interface TabItem extends AdminPanelNodeTab {
    lang: LanguageType
    validationErrors?: TabValidationError
}

interface IProps {
    tab: TabItem
    connectionsOptions: SelectOption[]
    onChange: (data: SetStateAction<TabItem[]>) => void
}

const PanelTreeModalTab: FC<IProps> = ({
    tab,
    connectionsOptions,
    onChange,
}) => {
    const { t } = useTranslation()

    const handleDeleteTab = (id: number) => {
        onChange((prev) => prev.filter((tab) => tab.id !== id))
    }

    const tabNameSchema = z.object({
        name_ru: z.string().min(1, 'errors.fill-field-in-russian'),
        name_en: z.string().min(1, 'errors.fill-field-in-english'),
    })

    const handleChangeTabRelatives = (id: number, relatives: number[]) => {
        onChange((prev) =>
            prev.map((tab) =>
                tab.id === id
                    ? { ...tab, related_structure_elements: relatives }
                    : tab,
            ),
        )
    }

    const validateField = (name_ru: string, name_en: string) => {
        const result = tabNameSchema.safeParse({ name_ru, name_en })
        if (!result.success) {
            const errors: TabValidationError = {}
            // result.error.errors.forEach((err) => {
            //     const path = err.path[0] as keyof TabValidationError
            //     if (path) {
            //         errors[path] = [t(err.message)]
            //     }
            // })
            return errors
        }
        return undefined
    }

    const handleChangeTabName = (
        id: number,
        value: string,
        lang: LanguageType
    ) => {
        onChange((prev) => {
            const updatedTabs = prev.map((tab) => {
                if (tab.id !== id) return tab

                const updatedTab = {
                    ...tab,
                    [`name_${lang}`]: value,
                }

                // Валидируем оба поля
                const validationErrors = validateField(
                    lang === 'ru' ? value : updatedTab.name_ru || '',
                    lang === 'en' ? value : updatedTab.name_en || ''
                )

                return {
                    ...updatedTab,
                    validationErrors,
                }
            })
            return updatedTabs
        })
    }

    const hasError = useMemo(() => {
        return tab.validationErrors && (
            (tab.validationErrors.name_ru?.length ?? 0) > 0 ||
            (tab.validationErrors.name_en?.length ?? 0) > 0
        )
    }, [tab.validationErrors])

    const getFieldError = (field: 'name_ru' | 'name_en'): string | undefined => {
        return tab.validationErrors?.[field]?.[0]
    }

    // // Обработчик для множественного выбора в Select
    // const handleSelectChange = (value: string) => {
    //     // Если нужно множественное выделение с shadcn select
    //     // Вам может понадобиться кастомная реализация или использование Command + Popover
    //     const currentValues = tab.related_structure_elements || []
    //     const newValue = Number(value)

    //     if (currentValues.includes(newValue)) {
    //         handleChangeTabRelatives(tab.id!, currentValues.filter(v => v !== newValue))
    //     } else {
    //         handleChangeTabRelatives(tab.id!, [...currentValues, newValue])
    //     }
    // }

    return (
        <div className={cn(
            "relative border border-border rounded-lg p-6 pb-2 mb-4 transition-all",
            hasError && "border-destructive bg-destructive/5"
        )}>
            <div className="space-y-6">
                {/* Поля для названий */}
                <div className="grid grid-cols-2 gap-4">
                    {/* Русское название */}
                    <div className="space-y-2">
                        <Label htmlFor={`name-ru-${tab.id}`} className="text-sm font-medium">
                            {t('fields.name-in-russian')}
                        </Label>
                        <Input
                            id={`name-ru-${tab.id}`}
                            value={tab.name_ru || ''}
                            onChange={(e) => handleChangeTabName(tab.id!, e.target.value, 'ru')}
                            className={cn(
                                "w-full",
                                getFieldError('name_ru') && "border-destructive focus-visible:ring-destructive"
                            )}
                            placeholder={t('fields.enter-name')}
                        />
                        {getFieldError('name_ru') && (
                            <p className="text-sm text-destructive">
                                {getFieldError('name_ru')}
                            </p>
                        )}
                    </div>

                    {/* Английское название */}
                    <div className="space-y-2">
                        <Label htmlFor={`name-en-${tab.id}`} className="text-sm font-medium">
                            {t('fields.name-in-english')}
                        </Label>
                        <Input
                            id={`name-en-${tab.id}`}
                            value={tab.name_en || ''}
                            onChange={(e) => handleChangeTabName(tab.id!, e.target.value, 'en')}
                            className={cn(
                                "w-full",
                                getFieldError('name_en') && "border-destructive focus-visible:ring-destructive"
                            )}
                            placeholder={t('fields.enter-name')}
                        />
                        {getFieldError('name_en') && (
                            <p className="text-sm text-destructive">
                                {getFieldError('name_en')}
                            </p>
                        )}
                    </div>
                </div>

                {/* Связи с элементами структуры */}
                {connectionsOptions.length > 0 && (
                    <div className="space-y-2">
                        {/* <Label className="text-sm font-medium">
                            {t('fields.connection-with')}
                        </Label>
                        <TagsInput
                            value={tab.related_structure_elements?.map(item => item.toString())}
                            options={connectionsOptions.map(item => item.label)}
                            onChange={(value) => handleChangeTabRelatives(tab.id!, value.map(Number))}
                        /> */}

                        {/* Отображение выбранных элементов для множественного выбора */}
                        {tab.related_structure_elements && tab.related_structure_elements.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {tab.related_structure_elements.map((id) => {
                                    const option = connectionsOptions.find(opt => opt.value === id.toString())
                                    return option ? (
                                        <div
                                            key={id}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-sm rounded-md bg-secondary"
                                        >
                                            <span>{option.label}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleChangeTabRelatives(
                                                    tab.id!,
                                                    tab.related_structure_elements?.filter(v => v !== id) || []
                                                )}
                                                className="hover:text-destructive"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ) : null
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Кнопка удаления */}
            <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-white hover:bg-transparent"
                onClick={() => handleDeleteTab(tab.id!)}
            >
                <X className="h-4 w-4" />
            </Button>
        </div>
    )
}

export default PanelTreeModalTab