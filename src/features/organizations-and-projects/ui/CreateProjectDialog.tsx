import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "react-hot-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../shared/ui/dialog"
import { Button } from "../../../shared/ui/button"
import { Input } from "../../../shared/ui/input"
import { Label } from "../../../shared/ui/label"
import { Loader2 } from "lucide-react"
import { useAddProjectMutation } from "../../../entities/project/model/projectSlice"
import { errorsHandler } from "../../../shared/lib/errors-handler"
import { useUnsavedSource } from "../../../shared/session/unsaved-work"

interface CreateProjectDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    organizationId: number | null
    onCreated?: (projectId: number) => void
}

export const CreateProjectDialog = ({ open, onOpenChange, organizationId, onCreated }: CreateProjectDialogProps) => {
    const { t } = useTranslation()
    const [addProject, { isLoading }] = useAddProjectMutation()
    const [projectName, setProjectName] = useState("")
    const [reservoir, setReservoir] = useState("")
    useUnsavedSource('create-project', open && (projectName !== '' || reservoir !== ''))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!organizationId) return
        
        let toastId: string | undefined
        try {
            toastId = toast.loading(t('notice-list.creating-project'))
            const created = await addProject({ 
                name: projectName,
                organization: organizationId ,
                reservoir: reservoir,
            }).unwrap()
            if (typeof created?.id === 'number') onCreated?.(created.id)
            toast.success(t('notice-list.project-created'))
            onOpenChange(false)
            setProjectName("")
            setReservoir("")
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
                    <DialogTitle>{t('settings-page.create-project')}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="projectName">{t('fields.project-name')}</Label>
                        <Input
                            id="projectName"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="reservoir">{t('fields.reservoir')}</Label>
                        <Input
                            id="reservoir"
                            value={reservoir}
                            onChange={(e) => setReservoir(e.target.value)}
                            required
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            {t('buttons.cancel')}
                        </Button>
                        <Button type="submit" disabled={isLoading || !organizationId}>
                            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {t('buttons.create')}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}