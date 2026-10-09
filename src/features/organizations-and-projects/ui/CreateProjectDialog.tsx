import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "react-hot-toast"
import { useAddProjectMutation } from "../../../entities/project/model/projectSlice"
import { errorsHandler } from "../../../shared/lib/errors-handler"
import { Button } from "../../../shared/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../../shared/ui/dialog"
import { Input } from "../../../shared/ui/input"
import { Label } from "../../../shared/ui/label"
import { CountrySelect } from "../../../shared/ui/country-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../shared/ui/select"

interface OrganizationOption {
    id: number
    fullName?: string
    shortName?: string
}

interface CreateProjectDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    organizations: OrganizationOption[]
    defaultOrganizationId?: number | null
}

const emptyForm = {
    name: "",
    reservoir: "",
    country: "",
}

export const CreateProjectDialog = ({
    open,
    onOpenChange,
    organizations,
    defaultOrganizationId,
}: CreateProjectDialogProps) => {
    const { t } = useTranslation()
    const [addProject, { isLoading }] = useAddProjectMutation()
    const [organizationId, setOrganizationId] = useState("")
    const [form, setForm] = useState(emptyForm)

    useEffect(() => {
        if (!open) return
        const fallback = organizations.length === 1 ? String(organizations[0].id) : ""
        setOrganizationId(defaultOrganizationId ? String(defaultOrganizationId) : fallback)
        setForm(emptyForm)
    }, [open, defaultOrganizationId, organizations])

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!organizationId) return

        let toastId: string | undefined
        try {
            toastId = toast.loading(t('notice-list.creating-project'))
            await addProject({
                name: form.name.trim(),
                organization: Number(organizationId),
                reservoir: form.reservoir.trim(),
                country: form.country.trim(),
            }).unwrap()
            toast.success(t('notice-list.project-created'))
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
                    <DialogTitle>{t('settings-page.create-project')}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>{t('settings-page.organization')}</Label>
                        <Select value={organizationId} onValueChange={setOrganizationId}>
                            <SelectTrigger>
                                <SelectValue placeholder={t('settings-page.select-organization-first')} />
                            </SelectTrigger>
                            <SelectContent>
                                {organizations.map((organization) => (
                                    <SelectItem key={organization.id} value={String(organization.id)}>
                                        {organization.shortName || organization.fullName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="projectName">{t('fields.project-name')}</Label>
                        <Input
                            id="projectName"
                            value={form.name}
                            onChange={(event) => setForm({ ...form, name: event.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="reservoir">{t('fields.reservoir')}</Label>
                        <Input
                            id="reservoir"
                            value={form.reservoir}
                            onChange={(event) => setForm({ ...form, reservoir: event.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="project-country">{t('fields.country')}</Label>
                        <CountrySelect
                            id="project-country"
                            value={form.country}
                            onChange={(code) => setForm({ ...form, country: code })}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            {t('buttons.cancel')}
                        </Button>
                        <Button type="submit" disabled={isLoading || !organizationId}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('buttons.create')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
