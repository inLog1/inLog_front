import { AlertCircle, Building2, FolderOpen, Loader2, ShieldOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { routes } from '../../../shared/lib/routes'
import { Button } from '../../../shared/ui/button'
import type { WorkspaceReason, WorkspaceStatus as WorkspaceStatusName } from '../model/workspace-context'

const REASON_KEY: Record<WorkspaceReason, string> = {
    'invalid-organization': 'workspace.invalid-organization',
    'unknown-organization': 'workspace.unknown-organization',
    'forbidden-organization': 'workspace.forbidden-organization',
    'invalid-project': 'workspace.invalid-project',
    'unknown-project': 'workspace.unknown-project',
    'forbidden-project': 'workspace.forbidden-project',
    'project-organization-mismatch': 'workspace.project-organization-mismatch',
    'organizations-empty': 'workspace.empty-organizations',
    'projects-empty': 'workspace.empty-projects',
    'organizations-error': 'workspace.organizations-error',
    'projects-error': 'workspace.projects-error',
    'access-error': 'workspace.access-error',
    'choose-organization': 'workspace.choose-organization',
    'choose-project': 'workspace.choose-project',
    'missing-permission': 'workspace.missing-permission',
}

export function WorkspaceStatus({
    status,
    reason,
    onRetry,
}: {
    status: Exclude<WorkspaceStatusName, 'ready'>
    reason: WorkspaceReason | null
    onRetry?: () => void
}) {
    const { t } = useTranslation()
    const text = reason ? t(REASON_KEY[reason]) : t('workspace.loading')
    const Icon = status === 'loading'
        ? Loader2
        : status === 'error'
            ? AlertCircle
            : status === 'forbidden'
                ? ShieldOff
                : status === 'empty' && reason === 'projects-empty'
                    ? FolderOpen
                    : Building2

    return (
        <div className="flex min-h-[50vh] items-center justify-center" role="status">
            <div className="max-w-md rounded-lg border border-border/50 p-10 text-center text-muted-foreground">
                <Icon className={`mx-auto mb-3 h-12 w-12 text-muted-foreground/50 ${status === 'loading' ? 'animate-spin text-primary' : ''}`} />
                <p className="mb-4">{text}</p>
                {status === 'error' && onRetry ? (
                    <Button type="button" variant="outline" onClick={onRetry}>
                        {t('workspace.retry')}
                    </Button>
                ) : null}
                {status === 'empty' ? (
                    <Button asChild variant="outline">
                        <Link to={routes.settings.organizationsAndProjects()}>
                            {t('settings-page.organizations-and-projects')}
                        </Link>
                    </Button>
                ) : null}
            </div>
        </div>
    )
}
