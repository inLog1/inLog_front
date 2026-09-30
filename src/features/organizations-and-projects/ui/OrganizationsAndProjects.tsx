import { Button } from "../../../shared/ui/button"
import { Loader2, Plus, Trash2, Building2, FolderOpen, MapPin } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useState } from "react"
import { toast } from "react-hot-toast"
import { useDeleteOrganizationMutation, useGetOrganizationsQuery } from "../../../entities/organization/model/organizationSlice"
import { useDeleteProjectMutation, useGetProjectsQuery } from "../../../entities/project/model/projectSlice"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../../shared/ui/alert-dialog"
import { CreateProjectDialog } from "./CreateProjectDialog"
import { cn } from "../../../shared/lib/utils"
import { CreateOrganizationDialog } from "./CreateOrganizationDialog"
import { formatAdminDateShort } from "../../platform-admin/lib/format"
import { canManageOrganization } from "../../../shared/types/membership-access"

function initials(name?: string) {
    const parts = name?.trim().split(/\s+/).filter(Boolean).slice(0, 2) ?? []
    if (!parts.length) return "—"
    return parts.map((part) => part[0]?.toUpperCase() ?? "").join("")
}

const OrganizationsAndProjects = () => {
    const { t } = useTranslation()
    const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)
    const [orgToDelete, setOrgToDelete] = useState<number | null>(null)
    const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false)
    const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false)

    const { data: organizations = [], isLoading: orgsLoading } = useGetOrganizationsQuery()
    const selectedOrg = organizations.find((org) => org.id === selectedOrgId) ?? organizations[0] ?? null
    const activeOrgId = selectedOrg?.id ?? null
    
    const { 
        data: projects = [], 
        isLoading: projectsLoading,
        isFetching: projectsFetching 
    } = useGetProjectsQuery(
        { organization: activeOrgId! },
        { skip: activeOrgId == null }
    )

    const [deleteProject, { isLoading: isDeletingProject }] = useDeleteProjectMutation()
    const [deleteOrganization, { isLoading: isDeletingOrg }] = useDeleteOrganizationMutation()

    const onDeleteOrganization = async () => {
        if (!orgToDelete) return
        
        let toastId: string | undefined
        try {
            toastId = toast.loading(t('notice-list.deleting-organization'))
            await deleteOrganization(orgToDelete).unwrap()
            toast.success(t('notice-list.organization-deleted'))
            if (activeOrgId === orgToDelete) setSelectedOrgId(null)
            setOrgToDelete(null)
        } catch {
            toast.error(t('errors.error-deleting-organization'))
        } finally {
            toast.dismiss(toastId)
        }
    }

    const onDeleteProject = async (id: number) => {
        let toastId: string | undefined
        try {
            toastId = toast.loading(t('notice-list.deleting-project'))
            await deleteProject(id).unwrap()
            toast.success(t('notice-list.project-deleted'))
        } catch {
            toast.error(t('errors.error-deleting-project'))
        } finally {
            toast.dismiss(toastId)
        }
    }

    if (orgsLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        )
    }

    if (!organizations.length) {
        return (
            <div className="flex h-full min-h-[28rem] w-full items-center justify-center rounded-2xl border border-dashed border-border bg-card">
                <div className="max-w-sm px-6 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Building2 className="h-7 w-7" />
                    </div>
                    <h2 className="text-lg font-semibold">{t('scheduler-page.no-organizations-yet')}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{t('settings-page.empty-organizations-hint')}</p>
                    <Button className="mt-6" onClick={() => setIsCreateOrgOpen(true)}>
                        <Plus className="h-4 w-4" />
                        {t('scheduler-page.create-first-organization')}
                    </Button>
                </div>
                <CreateOrganizationDialog open={isCreateOrgOpen} onOpenChange={setIsCreateOrgOpen} />
            </div>
        )
    }

    return (
        <div className="flex h-full min-h-0 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-muted/30">
                <div className="flex items-center justify-between gap-3 px-4 py-4">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{t('settings-page.organizations')}</p>
                        <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-border">
                            {organizations.length}
                        </span>
                    </div>
                    <Button
                        size="icon"
                        className="h-8 w-8"
                        aria-label={t('settings-page.new-organization')}
                        onClick={() => setIsCreateOrgOpen(true)}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
                <div className="min-h-0 flex-1 space-y-1 overflow-auto px-2 py-1 pb-3">
                    {organizations.map((org) => {
                        const active = org.id === activeOrgId
                        return (
                            <div
                                key={org.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedOrgId(org.id)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault()
                                        setSelectedOrgId(org.id)
                                    }
                                }}
                                className={cn(
                                    "group flex w-full cursor-pointer items-center gap-3 rounded-xl border px-2.5 py-2.5 text-left transition-colors",
                                    active ? "border-border bg-background" : "border-transparent hover:bg-background/70",
                                )}
                            >
                                <span className={cn(
                                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                                    active ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground ring-1 ring-border",
                                )}>
                                    {initials(org.shortName || org.fullName)}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">{org.fullName}</span>
                                    <span className="block truncate text-xs text-muted-foreground">{org.shortName}</span>
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                                    onClick={(event) => {
                                        event.stopPropagation()
                                        setOrgToDelete(org.id)
                                    }}
                                    disabled={isDeletingOrg}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )
                    })}
                </div>
            </aside>

            <section className="flex min-w-0 flex-1 flex-col">
                {selectedOrg && (
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5">
                        <div className="min-w-0">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {t('settings-page.organization')}
                            </p>
                            <h2 className="mt-1 truncate text-xl font-semibold">{selectedOrg.fullName}</h2>
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                {selectedOrg.shortName && <span>{selectedOrg.shortName}</span>}
                                {selectedOrg.address && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5" />
                                        {selectedOrg.address}
                                    </span>
                                )}
                            </div>
                        </div>
                        <Button onClick={() => setIsCreateProjectOpen(true)}>
                            <Plus className="h-4 w-4" />
                            {t('settings-page.new-project')}
                        </Button>
                    </div>
                )}

                <div className="min-h-0 flex-1 overflow-auto p-6">
                    {projectsLoading || projectsFetching ? (
                        <div className="flex h-full items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : projects.length === 0 ? (
                        <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border text-center">
                            <FolderOpen className="mb-3 h-8 w-8 text-muted-foreground" />
                            <p className="text-sm font-medium">{t('scheduler-page.no-projects-in-organization')}</p>
                            <p className="mt-1 max-w-xs text-sm text-muted-foreground">{t('settings-page.empty-projects-hint')}</p>
                            <Button variant="outline" className="mt-5" onClick={() => setIsCreateProjectOpen(true)}>
                                <Plus className="h-4 w-4" />
                                {t('settings-page.create-first-project')}
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                            {projects.map((project) => {
                                const canDeleteProject = canManageOrganization(selectedOrg?.role, 'delete-project')
                                const details = [
                                    { label: t('fields.reservoir'), value: project.reservoir },
                                    { label: t('admin-page.projects-table.country'), value: project.country },
                                    { label: t('admin-page.projects-table.customer'), value: project.company_customer },
                                    { label: t('admin-page.projects-table.contractor'), value: project.contractor },
                                    {
                                        label: t('admin-page.projects-table.created'),
                                        value: project.created_at ? formatAdminDateShort(project.created_at) : '',
                                    },
                                ].filter((item) => item.value?.trim())

                                return (
                                    <div
                                        key={project.id}
                                        className="group rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/40"
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                                <FolderOpen className="h-4 w-4" />
                                            </span>
                                            <p className="min-w-0 flex-1 pt-1.5 text-sm font-medium">{project.name}</p>
                                            {canDeleteProject && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                                                    onClick={() => onDeleteProject(project.id)}
                                                    disabled={isDeletingProject}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                        {details.length > 0 && (
                                            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3">
                                                {details.map((item) => (
                                                    <div key={item.label} className="min-w-0">
                                                        <dt className="text-xs text-muted-foreground">{item.label}</dt>
                                                        <dd className="truncate text-sm">{item.value}</dd>
                                                    </div>
                                                ))}
                                            </dl>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* Delete Organization Dialog */}
            <AlertDialog open={!!orgToDelete} onOpenChange={() => setOrgToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('notice-list.confirm-delete-organization')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('notice-list.confirm-delete-organization-description')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingOrg}>
                            {t('buttons.cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={onDeleteOrganization}
                            disabled={isDeletingOrg}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {isDeletingOrg ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    {t('buttons.deleting')}
                                </>
                            ) : (
                                t('buttons.delete')
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Create Dialogs */}
            <CreateOrganizationDialog 
                open={isCreateOrgOpen}
                onOpenChange={setIsCreateOrgOpen}
            />
            
            <CreateProjectDialog
                open={isCreateProjectOpen}
                onOpenChange={setIsCreateProjectOpen}
                organizationId={activeOrgId}
            />
        </div>
    )
}

export default OrganizationsAndProjects