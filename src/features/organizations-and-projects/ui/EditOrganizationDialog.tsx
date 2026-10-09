import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "react-hot-toast"
import { useUpdateOrganizationMutation } from "../../../entities/organization/model/organizationSlice"
import type { Organization } from "../../../entities/organization/model/types"
import { errorsHandler } from "../../../shared/lib/errors-handler"
import { Button } from "../../../shared/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../../shared/ui/dialog"
import { Input } from "../../../shared/ui/input"
import { Label } from "../../../shared/ui/label"

interface EditOrganizationDialogProps {
    organization: Organization | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export const EditOrganizationDialog = ({ organization, open, onOpenChange }: EditOrganizationDialogProps) => {
    const { t } = useTranslation()
    const [updateOrganization, { isLoading }] = useUpdateOrganizationMutation()
    const [formData, setFormData] = useState({
        fullName: "",
        shortName: "",
        address: "",
    })

    useEffect(() => {
        if (!organization || !open) return
        setFormData({
            fullName: organization.fullName ?? "",
            shortName: organization.shortName ?? "",
            address: organization.address ?? "",
        })
    }, [organization, open])

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!organization) return

        let toastId: string | undefined
        try {
            toastId = toast.loading(t('notice-list.updating-organization'))
            await updateOrganization({
                id: organization.id,
                data: {
                    full_name: formData.fullName.trim(),
                    short_name: formData.shortName.trim(),
                    address: formData.address.trim(),
                },
            }).unwrap()
            toast.success(t('notice-list.organization-updated'))
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
                    <DialogTitle>{t('settings-page.edit-organization')}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-org-full-name">{t('fields.full-name')}</Label>
                        <Input
                            id="edit-org-full-name"
                            value={formData.fullName}
                            onChange={(event) => setFormData({ ...formData, fullName: event.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-org-short-name">{t('fields.short-name')}</Label>
                        <Input
                            id="edit-org-short-name"
                            value={formData.shortName}
                            onChange={(event) => setFormData({ ...formData, shortName: event.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-org-address">{t('fields.address')}</Label>
                        <Input
                            id="edit-org-address"
                            value={formData.address}
                            onChange={(event) => setFormData({ ...formData, address: event.target.value })}
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
