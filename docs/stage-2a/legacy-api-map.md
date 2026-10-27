# Карта существующих API

Снимок вызовов из присланных исходников. Это инвентаризация клиента, а не подтверждение поведения сервера. Соседние types.ts и shared/types/dto определяют DTO. Cursor обязан прочитать целиком query/mutation и потребителей перед реализацией.

Задачи: список содержит count/next/previous/results. Конструктор: get-combined-constructor-data возвращает AdminPanelReport[], затем клиент преобразует ответ. Не возвращать из handler уже преобразованную таблицу. Начальные auth/org/project endpoints сохраняются.

## src/entities/admin/model/adminSlice.ts

```ts
getAdminPanelNodes: builder.query<AdminPanelNode[], { organizationId: number }>({
query: ({ organizationId }) => `organizations/${organizationId}/structure-element-group/`,
getAdminPanelNodeById: builder.query<AdminPanelNode, { organizationId: number, nodeId: number }>({
query: ({ organizationId, nodeId }) => `organizations/${organizationId}/structure-element-group/${nodeId}/`,
addAdminPanelNode: builder.mutation<AdminPanelNode, { organizationId: number, body: AdminPanelNodeRequest }>({
url: `organizations/${organizationId}/structure-element-group/`,
method: 'POST',
updateAdminPanelNode: builder.mutation<AdminPanelNode, { organizationId: number, nodeId: number, body: AdminPanelNodeRequest }>({
url: `organizations/${organizationId}/structure-element-group/${nodeId}/`,
method: 'PATCH',
deleteAdminPanelNode: builder.mutation<void, { organizationId: number, nodeId: number }>({
url: `organizations/${organizationId}/structure-element-group/${nodeId}/`,
method: 'DELETE',
getAdminPanelNodeTabs: builder.query<AdminPanelNodeTab[], { organizationId: number }>({
query: ({ organizationId }) => `organizations/${organizationId}/structure-element/`,
addAdminPanelNodeTab: builder.mutation<AdminPanelNodeTab, { organizationId: number, body: AdminPanelNodeTab  }>({
url: `organizations/${organizationId}/structure-element/`,
method: 'POST',
updateAdminPanelNodeTab: builder.mutation<AdminPanelNodeTab, { organizationId: number, body: {
url: `organizations/${organizationId}/structure-element/multiple-update/`,
method: 'PATCH',
deleteAdminPanelNodeTab: builder.mutation<void, { organizationId: number, tabId: number }>({
url: `organizations/${organizationId}/structure-element/${tabId}/`,
method: 'DELETE',
getAdminPanelGroups: builder.query<AdminPanelGroup[], { group?: number, structure_element?: number, organizationId?: number }>({
url: `organizations/${organizationId}/structure-element-field/`,
addAdminPanelGroup: builder.mutation<AdminPanelGroup, { organizationId: number, body: AdminPanelGroupRequest }>({
url: `organizations/${organizationId}/structure-element-field/`,
method: 'POST',
updateAdminPanelGroup: builder.mutation<AdminPanelGroup, { organizationId: number, groupId: number, body: AdminPanelGroupRequest }>({
url: `organizations/${organizationId}/structure-element-field/${groupId}/`,
method: 'PATCH',
deleteAdminPanelGroup: builder.mutation<void, { organizationId: number, groupId: number }>({
url: `organizations/${organizationId}/structure-element-field/${groupId}/`,
method: 'DELETE',
generateReport: builder.mutation<AdminPanelReportTable, { organizationId: number, body: AdminPanelReportRequest[] }>({
url: `organizations/${organizationId}/get-combined-constructor-data/`,
method: 'POST',
addAdminPanelRow:builder.mutation<AdminPanelReport, { organizationId: number, body: AdminPanelRowRequest }>({
url: `organizations/${organizationId}/structure-element-object/`,
method: 'POST',
updateAdminPanelRow: builder.mutation<AdminPanelReport, { organizationId: number, rowId: number, body: AdminPanelRowRequest }>({
url: `organizations/${organizationId}/structure-element-object/${rowId}/`,
method: 'PATCH',
deleteAdminPanelRow: builder.mutation<void, { organizationId: number, rowId: number }>({
url: `organizations/${organizationId}/structure-element-object/${rowId}/`,
method: 'DELETE',
```

