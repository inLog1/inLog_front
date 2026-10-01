// src/shared/lib/routes.ts
export const routes = {
    // публичные
    login: () => '/login',
    register: () => '/register',
    forgotPassword: () => '/forgot-password',
    passwordRecovery: () => '/recovery',
    recoveryMessage: () => '/recovery-message',
    resetConfirm: () => '/recover',
    recoveryChange: () => '/recovery-change',
    checkEmail: () => '/check-email',
    changeEmail: () => '/change-email',
    emailConfirmation: () => '/email-confirmation',
    verifyGoogle: () => '/verify-google-account',
    verifySlack: () => '/verify-slack-account',
    verifyYandex: () => '/verify-yandex-account',
    verifyMicrosoft: () => '/verify-microsoft-account',
  
    // защищённые
    dashboard: () => '/',

    organizations: {
      new: () => '/new-organization',
      list: () => '/organizations',
      detail: (id: string | number) => `/organizations/${id}`,
    },

    projects: {
      new: () => '/new-project',
      list: () => '/projects',
    },

    scheduler: {
      list: () => '/scheduler',
      tasks: () => '/scheduler/tasks',
      task: (slug: string) => `/scheduler/tasks/${slug}`,
      templates: () => '/scheduler/templates',
      statuses: () => '/scheduler/statuses',
      roadmap: () => '/scheduler/roadmap',
    },

    admin: {
      list: () => '/admin',
      users: () => '/admin/users',
      members: () => '/admin/members',
      organizations: () => '/admin/organizations',
      projects: () => '/admin/projects',
      organizationsAndProjects: () => '/admin/organizations-and-projects',
      tasks: () => '/admin/tasks',
      constructor: () => '/admin/constructor',
      reports: () => '/admin/reports',
    },

    settings: {
      list: () => '/settings',
      profile: () => '/settings/profile',
      organizationsAndProjects: () => '/settings/organizations-and-projects',
      notifications: () => '/settings/notifications',
    },

    geoMechanics: {
      list: () => '/geo-mechanics',
    },

    // 404
    notFound: () => '*',
  } as const;

  const platformConsolePaths = [
    routes.admin.users(),
    routes.admin.members(),
    routes.admin.organizations(),
    routes.admin.projects(),
    routes.admin.organizationsAndProjects(),
    routes.admin.tasks(),
  ]

  export function isPlatformConsolePath(pathname: string) {
    if (pathname === routes.admin.list()) return true
    return platformConsolePaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    )
  }
  
  // Тип для автодополнения (опционально, но очень полезно)
  export type RouteKeys = typeof routes;