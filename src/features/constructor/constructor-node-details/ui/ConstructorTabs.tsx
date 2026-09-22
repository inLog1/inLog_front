'use client'

import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import type { AdminPanelNode, AdminPanelNodeTab } from '../../../../entities/admin/model/types'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '../../../../shared/ui/alert-dialog'
import { Button } from '../../../../shared/ui/button'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '../../../../shared/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../../../shared/ui/dropdown-menu'
import { Input } from '../../../../shared/ui/input'
import { Label } from '../../../../shared/ui/label'
import { Tabs, TabsList, TabsTrigger } from '../../../../shared/ui/tabs'
import ConstructorTab from './ConstructorTab'

interface Props {
    node?: AdminPanelNode
    addTab: (body: {
        name_en: string
        name_ru: string
        related_structure_elements?: number[]
    }) => void
    updateTab: (tab: {
        id: number
        name_en: string
        name_ru: string
        related_structure_elements?: number[]
    }) => void
    deleteTab: (tabId: number) => void
}

const ConstructorTabs = ({ node, addTab, updateTab, deleteTab }: Props) => {
    const { t, i18n } = useTranslation()
    const currentLang = i18n.language === 'ru' ? 'ru' : 'en'
    const [searchParams] = useSearchParams()
    const organizationId = Number(searchParams.get('org'))
    const [tabs, setTabs] = useState<AdminPanelNodeTab[]>([])

    useEffect(() => {
        if (node?.pre_made_structure_elements) {
            setTabs(node?.pre_made_structure_elements?.map((tab: AdminPanelNodeTab, i: number, arr: AdminPanelNodeTab[]) =>
                tab.id ? tab : { ...tab, id: i === 0 ? 0 : arr[i - 1]?.id! + 1 }) || [])
        }else{
            setTabs([])
        }
    }, [node?.pre_made_structure_elements])

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
    const [selectedTab, setSelectedTab] = useState<AdminPanelNodeTab | null>(null)

    const [formData, setFormData] = useState({ ru: '', en: '' })

    const handleOpenCreateModal = () => {
        setFormData({ ru: '', en: '' })
        setIsCreateModalOpen(true)
    }

    const handleOpenEditModal = (tab: AdminPanelNodeTab) => {
        setSelectedTab(tab)
        setFormData({
            ru: tab.name_ru,
            en: tab.name_en,
        })
        setIsEditModalOpen(true)
    }

    const handleOpenDeleteAlert = (tab: AdminPanelNodeTab) => {
        setSelectedTab(tab)
        setIsDeleteAlertOpen(true)
    }

    const handleCloseModals = () => {
        setIsCreateModalOpen(false)
        setIsEditModalOpen(false)
        setIsDeleteAlertOpen(false)
        setSelectedTab(null)
        setFormData({ ru: '', en: '' })
    }

    const handleCreateTab = () => {
        if (!formData.ru || !formData.en) {
            // Можно добавить валидацию и тост
            return
        }
        addTab({
            name_en: formData.en,
            name_ru: formData.ru,
        })
        handleCloseModals()
    }

    const handleUpdateTab = () => {
        if (!selectedTab || !formData.ru || !formData.en) {
            return
        }
        updateTab({
            id: selectedTab.id!,
            name_en: formData.en,
            name_ru: formData.ru,
            // related_structure_elements: selectedTab.related_structure_elements || [],
        })
        handleCloseModals()
    }

    // const handleChangeTabConnections = (tab: AdminPanelNodeTab) => {
    //     updateTab({
    //         id: tab.id!,
    //         name_en: tab.name_en,
    //         name_ru: tab.name_ru,
    //         related_structure_elements: tab.related_structure_elements || [],
    //     })
    // }

    const handleDeleteTab = () => {
        if (selectedTab) {
            deleteTab(selectedTab.id!)
            handleCloseModals()
        }
    }

    return (
        <div>
            {tabs.length === 0 && (
                <div className="h-full flex items-center justify-center flex-col gap-2">
                    <p className="text-muted-foreground">
                        {t('admin-page.no-tabs-available')}
                    </p>
                    <Button variant="outline" onClick={handleOpenCreateModal}>
                        {t('admin-page.create-tab')}
                    </Button>
                </div>
            )}

            {tabs.length > 0 && (
                <Tabs defaultValue={tabs[0]?.id?.toString()}>
                    <TabsList className="flex-wrap h-auto">
                        {tabs.map((tab) => (
                            <div key={tab.id} className="relative">
                                <TabsTrigger
                                    value={tab.id!.toString()}
                                    className="group data-[state=active]:bg-background p-2 pr-8 my-auto cursor-pointer"
                                >
                                    <span className="hidden sm:inline">{tab[`name_${currentLang}`]}</span>
                                </TabsTrigger>

                                <div className="absolute right-1 top-1/2 -translate-y-[42%]">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 my-auto"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <MoreHorizontal className="h-3.5 w-3.5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                            <DropdownMenuItem onClick={() => handleOpenEditModal(tab)}>
                                                <Pencil className="mr-2 h-4 w-4" />
                                                <span>{t('buttons.edit')}</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleOpenDeleteAlert(tab)}
                                                className="text-destructive focus:text-destructive"
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                <span>{t('buttons.delete')}</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        ))}

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleOpenCreateModal}
                            className="h-9 px-3 gap-1 text-muted-foreground hover:text-foreground"
                        >
                            <Plus className="h-4 w-4" />
                            <span className="hidden sm:inline">{t('admin-page.add-tab')}</span>
                        </Button>
                    </TabsList>

                    {tabs.map((tab) => (
                        <ConstructorTab
                            tab={tab}
                            organizationId={organizationId}
                        />
                    ))}
                </Tabs>
            )}

            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{t('admin-page.create-new-tab')}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="flex flex-col space-y-2">
                            <Label htmlFor="create-name-ru">
                                {t('fields.name-in-russian')} <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="create-name-ru"
                                value={formData.ru}
                                onChange={(e) => setFormData({ ...formData, ru: e.target.value })}
                                className="w-full"
                                placeholder={t('fields.enter-name-in-russian')}
                                autoFocus
                            />
                        </div>
                        <div className="flex flex-col space-y-2">
                            <Label htmlFor="create-name-en">
                                {t('fields.name-in-english')} <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="create-name-en"
                                value={formData.en}
                                onChange={(e) => setFormData({ ...formData, en: e.target.value })}
                                className="w-full"
                                placeholder={t('fields.enter-name-in-english')}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseModals}>
                            {t('buttons.cancel')}
                        </Button>
                        <Button onClick={handleCreateTab} disabled={!formData.ru || !formData.en}>
                            {t('buttons.create')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Модальное окно для редактирования таба */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{t('admin-page.edit-tab')}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="flex flex-col space-y-2">
                            <Label htmlFor="edit-name-ru">
                                {t('fields.name-in-russian')} <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="edit-name-ru"
                                value={formData.ru}
                                onChange={(e) => setFormData({ ...formData, ru: e.target.value })}
                                className="w-full"
                                placeholder={t('fields.enter-name-in-russian')}
                                autoFocus
                            />
                        </div>
                        <div className="flex flex-col space-y-2">
                            <Label htmlFor="edit-name-en">
                                {t('fields.name-in-english')} <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="edit-name-en"
                                value={formData.en}
                                onChange={(e) => setFormData({ ...formData, en: e.target.value })}
                                className="w-full"
                                placeholder={t('fields.enter-name-in-english')}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseModals}>
                            {t('buttons.cancel')}
                        </Button>
                        <Button onClick={handleUpdateTab} disabled={!formData.ru || !formData.en}>
                            {t('buttons.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* AlertDialog для подтверждения удаления */}
            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('admin-page.delete-tab-title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('admin-page.delete-tab-warning', {
                                tabName: selectedTab ? selectedTab[`name_${currentLang}`] : ''
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleCloseModals}>
                            {t('buttons.cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteTab}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {t('buttons.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

export default ConstructorTabs