import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "react-hot-toast"
import { useUpdateProjectMutation } from "../../../entities/project/model/projectSlice"
import type { Project } from "../../../entities/project/model/types"
import { errorsHandler } from "../../../shared/lib/errors-handler"
import { Button } from "../../../shared/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../../shared/ui/dialog"
import { Input } from "../../../shared/ui/input"
import { CountrySelect } from "../../../shared/ui/country-select"
import { Label } from "../../../shared/ui/label"

interface EditProjectDialogProps {
    project: Project | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export const EditProjectDialog = ({ project, open, onOpenChange }: EditProjectDialogProps) => {
    const { t } = useTranslation()
    const [updateProject, { isLoading }] = useUpdateProjectMutation()
    const [form, setForm] = useState({
        name: "",
        reservoir: "",
        country: "",
    })

    useEffect(() => {
        if (!project || !open) return
        setForm({
            name: project.name ?? "",
            reservoir: project.reservoir ?? "",
            country: project.country ?? "",
        })
    }, [project, open])

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!project) return

        let toastId: string | undefined
        try {
            toastId = toast.loading(t('notice-list.updating-project'))
            await updateProject({
                id: project.id,
                data: {
                    name: form.name.trim(),
                    reservoir: form.reservoir.trim(),
                    country: form.country.trim(),
                },
            }).unwrap()
            toast.success(t('notice-list.project-updated'))
            onOpenChange(false)
        } catch (error) {
            errorsHandler(error, t)
        } finally {
            toast.dismiss(toastId)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('settings-page.edit-project')}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-project-name">{t('fields.project-name')}</Label>
                        <Input
                            id="edit-project-name"
                            value={form.name}
                            onChange={(event) => setForm({ ...form, name: event.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-project-reservoir">{t('fields.reservoir')}</Label>
                        <Input
                            id="edit-project-reservoir"
                            value={form.reservoir}
                            onChange={(event) => setForm({ ...form, reservoir: event.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-project-country">{t('fields.country')}</Label>
                        <CountrySelect
                            id="edit-project-country"
                            value={form.country}
                            onChange={(code) => setForm({ ...form, country: code })}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            {t('buttons.cancel')}
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('buttons.save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
