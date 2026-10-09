import { Building2, Loader2, MapPin, Pencil, Plus, Trash2, Users } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "react-hot-toast"
import { Link } from "react-router-dom"
import { useDeleteOrganizationMutation, useGetOrganizationsQuery } from "../../../entities/organization/model/organizationSlice"
import type { Organization } from "../../../entities/organization/model/types"
import { useGetProjectsQuery } from "../../../entities/project/model/projectSlice"
import { DebouncedSearchInput } from "../../platform-admin/ui/DebouncedSearchInput"
import { FilterMenu } from "../../platform-admin/ui/FilterMenu"
import { routes } from "../../../shared/lib/routes"
import { cn } from "../../../shared/lib/utils"
import { canManageOrganization } from "../../../shared/types/membership-access"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../../shared/ui/alert-dialog"
import { Badge } from "../../../shared/ui/badge"
import { Button } from "../../../shared/ui/button"
import { NameChipStack } from "../../../shared/ui/name-chip-stack"
import { CreateOrganizationDialog } from "./CreateOrganizationDialog"
import { EditOrganizationDialog } from "./EditOrganizationDialog"
import { EntityMembersDialog } from "./EntityMembersDialog"

function initials(name?: string) {
    const parts = name?.trim().split(/\s+/).filter(Boolean).slice(0, 2) ?? []
    if (!parts.length) return "—"
    return parts.map((part) => part[0]?.toUpperCase() ?? "").join("")
}

