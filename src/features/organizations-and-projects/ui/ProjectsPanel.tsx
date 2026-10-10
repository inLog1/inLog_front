import { FolderOpen, Loader2, Pencil, Plus, Trash2, Users } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "react-hot-toast"
import { useSelector } from "react-redux"
import { Link, useSearchParams } from "react-router-dom"
import { selectUser } from "../../../entities/user/model/selectors"
import { canAccessSection } from "../../../shared/lib/available-features"
import { useGetOrganizationsQuery } from "../../../entities/organization/model/organizationSlice"
import { useDeleteProjectMutation, useGetProjectsQuery } from "../../../entities/project/model/projectSlice"
import type { Project } from "../../../entities/project/model/types"
import { formatAdminDateShort } from "../../platform-admin/lib/format"
import { DebouncedSearchInput } from "../../platform-admin/ui/DebouncedSearchInput"
import { FilterMenu, matchesCreatedPeriod } from "../../platform-admin/ui/FilterMenu"
import { CountryValue, usePopularCountries } from "../../../shared/ui/country-select"
import { routes } from "../../../shared/lib/routes"
import { canManageOrganization, canManageProject } from "../../../shared/types/membership-access"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../../shared/ui/alert-dialog"
import { Button } from "../../../shared/ui/button"
import { NameChipStack } from "../../../shared/ui/name-chip-stack"
import { SiteNameChip } from "../../../shared/ui/site-name-chip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../shared/ui/table"
import { CreateProjectDialog } from "./CreateProjectDialog"
import { EditProjectDialog } from "./EditProjectDialog"
import { EntityMembersDialog } from "./EntityMembersDialog"

const ALL_ORGANIZATIONS = "all"