## src/entities/task/model/taskSlice.ts

```ts
getTasks: builder.query<{
url: `projects/${projectId}/tasks/task/`,
getTask: builder.query<Task, { projectId: number; taskSlug: string }>({
url: `projects/${projectId}/tasks/task/${taskSlug}/`,
getTaskByParams: builder.mutation<{
url: `projects/${projectId}/tasks/task/`,
updateTask: builder.mutation<Task, { projectId: number; taskSlug: string; data: { id?: number, parent?: number } & Partial<TaskUpdate> }>({
url: `projects/${projectId}/tasks/task/${taskSlug}/`,
method: 'PATCH',
AddTaskDoer: builder.mutation<Task, { projectId: number; taskSlug: string; data: { user: number } }>({
url: `projects/${projectId}/tasks/task/${taskSlug}/doer/`,
method: 'POST',
deleteTaskDoer: builder.mutation<Task, { projectId: number; taskSlug: string, doerId: number }>({
url: `projects/${projectId}/tasks/task/${taskSlug}/doer/${doerId}/`,
method: 'DELETE',
AddTaskSupervisor: builder.mutation<Task, { projectId: number; taskSlug: string; data: { user: number } }>({
url: `projects/${projectId}/tasks/task/${taskSlug}/supervisor/`,
method: 'POST',
deleteTaskSupervisor: builder.mutation<Task, { projectId: number; taskSlug: string, supervisorId: number }>({
url: `projects/${projectId}/tasks/task/${taskSlug}/supervisor/${supervisorId}/`,
method: 'DELETE',
createTask: builder.mutation<Task, { projectId: number; data: Pick<TaskCreate, 'name'> & Partial<Omit<TaskCreate, 'name'>> }>({
url: `projects/${projectId}/tasks/task/`,
method: 'POST',
deleteTask: builder.mutation<void, { projectId: number; taskSlug: string }>({
url: `projects/${projectId}/tasks/task/${taskSlug}/`,
method: 'DELETE',
getStatuses: builder.query<Status[], { projectId: number }>({
query: ({ projectId }) => `projects/${projectId}/tasks/status/`,
getTaskTags: builder.query<TagsResponse, { projectId: number, limit?: number, is_orphan?: boolean }>({
query: ({ projectId, limit, is_orphan }) => `projects/${projectId}/tasks/tag/?limit=${limit}&is_orphan=${is_orphan}`,
addTaskTag: builder.mutation<Task, { projectId: number, data: { name: string } }>({
url: `projects/${projectId}/tasks/tag/`,
method: 'POST',
addTaskComment: builder.mutation<Comment, { projectId: number, taskSlug: string, data: { text: string } }>({
url: `projects/${projectId}/tasks/task/${taskSlug}/comment/`,
method: 'POST',
editTaskComment: builder.mutation<Comment, { projectId: number, taskSlug: string, commentId: number, data: { text: string } }>({
url: `projects/${projectId}/tasks/task/${taskSlug}/comment/${commentId}/`,
method: 'PATCH',
deleteTaskComment: builder.mutation<void, { projectId: number, taskSlug: string, commentId: number }>({
url: `projects/${projectId}/tasks/task/${taskSlug}/comment/${commentId}/`,
method: 'DELETE',
createTaskFile: builder.mutation<Task['files'][number], { projectId: number, taskSlug: string, file: File }>({
url: `projects/${projectId}/tasks/task/${taskSlug}/file/`,
method: 'POST',
deleteTaskFile: builder.mutation<void, { projectId: number, taskSlug: string, fileId: number }>({
url: `projects/${projectId}/tasks/task/${taskSlug}/file/${fileId}/`,
method: 'DELETE',
```

