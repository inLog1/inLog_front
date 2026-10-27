# Baseline перед этапом 1

Снято 26 октября 2026 с рабочего дерева до правок этапа 1. Исторический audit (`baseline/`, master `c88fbde`, 1 августа, проверен 25 октября) — только ориентир.

## Git

- Ветка на момент старта: `refactor/corporate-concept`, совпадала с `master`.
- HEAD: `a468f7c8d4297b5b5b3f17a160536d4cf4fe9057` (1 октября 2026, merge PR #1 `feature/admin`).
- `c88fbde` является предком HEAD. Между ними 7 коммитов: разделение user/admin shell, правки sidebar/header, admin panel, railway build.
- Рабочая копия до этапа: неотслеживаемые материалы миграции (`.cursor/`, `docs/`, `design/`, `prompts/`, `baseline/`, `START-IN-CURSOR.txt`, `README copy.md`, `references.md`). Сброса и чужих commit не было.
- Для этапа создана ветка `migration/stage-01-auth` от этого HEAD. Commit/push не выполнялись.
- `node_modules` отсутствовал. Установка: `npm ci --ignore-scripts --no-audit --no-fund` (exit 0, peer warnings Excalidraw/React 19, как в историческом audit).

## Проверки текущей версии

- `npm run build` (`tsc -b && vite build`): успешно, Vite 7.3.6, около 50.7 с. Крупнейший JS chunk около 7.91 MB minified / 2.44 MB gzip. Предупреждение Rollup о размере chunk.
- `npm run lint`: exit 1, **157 замечаний: 128 ошибок, 29 предупреждений**. Исторический ориентир был 131/31 (162). Массово не исправлялось.
- Частые правила в этом прогоне: `no-explicit-any`, `react-hooks/exhaustive-deps`, `react-refresh/only-export-components`, `react-hooks/preserve-manual-memoization` в `RootLayout`, `no-unused-vars`.
- Скрипта `test` и целевых test-файлов нет.

## Расхождения с историческим audit

| Наблюдение audit | Текущий HEAD |
|---|---|
| `localStorage.clear()` в sidebar | Вызов в `widgets/header/ui/UserMenu.tsx` после успешного logout. Sidebar его не вызывает. Доска, тема и прочие ключи по-прежнему стираются этим путём |
| Сессия: токен в `ProtectedRoute`, verify+getMe в `RootLayout`, селектор `getMe` смотрит в `authApi` | Сохранилось. `getMe` живёт в `userApi`. Плюс layout ждёт организации и проекты первой организации |
| 401 любого запроса в `clientApi` ведёт на login и toast «сессия истекла» | Сохранилось. Отдельной политики login/private нет |
| Logout чистит только access token и только `userApi` при успехе API | Mutation снимает access token при успехе. `UserMenu` затем делает `localStorage.clear()` и не чистит refresh и остальные API при ошибке logout |
| `platform-role` admin/super_admin открывает admin shell | Сохранилось: `AdminRoute` и `isPlatformAdmin(user.role)`. Это не модель произвольных grants |
| WebSocket уведомлений ходит на реальный backend | Сохранилось, reconnect 5 с |
| Восемь отдельных RTK API | Сохранились: auth, user, organization, project, task, admin, platformAdmin, notification |

## Карта маршрутов (актуальная)

Публичные: `/login`, `/register`, `/check-email`, `/email-confirmation`, `/recovery`, `/recovery-message`.

Защита `ProtectedRoute` — наличие ключа `token` в localStorage. Нет токена: toast session-expired и переход на `/login`.

Под `RootLayout` (`/`):

- `/` — текущий dashboard
- `/scheduler`, `/scheduler/tasks`, `/scheduler/templates`, `/scheduler/statuses`, `/scheduler/roadmap`
- `/admin/constructor`, `/admin/reports` — внутри user shell, без `AdminRoute`
- `/admin` и `/admin/users|members|organizations-and-projects|tasks` — за `AdminRoute` (`user.role` admin или super_admin)
- `/admin/organizations` и `/admin/projects` редиректят на `/admin/organizations-and-projects`
- `/settings/profile`, `/settings/organizations-and-projects`, `/settings`, `/settings/notifications`
- `/geo-mechanics`

Не найдено отдельных route-страниц для `/forgot-password`, `/recover`, `/recovery-change`, `/change-email`, social verify, хотя ключи есть в `routes.ts`.

## Потребители токена

Ключи: `token` (`ACCESS_TOKEN`), `refresh_token` (`REFRESH_TOKEN`). Значение пишется через `JSON.stringify`.

| Место | Как использует |
|---|---|
| `shared/api/clientApi.ts` | Bearer; при 401 удаляет `token` и делает `location.replace('/login')` |
| `features/auth/model/authSlice.ts` | login пишет оба ключа; logout удаляет `token` только после успеха |
| `app/routing/AppRouter.tsx` | `ProtectedRoute` смотрит только `token` |
| `widgets/root-layout/index.tsx` | verify `auth/token/verify/`, skip `getMe` без ключа |
| `entities/user/model/selectors.ts` | `selectIsAuthenticatedAlternative` читает `token` |
| `entities/notification/model/use-notifications-websocket.ts` | JSON.parse токена и живой WebSocket |
| `widgets/header/ui/UserMenu.tsx` | `localStorage.clear()` после logout |

Доска: `inlog-whiteboard:` + `task-${projectId}-${taskSlug}` без пользователя. Тема и язык — отдельные ключи (`theme` у next-themes, `app-language`, `i18nextLng`, `inlog.sidebar-collapsed`).

## Контракты, которые этап 1 обязан сохранить

- `POST auth/login/` — body `{ email, password }`, ответ `{ access_token, refresh_token, user }`
- `POST auth/token/verify/` — body `{ token }`
- `POST auth/logout/`
- `GET users/me/`
- `GET organizations/organization/`
- `GET projects/project/?organization=`

Новых production endpoints на backend этим этапом нет.
