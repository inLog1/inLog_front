import { Mail, UserMinus, Users } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { getPersonLetter, personColorClass } from "../../platform-admin/lib/task-users"
import { hideMockSubscriber, useSubscribersRevision, visibleMockSubscribers } from "../model/mock-subscribers"
import type { MembershipRole } from "../../../shared/types/membership-access"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../../shared/ui/alert-dialog"
import { Badge } from "../../../shared/ui/badge"
import { Button } from "../../../shared/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../shared/ui/dialog"
import { Input } from "../../../shared/ui/input"
import { Label } from "../../../shared/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../shared/ui/select"

export type MembersEntityKind = "organization" | "project"

interface PendingInvite {
    id: string
    email: string
    role: MembershipRole
}

const pendingByEntity = new Map<string, PendingInvite[]>()

function entityKey(kind: MembersEntityKind, id: number) {
    return `${kind}:${id}`
}

function isEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

interface EntityMembersDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    kind: MembersEntityKind
    entityId: number
    entityName: string
    canManage?: boolean
}

export function EntityMembersDialog({
    open,
    onOpenChange,
    kind,
    entityId,
    entityName,
    canManage = false,
}: EntityMembersDialogProps) {
    const { t } = useTranslation()
    useSubscribersRevision()
    const key = entityId ? entityKey(kind, entityId) : ""
    const confirmed = entityId ? visibleMockSubscribers(kind, entityId) : []
    const [memberToRemove, setMemberToRemove] = useState<number | null>(null)
    const [invites, setInvites] = useState<PendingInvite[]>([])
    const [email, setEmail] = useState("")
    const [role, setRole] = useState<MembershipRole>("user")
    const [inviteToRemove, setInviteToRemove] = useState<PendingInvite | null>(null)

    useEffect(() => {
        if (!open || !key) return
        setInvites(pendingByEntity.get(key) ?? [])
        setEmail("")
        setRole("user")
    }, [open, key])

    const saveInvites = (next: PendingInvite[]) => {
        if (!key) return
        pendingByEntity.set(key, next)
        setInvites(next)
    }

    const handleInvite = (event: React.FormEvent) => {
        event.preventDefault()
        const normalized = email.trim().toLowerCase()
        if (!isEmail(normalized)) {
            toast.error(t("settings-page.subscribers-invalid-email"))
            return
        }
        if (invites.some((invite) => invite.email === normalized)) {
            toast.error(t("settings-page.subscribers-duplicate"))
            return
        }

        saveInvites([
            {
                id: crypto.randomUUID(),
                email: normalized,
                role,
            },
            ...invites,
        ])
        setEmail("")
        setRole("user")
        toast.success(t("settings-page.subscribers-invited", { email: normalized }))
    }

    const removeInvite = () => {
        if (!inviteToRemove) return
        saveInvites(invites.filter((invite) => invite.id !== inviteToRemove.id))
        toast.success(t("settings-page.subscribers-invite-removed"))
        setInviteToRemove(null)
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{t("settings-page.subscribers")}</DialogTitle>
                        <DialogDescription>
                            {t(
                                kind === "organization"
                                    ? "settings-page.subscribers-organization-hint"
                                    : "settings-page.subscribers-project-hint",
                                { name: entityName },
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {canManage && (
                        <form onSubmit={handleInvite} className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
                            <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                                <div className="space-y-1.5">
                                    <Label htmlFor="subscriber-email">{t("fields.email")}</Label>
                                    <Input
                                        id="subscriber-email"
                                        type="email"
                                        value={email}
                                        placeholder={t("settings-page.subscribers-email-placeholder")}
                                        onChange={(event) => setEmail(event.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>{t("admin-page.members-table.role")}</Label>
                                    <Select value={role} onValueChange={(value) => setRole(value as MembershipRole)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="user">{t("settings-page.membership-roles.user")}</SelectItem>
                                            <SelectItem value="admin">{t("settings-page.membership-roles.admin")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button type="submit">
                                    <Mail className="h-4 w-4" />
                                    {t("settings-page.subscribers-invite")}
                                </Button>
                            </div>
                        </form>
                    )}

                    <section className="space-y-2">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium">{t("settings-page.subscribers-pending")}</h3>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{invites.length}</span>
                        </div>
                        {invites.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                                {t("settings-page.subscribers-pending-empty")}
                            </p>
                        ) : (
                            <ul className="max-h-40 space-y-2 overflow-auto">
                                {invites.map((invite) => (
                                    <li key={invite.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                            <Mail className="h-4 w-4" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">{invite.email}</span>
                                            <span className="block text-xs text-muted-foreground">{t("settings-page.subscribers-waiting")}</span>
                                        </span>
                                        <Badge variant="secondary">{t(`settings-page.membership-roles.${invite.role}`)}</Badge>
                                        {canManage && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 hover:text-destructive"
                                                aria-label={t("settings-page.subscribers-remove-invite")}
                                                onClick={() => setInviteToRemove(invite)}
                                            >
                                                <UserMinus className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className="space-y-2">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium">{t("settings-page.subscribers-confirmed")}</h3>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{confirmed.length}</span>
                        </div>
                        {confirmed.length === 0 ? (
                            <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-4 py-6 text-center">
                                <Users className="mb-2 h-6 w-6 text-muted-foreground" />
                                <p className="text-sm font-medium">{t("settings-page.subscribers-empty")}</p>
                                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                                    {t("settings-page.subscribers-empty-hint")}
                                </p>
                            </div>
                        ) : (
                            <ul className="max-h-48 space-y-2 overflow-auto">
                                {confirmed.map((subscriber) => {
                                    const letter = getPersonLetter(subscriber.fullName, subscriber.email)
                                    return (
                                        <li key={subscriber.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
                                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${personColorClass(subscriber.email)}`}>
                                                {letter}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium">{subscriber.fullName}</span>
                                                <span className="block truncate text-xs text-muted-foreground">{subscriber.email}</span>
                                            </span>
                                            <Badge variant={subscriber.role === "admin" ? "default" : "secondary"}>
                                                {t(`settings-page.membership-roles.${subscriber.role}`)}
                                            </Badge>
                                            {canManage && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 hover:text-destructive"
                                                    aria-label={t("settings-page.subscribers-remove")}
                                                    onClick={() => setMemberToRemove(subscriber.id)}
                                                >
                                                    <UserMinus className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </section>
                </DialogContent>
            </Dialog>

            <AlertDialog open={memberToRemove != null} onOpenChange={(next) => { if (!next) setMemberToRemove(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("settings-page.subscribers-remove")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("settings-page.subscribers-remove-description", {
                                name: confirmed.find((subscriber) => subscriber.id === memberToRemove)?.fullName ?? "",
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("buttons.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            onClick={() => {
                                if (memberToRemove == null || !entityId) return
                                hideMockSubscriber(kind, entityId, memberToRemove)
                                toast.success(t("settings-page.subscribers-removed"))
                                setMemberToRemove(null)
                            }}
                        >
                            {t("buttons.delete")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={Boolean(inviteToRemove)} onOpenChange={(next) => { if (!next) setInviteToRemove(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("settings-page.subscribers-remove-invite")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("settings-page.subscribers-remove-invite-description", { email: inviteToRemove?.email ?? "" })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("buttons.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={removeInvite} className="bg-destructive hover:bg-destructive/90">
                            {t("buttons.delete")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