## src/entities/project/model/projectSlice.ts

```ts
getProjects: builder.query<Project[], { organization?: number | string }>({
url: 'projects/project/',
addProject: builder.mutation<Project, Partial<ProjectRequest>>({
url: 'projects/project/',
method: 'POST',
getProjectById: builder.query<Project, number>({
query: (id) => `projects/project/${id}/`,
updateProject: builder.mutation<Project, { id: number; data: Partial<Project> }>({
url: `projects/project/${id}/`,
method: 'PATCH',
deleteProject: builder.mutation<void, number>({
url: `projects/project/${id}/`,
method: 'DELETE',
getProjectMembers: builder.query<MemberResponse[], number>({
query: (id) => `projects/${id}/members/`,
```

## src/entities/organization/model/organizationSlice.ts

```ts
getOrganizations: builder.query<Organization[], void>({
query: () => 'organizations/organization/',
addOrganization: builder.mutation<OrganizationResponse, Partial<OrganizationRequest>>({
url: 'organizations/organization/',
method: 'POST',
deleteOrganization: builder.mutation<void, number>({
url: `organizations/organization/${id}/`,
method: 'DELETE',
```

## src/entities/notification/model/notificationSlice.ts

```ts
getNotifications: builder.query<Notification[], void>({
query: () => '/notifications/notification/',
updateNotification: builder.mutation<
url: `/notifications/notification/${id}/`,
method: 'PATCH',
deleteNotification: builder.mutation<void, number>({
url: `/notifications/notification/${id}/`,
method: 'DELETE',
invitationResponse: builder.mutation<
url: `projects/${projectId}/user-invitation/response/`,
method: 'POST',
```

## src/entities/user/model/userSlice.ts

```ts
getMe: builder.query<User, void>({
query: () => 'users/me/',
updateMe: builder.mutation<User, FormData | UserUpdateRequest>({
url: 'users/me/',
method: 'PATCH',
getUserSettings: builder.query<UserSettings, void>({
query: () => 'users/me/settings/',
updateUserSettings: builder.mutation<UserSettings, UserSettingsUpdateRequest>({
url: 'users/me/settings/',
method: 'PATCH',
socialLogin: builder.mutation<
url: `users/social-auth/${socialName}/login/`,
method: 'PATCH',
getRecentParticipants: builder.query<User[], void>({
query: () => 'users/recent-participants/',
getInvitationList: builder.query<User[], number>({
query: (projectId) => `projects/${projectId}/user-invitation/`,
changeRole: builder.mutation<
url: `projects/${projectId}/members/${memberId}/`,
method: 'PATCH',
closeRoleAccess: builder.mutation<void, { projectId: number; memberId: number }>({
url: `projects/${projectId}/members/${memberId}/`,
method: 'DELETE',
changeRoleByUser: builder.mutation<
url: `projects/${projectId}/role-request/`,
method: 'POST',
changeRoleAdminResponse: builder.mutation<
url: `projects/${projectId}/role-request/response/`,
method: 'POST',
getUserDocuments: builder.query<UserFile[], void>({
query: () => 'users/me/documents/',
addUserDocument: builder.mutation<UserFile, FormData>({
url: 'users/me/documents/',
method: 'POST',
deleteUserDocument: builder.mutation<void, number>({
url: `users/me/documents/${id}/`,
method: 'DELETE',
```

## Обязательная инвентаризация зависимостей

Проверить members, settings, статусы/теги, meta и уведомления по реальным вызовам экранов; расширить карту. Не путать общий platform-admin API с лабораторным конструктором. Неизвестные endpoints оставлять 501 и перечислять. Удалённые файлы и экспорт отчётов реализовывать только при заявлении готовности соответствующего действия.