const OrganizationsPanel = () => {
    const { t } = useTranslation()
    const [search, setSearch] = useState("")
    const [extraFilters, setExtraFilters] = useState({ address: "", projects: "all" })
    const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null)
    const [editingOrganization, setEditingOrganization] = useState<Organization | null>(null)
    const [membersOrganization, setMembersOrganization] = useState<Organization | null>(null)
    const [isCreateOpen, setIsCreateOpen] = useState(false)

    const { data: organizations = [], isLoading } = useGetOrganizationsQuery()
    const { data: projects = [] } = useGetProjectsQuery({})
    const [deleteOrganization, { isLoading: isDeleting }] = useDeleteOrganizationMutation()

    const projectsByOrg = useMemo(() => {
        const grouped = new Map<number, { id: number; name: string }[]>()
        projects.forEach((project) => {
            if (project.organization == null || !project.name) return
            const list = grouped.get(project.organization) ?? []
            list.push({ id: project.id, name: project.name })
            grouped.set(project.organization, list)
        })
        return grouped
    }, [projects])

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase()
        const addressQuery = extraFilters.address.trim().toLowerCase()
        return organizations.filter((organization) => {
            if (addressQuery && !(organization.address || "").toLowerCase().includes(addressQuery)) return false
            const projectCount = projectsByOrg.get(organization.id)?.length ?? 0
            if (extraFilters.projects === "with" && projectCount === 0) return false
            if (extraFilters.projects === "without" && projectCount > 0) return false
            if (!query) return true
            return [organization.fullName, organization.shortName, organization.address]
                .some((value) => value?.toLowerCase().includes(query))
        })
    }, [extraFilters, organizations, projectsByOrg, search])

    const onDeleteOrganization = async () => {
        if (!orgToDelete) return

        let toastId: string | undefined
        try {
            toastId = toast.loading(t('notice-list.deleting-organization'))
            await deleteOrganization(orgToDelete.id).unwrap()
            toast.success(t('notice-list.organization-deleted'))
            setOrgToDelete(null)
        } catch {
            toast.error(t('errors.error-deleting-organization'))
        } finally {
            toast.dismiss(toastId)
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-full min-h-[60vh] w-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="flex h-full min-h-0 w-full flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight">{t('settings-page.organizations')}</h2>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        {t('settings-page.organizations-description')}
                    </p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="h-4 w-4" />
                    {t('settings-page.new-organization')}
                </Button>
            </div>

            {organizations.length > 0 && (
                <div className="flex w-full items-center gap-2">
                    <DebouncedSearchInput
                        value={search}
                        onDebouncedChange={(value) => {
                            const next = value.trim()
                            setSearch((current) => (current === next ? current : next))
                        }}
                        placeholder={t('settings-page.search-organizations')}
                    />
                    <div className="ml-auto shrink-0">
                    <FilterMenu
                        active={Boolean(extraFilters.address.trim()) || extraFilters.projects !== "all"}
                        values={extraFilters}
                        onApply={(values) => setExtraFilters({
                            address: values.address || "",
                            projects: values.projects || "all",
                        })}
                        fields={[
                            {
                                id: "address",
                                label: t("admin-page.filter-address"),
                                kind: "text",
                                emptyValue: "",
                                placeholder: t("fields.address"),
                            },
                            {
                                id: "projects",
                                label: t("admin-page.filter-projects"),
                                kind: "select",
                                emptyValue: "all",
                                options: [
                                    { value: "all", label: t("admin-page.filter-projects-any") },
                                    { value: "with", label: t("admin-page.filter-projects-with") },
                                    { value: "without", label: t("admin-page.filter-projects-without") },
                                ],
                            },
                        ]}
                    />
                    </div>
                </div>
            )}

            <div className="min-h-0 flex-1 overflow-auto">
                {organizations.length === 0 ? (
                    <EmptyState
                        title={t('scheduler-page.no-organizations-yet')}
                        description={t('settings-page.empty-organizations-hint')}
                        actionLabel={t('scheduler-page.create-first-organization')}
                        onAction={() => setIsCreateOpen(true)}
                    />
                ) : filtered.length === 0 ? (
                    <EmptyState
                        title={t('settings-page.no-search-results')}
                        description={t('settings-page.no-search-results-hint')}
                    />
                ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {filtered.map((organization) => {
                            const canEdit = canManageOrganization(organization.role, 'rename-organization')
                            const role = organization.role === 'admin' || organization.role === 'user'
                                ? organization.role
                                : null
                            const organizationProjects = projectsByOrg.get(organization.id) ?? []

                            return (
                                <article
                                    key={organization.id}
                                    className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm"
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                                            {initials(organization.shortName || organization.fullName)}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="truncate text-sm font-semibold">{organization.fullName}</h3>
                                            {organization.shortName && (
                                                <p className="truncate text-xs text-muted-foreground">{organization.shortName}</p>
                                            )}
                                        </div>
                                        {role && (
                                            <Badge variant={role === 'admin' ? 'default' : 'secondary'}>
                                                {t(`settings-page.membership-roles.${role}`)}
                                            </Badge>
                                        )}
                                    </div>

                                    <p className="mt-4 flex min-h-5 items-start gap-1.5 text-sm text-muted-foreground">
                                        {organization.address ? (
                                            <>
                                                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                                <span className="line-clamp-2">{organization.address}</span>
                                            </>
                                        ) : (
                                            <span>{t('settings-page.no-address')}</span>
                                        )}
                                    </p>

                                    <div className="mt-4 border-t border-border pt-3">
                                        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                                            {t('settings-page.projects')}
                                        </p>
                                        <Link
                                            to={`${routes.settings.projects()}?org=${organization.id}`}
                                            className="inline-flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            <NameChipStack items={organizationProjects} />
                                        </Link>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setMembersOrganization(organization)}
                                            >
                                                <Users className="h-4 w-4" />
                                                {t('settings-page.subscribers')}
                                            </Button>
                                        </div>
                                        <div className="flex items-center">
                                            {canEdit && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    aria-label={t('settings-page.edit-organization')}
                                                    onClick={() => setEditingOrganization(organization)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 hover:text-destructive"
                                                aria-label={t('buttons.delete')}
                                                disabled={isDeleting}
                                                onClick={() => setOrgToDelete(organization)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </article>
                            )
                        })}
                    </div>
                )}
            </div>

            <AlertDialog open={Boolean(orgToDelete)} onOpenChange={(open) => { if (!open) setOrgToDelete(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('notice-list.confirm-delete-organization')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('notice-list.confirm-delete-organization-description')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>{t('buttons.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={onDeleteOrganization}
                            disabled={isDeleting}
                            className={cn("bg-destructive hover:bg-destructive/90")}
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {t('buttons.deleting')}
                                </>
                            ) : (
                                t('buttons.delete')
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <EntityMembersDialog
                open={Boolean(membersOrganization)}
                onOpenChange={(open) => {
                    if (!open) setMembersOrganization(null)
                }}
                kind="organization"
                entityId={membersOrganization?.id ?? 0}
                entityName={membersOrganization?.fullName || membersOrganization?.shortName || ""}
                canManage={canManageOrganization(membersOrganization?.role, 'remove-member')}
            />
            <CreateOrganizationDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
            <EditOrganizationDialog
                organization={editingOrganization}
                open={Boolean(editingOrganization)}
                onOpenChange={(open) => {
                    if (!open) setEditingOrganization(null)
                }}
            />
        </div>
    )
}

function EmptyState({
    title,
    description,
    actionLabel,
    onAction,
}: {
    title: string
    description: string
    actionLabel?: string
    onAction?: () => void
}) {
    return (
        <div className="flex h-full min-h-[24rem] items-center justify-center rounded-2xl border border-dashed border-border bg-card">
            <div className="max-w-sm px-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Building2 className="h-7 w-7" />
                </div>
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                {actionLabel && onAction && (
                    <Button className="mt-6" onClick={onAction}>
                        <Plus className="h-4 w-4" />
                        {actionLabel}
                    </Button>
                )}
            </div>
        </div>
    )
}

export default OrganizationsPanel
