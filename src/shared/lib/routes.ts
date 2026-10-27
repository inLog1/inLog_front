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
    mockProvider: () => '/auth/mock-provider',
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

    forms: {
      list: () => '/forms',
      editor: (formId: string) => `/forms/${formId}`,
      fill: (formId: string) => `/forms/${formId}/fill`,
      records: (formId: string) => `/forms/${formId}/records`,
      record: (formId: string, recordId: string) => `/forms/${formId}/records/${recordId}`,
      views: (formId: string) => `/forms/${formId}/views`,
      viewCreate: (formId: string) => `/forms/${formId}/views/new`,
      view: (formId: string, viewId: string) => `/forms/${formId}/views/${viewId}`,
      viewEdit: (formId: string, viewId: string) => `/forms/${formId}/views/${viewId}/edit`,
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
      access: () => '/settings/access',
      accessRoleNew: () => '/settings/access/roles/new',
      accessRole: (roleId: string) => `/settings/access/roles/${roleId}`,
      sections: () => '/settings/sections',
      sectionNew: () => '/settings/sections/new',
      section: (sectionId: string) => `/settings/sections/${sectionId}`,
      sectionPreview: (sectionId: string) => `/settings/sections/${sectionId}/preview`,
    },

    workspaceSection: (sectionId: string) => `/workspace/sections/${sectionId}`,

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