const ProjectsPanel = () => {
    const { t } = useTranslation()
    const user = useSelector(selectUser)
    const organizationsOpen = canAccessSection(user, 'organizations')
    const countries = usePopularCountries()
    const [searchParams, setSearchParams] = useSearchParams()
    const [search, setSearch] = useState("")
    const [extraFilters, setExtraFilters] = useState({ country: "all", reservoir: "", created: "all" })
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [editingProject, setEditingProject] = useState<Project | null>(null)
    const [membersProject, setMembersProject] = useState<Project | null>(null)
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)

    const orgParam = searchParams.get("org")
    const selectedOrgId = orgParam && Number.isFinite(Number(orgParam)) ? Number(orgParam) : null

    const { data: organizations = [], isLoading: orgsLoading } = useGetOrganizationsQuery()
    const { data: projects = [], isLoading: projectsLoading, isFetching } = useGetProjectsQuery(
        selectedOrgId ? { organization: selectedOrgId } : {},
    )
    const [deleteProject, { isLoading: isDeleting }] = useDeleteProjectMutation()

    const organizationName = (id?: number) => {
        const organization = organizations.find((item) => item.id === id)
        return organization?.shortName || organization?.fullName || "—"
    }

    const filtered = useMemo(() => {
        const scoped = selectedOrgId
            ? projects.filter((project) => project.organization === selectedOrgId)
            : projects
        const query = search.trim().toLowerCase()
        const reservoirQuery = extraFilters.reservoir.trim().toLowerCase()
        const country = countries.find((item) => item.code === extraFilters.country)
        return scoped.filter((project) => {
            if (country) {
                const value = (project.country || "").trim().toLowerCase()
                const matches = value === country.code.toLowerCase() || value === country.name.toLowerCase()
                if (!matches) return false
            }
            if (reservoirQuery && !(project.reservoir || "").toLowerCase().includes(reservoirQuery)) return false
            if (!matchesCreatedPeriod(project.created_at, extraFilters.created)) return false
            if (!query) return true
            const organization = organizations.find((item) => item.id === project.organization)
            const organizationLabel = organization?.shortName || organization?.fullName || ""
            return [project.name, organizationLabel, project.reservoir, project.country]
                .some((value) => value?.toLowerCase().includes(query))
        })
    }, [countries, extraFilters, organizations, projects, search, selectedOrgId])

    const setOrganizationFilter = (value: string) => {
        const next = new URLSearchParams(searchParams)
        if (value === ALL_ORGANIZATIONS) next.delete("org")
        else next.set("org", value)
        setSearchParams(next, { replace: true })
    }

    const onDeleteProject = async () => {
        if (!projectToDelete) return

        let toastId: string | undefined
        try {
            toastId = toast.loading(t('notice-list.deleting-project'))
            await deleteProject(projectToDelete.id).unwrap()
            toast.success(t('notice-list.project-deleted'))
            setProjectToDelete(null)
        } catch {
            toast.error(t('errors.error-deleting-project'))
        } finally {
            toast.dismiss(toastId)
        }
    }

    if (orgsLoading) {
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
                    <h2 className="text-xl font-semibold tracking-tight">{t('settings-page.projects')}</h2>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        {t('settings-page.projects-description')}
                    </p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)} disabled={organizations.length === 0}>
                    <Plus className="h-4 w-4" />
                    {t('settings-page.new-project')}
                </Button>
            </div>

            {organizations.length === 0 ? (
                <div className="flex h-full min-h-[24rem] items-center justify-center rounded-2xl border border-dashed border-border bg-card">
                    <div className="max-w-sm px-6 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <FolderOpen className="h-7 w-7" />
                        </div>
                        <h2 className="text-lg font-semibold">{t('scheduler-page.no-organizations-yet')}</h2>
                        <p className="mt-2 text-sm text-muted-foreground">{t('settings-page.empty-organizations-hint')}</p>
                        {organizationsOpen && (
                            <Button className="mt-6" asChild>
                                <Link to={routes.settings.organizations()}>
                                    <Plus className="h-4 w-4" />
                                    {t('scheduler-page.create-first-organization')}
                                </Link>
                            </Button>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex w-full items-center gap-2">
                        <DebouncedSearchInput
                            value={search}
                            onDebouncedChange={(value) => {
                                const next = value.trim()
                                setSearch((current) => (current === next ? current : next))
                            }}
                            placeholder={t('settings-page.search-projects')}
                        />
                        {isFetching && !projectsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        <div className="ml-auto shrink-0">
                        <FilterMenu
                            active={Boolean(selectedOrgId) || extraFilters.country !== "all" || Boolean(extraFilters.reservoir.trim()) || extraFilters.created !== "all"}
                            values={{
                                organization: selectedOrgId ? String(selectedOrgId) : ALL_ORGANIZATIONS,
                                country: extraFilters.country,
                                reservoir: extraFilters.reservoir,
                                created: extraFilters.created,
                            }}
                            onApply={(values) => {
                                setOrganizationFilter(values.organization || ALL_ORGANIZATIONS)
                                setExtraFilters({
                                    country: values.country || "all",
                                    reservoir: values.reservoir || "",
                                    created: values.created || "all",
                                })
                            }}
                            fields={[
                                {
                                    id: "organization",
                                    label: t("admin-page.projects-table.organization"),
                                    kind: "select",
                                    emptyValue: ALL_ORGANIZATIONS,
                                    options: [
                                        { value: ALL_ORGANIZATIONS, label: t("settings-page.all-organizations") },
                                        ...organizations.map((organization) => ({
                                            value: String(organization.id),
                                            label: organization.shortName || organization.fullName,
                                        })),
                                    ],
                                },
                                {
                                    id: "country",
                                    label: t("admin-page.projects-table.country"),
                                    kind: "select",
                                    emptyValue: "all",
                                    options: [
                                        { value: "all", label: t("admin-page.filter-country-any") },
                                        ...countries.map((country) => ({ value: country.code, label: country.name })),
                                    ],
                                },
                                {
                                    id: "reservoir",
                                    label: t("admin-page.filter-reservoir"),
                                    kind: "text",
                                    emptyValue: "",
                                    placeholder: t("fields.reservoir"),
                                },
                                {
                                    id: "created",
                                    label: t("admin-page.filter-created"),
                                    kind: "select",
                                    emptyValue: "all",
                                    options: [
                                        { value: "all", label: t("admin-page.filter-created-any") },
                                        { value: "30", label: t("admin-page.filter-created-30") },
                                        { value: "90", label: t("admin-page.filter-created-90") },
                                        { value: "year", label: t("admin-page.filter-created-year") },
                                    ],
                                },
                            ]}
                        />
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-card">
                        {projectsLoading ? (
                            <div className="flex h-full min-h-48 items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 text-center">
                                <FolderOpen className="mb-3 h-8 w-8 text-muted-foreground" />
                                <p className="text-sm font-medium">
                                    {projects.length === 0
                                        ? (selectedOrgId
                                            ? t('scheduler-page.no-projects-in-organization')
                                            : t('settings-page.no-projects'))
                                        : t('settings-page.no-search-results')}
                                </p>
                                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                                    {projects.length === 0
                                        ? (selectedOrgId
                                            ? t('settings-page.empty-projects-hint')
                                            : t('settings-page.empty-all-projects-hint'))
                                        : t('settings-page.no-search-results-hint')}
                                </p>
                                {projects.length === 0 && (
                                    <Button variant="outline" className="mt-5" onClick={() => setIsCreateOpen(true)}>
                                        <Plus className="h-4 w-4" />
                                        {t('settings-page.create-first-project')}
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t('admin-page.projects-table.name')}</TableHead>
                                        <TableHead>{t('admin-page.projects-table.organization')}</TableHead>
                                        <TableHead>{t('fields.reservoir')}</TableHead>
                                        <TableHead>{t('fields.country')}</TableHead>
                                        <TableHead>{t('admin-page.projects-table.created')}</TableHead>
                                        <TableHead className="text-right">{t('admin-page.users-table.actions')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((project) => {
                                        const organization = organizations.find((item) => item.id === project.organization)
                                        const canEdit = canManageProject(project.role ?? organization?.role, 'rename-project')
                                        const canDelete = canManageOrganization(organization?.role ?? project.role, 'delete-project')

                                        return (
                                            <TableRow key={project.id}>
                                                <TableCell>
                                                    <SiteNameChip value={project.name} toneKey={`project-${project.id}`} />
                                                </TableCell>
                                                <TableCell>
                                                    <NameChipStack
                                                        items={organizationName(project.organization) === "—"
                                                            ? []
                                                            : [{
                                                                id: project.organization ?? organizationName(project.organization),
                                                                name: organizationName(project.organization),
                                                            }]}
                                                    />
                                                </TableCell>
                                                <TableCell>{project.reservoir || "—"}</TableCell>
                                                <TableCell><CountryValue code={project.country} /></TableCell>
                                                <TableCell className="whitespace-nowrap text-muted-foreground">
                                                    {project.created_at ? formatAdminDateShort(project.created_at) : "—"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            aria-label={t('settings-page.subscribers')}
                                                            onClick={() => setMembersProject(project)}
                                                        >
                                                            <Users className="h-4 w-4" />
                                                        </Button>
                                                        {canEdit && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                aria-label={t('settings-page.edit-project')}
                                                                onClick={() => setEditingProject(project)}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        {canDelete && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 hover:text-destructive"
                                                                aria-label={t('buttons.delete')}
                                                                disabled={isDeleting}
                                                                onClick={() => setProjectToDelete(project)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </>
            )}

            <AlertDialog open={Boolean(projectToDelete)} onOpenChange={(open) => { if (!open) setProjectToDelete(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('notice-list.confirm-delete-project')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('notice-list.confirm-delete-project-description', { name: projectToDelete?.name ?? "" })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>{t('buttons.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={onDeleteProject}
                            disabled={isDeleting}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {isDeleting ? t('buttons.deleting') : t('buttons.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <EntityMembersDialog
                open={Boolean(membersProject)}
                onOpenChange={(open) => {
                    if (!open) setMembersProject(null)
                }}
                kind="project"
                entityId={membersProject?.id ?? 0}
                entityName={membersProject?.name ?? ""}
                canManage={canManageProject(
                    membersProject?.role ?? organizations.find((item) => item.id === membersProject?.organization)?.role,
                    'remove-member',
                )}
            />
            <CreateProjectDialog
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                organizations={organizations}
                defaultOrganizationId={selectedOrgId}
            />
            <EditProjectDialog
                project={editingProject}
                open={Boolean(editingProject)}
                onOpenChange={(open) => {
                    if (!open) setEditingProject(null)
                }}
            />
        </div>
    )
}

export default ProjectsPanel
