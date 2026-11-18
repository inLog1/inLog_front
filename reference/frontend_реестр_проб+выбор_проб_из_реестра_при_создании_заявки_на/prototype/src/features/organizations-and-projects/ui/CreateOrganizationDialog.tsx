import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "react-hot-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../shared/ui/dialog"
import { Button } from "../../../shared/ui/button"
import { Input } from "../../../shared/ui/input"
import { Label } from "../../../shared/ui/label"
import { Loader2 } from "lucide-react"
import { useCreateAccessAssignmentMutation, useGetAccessDirectoryQuery } from "../../../entities/access"
import { personWithPosition } from "../../../entities/organization/model/requisites"
import { useAddOrganizationMutation } from "../../../entities/organization/model/organizationSlice"
import { getApiMode } from "../../../shared/config/runtime"
import { errorsHandler } from "../../../shared/lib/errors-handler"
import { useUnsavedSource } from "../../../shared/session/unsaved-work"
import { organizationKindLabelKey } from "../model/kind-label"

interface CreateOrganizationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreated?: (organizationId: number) => void
}

const emptyForm = {
    fullName: "",
    shortName: "",
    address: "",
    inn: "",
    kpp: "",
    administratorId: "",
    kind: "laboratory" as "laboratory" | "customer",
}

export const CreateOrganizationDialog = ({ open, onOpenChange, onCreated }: CreateOrganizationDialogProps) => {
    const { t } = useTranslation()
    const [addOrganization, { isLoading: creating }] = useAddOrganizationMutation()
    const [createAssignment, { isLoading: assigning }] = useCreateAccessAssignmentMutation()
    const mock = getApiMode() === 'mock'
    const directory = useGetAccessDirectoryQuery({ scope: 'corporation' }, { skip: !open || !mock })
    const specialists = (directory.data?.candidates ?? []).flatMap((candidate) => {
        if (candidate.status === 'blocked') return []
        const label = personWithPosition({
            surname: candidate.surname,
            name: candidate.givenName,
            patronymic: candidate.patronymic,
            position: candidate.position,
        })
        return label ? [{ id: candidate.id, label }] : []
    })

    const [formData, setFormData] = useState(emptyForm)
    const dirty = open && (
        formData.fullName !== ''
        || formData.shortName !== ''
        || formData.address !== ''
        || formData.inn !== ''
        || formData.kpp !== ''
        || formData.administratorId !== ''
        || formData.kind !== 'laboratory'
    )
    useUnsavedSource('create-organization', dirty)
    const isLoading = creating || assigning

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (isLoading) return

        const administratorId = Number(formData.administratorId)
        let toastId: string | undefined
        try {
            toastId = toast.loading(t('notice-list.creating-organization'))
            const created = await addOrganization({
                full_name: formData.fullName,
                short_name: formData.shortName,
                address: formData.address,
                inn: formData.inn,
                kpp: formData.kpp,
                ...(mock ? { kind: formData.kind } : {}),
            }).unwrap()
            // The administrator role is created with the organization. Assign the chosen person only after that role exists.
            let administratorFailed = false
            if (mock && Number.isInteger(administratorId) && administratorId > 0) {
                if (typeof created?.administrator_role_id !== 'string' || typeof created.corporation_id !== 'number' || typeof created.id !== 'number') {
                    administratorFailed = true
                } else {
                    try {
                        await createAssignment({
                            userId: administratorId,
                            roleId: created.administrator_role_id,
                            scope: {
                                type: 'organization',
                                organizationId: created.id,
                                corporationId: created.corporation_id,
                            },
                        }).unwrap()
                    } catch {
                        administratorFailed = true
                    }
                }
            }
            if (typeof created?.id === 'number') onCreated?.(created.id)
            toast.success(t('notice-list.organization-created', { kind: t(organizationKindLabelKey(formData.kind)) }))
            if (administratorFailed) toast.error(t('notice-list.organization-administrator-failed'))
            onOpenChange(false)
            setFormData(emptyForm)
        } catch (error) {
            errorsHandler(error, t)
        } finally {
            toast.dismiss(toastId)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[min(90vh,44rem)] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('settings-page.create-organization')}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="fullName">{t('fields.full-name')}</Label>
                        <Input
                            id="fullName"
                            value={formData.fullName}
                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="shortName">{t('fields.short-name')}</Label>
                        <Input
                            id="shortName"
                            value={formData.shortName}
                            onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                            required
                        />
                    </div>
                    {mock ? (
                        <div className="space-y-2">
                            <Label htmlFor="organization-kind">{t('settings-page.organization-kind')}</Label>
                            <select
                                id="organization-kind"
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                value={formData.kind}
                                onChange={(event) => setFormData({ ...formData, kind: event.target.value === 'customer' ? 'customer' : 'laboratory' })}
                            >
                                <option value="laboratory">{t(organizationKindLabelKey('laboratory'))}</option>
                                <option value="customer">{t(organizationKindLabelKey('customer'))}</option>
                            </select>
                        </div>
                    ) : null}
                    <div className="space-y-2">
                        <Label htmlFor="address" className="leading-snug">{t('fields.address-legal')}</Label>
                        <Input
                            id="address"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            required
                        />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="inn">{t('fields.inn')}</Label>
                            <Input
                                id="inn"
                                inputMode="numeric"
                                autoComplete="off"
                                pattern="[0-9]+"
                                maxLength={12}
                                value={formData.inn}
                                onChange={(e) => setFormData({ ...formData, inn: e.target.value.replace(/\D/g, '') })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="kpp">{t('fields.kpp')}</Label>
                            <Input
                                id="kpp"
                                inputMode="numeric"
                                autoComplete="off"
                                pattern="[0-9]+"
                                maxLength={9}
                                value={formData.kpp}
                                onChange={(e) => setFormData({ ...formData, kpp: e.target.value.replace(/\D/g, '') })}
                                required
                            />
                        </div>
                    </div>
                    {mock ? (
                        <div className="space-y-2">
                            <Label htmlFor="organization-administrator">{t('settings-page.organization-administrator')}</Label>
                            <select
                                id="organization-administrator"
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                value={formData.administratorId}
                                onChange={(event) => setFormData({ ...formData, administratorId: event.target.value })}
                            >
                                <option value="">{t('settings-page.organization-administrator-empty')}</option>
                                {specialists.map((person) => (
                                    <option key={person.id} value={String(person.id)}>{person.label}</option>
                                ))}
                            </select>
                            <p className="text-xs text-muted-foreground">{t('settings-page.organization-administrator-hint')}</p>
                        </div>
                    ) : null}
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            {t('buttons.cancel')}
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {t('buttons.create')}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
