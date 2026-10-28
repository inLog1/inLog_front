# Отчёт: организации и проекты

## Причина зависимости от первой организации

Раньше корпорация подтверждалась только через уже созданные организации и проекты, а экран управления был привязан к рабочему списку и скрытому пункту навигации. Первичная настройка уже записывает отдельную `installationCorporationId` и capability владельца без фиктивной организации. Этот этап использует ту же идентичность: справочник и создание сверяют её с `state.corporation.id` и не принимают корпорацию из URL или тела.

## Что переиспользовано

Маршрут `organizationsAndProjects` и пункт реестра `organizations-settings`. Экран `OrganizationsAndProjects`, диалоги создания, карточки и селекторы shell. Каталог разрешений и редактор ролей. `can` / `canDelegate`, сессия, `blocked`, writer lock и `commit`. Существующие POST создания и рабочие GET. `useUnsavedSource` в диалогах. Семантические токены, `Button`, `Input` и иконки, уже принятые в shell. Общая обработка ошибок дополнена кодами этого контракта, без нового канала сообщений.

## Семантика

Шесть независимых кодов перечислены в `permissions.md`. Новые строки каталога: `organizations.read`, `organizations.update`, `projects.update`. `projects.read` и оба create уже были. Миграция не дописывает их в сохранённые роли. Схема mock остаётся 9, чтобы не сдвигать уже принятую версию; отсутствующая revision при чтении старой записи становится 1, в каталог grants добавляются только новые id.

## Совместимость рабочего контекста

`listOrganizations` не сужен до `organizations.read`. Селекторы сотрудников с рабочими grant сохраняются. Управленческий справочник отдаёт полные реквизиты отдельно. Фильтр `directoryOrg` не записывает рабочий `org`. Формы остаются доступными без проекта, задачи без проекта не создаются. Создание не раздаёт membership. Демонстрация и личная установка, namespace сессии и доска не менялись. Удаление и архивирование не входят в этап. Совмещение «Лаборатория / Заказчик» не добавлялось.

## Изменённые файлы

Изменены: `docs/first-run/model.md`, `src/app/home/HomePage.tsx`, `src/app/mocks/auth/handlers.ts`, `src/app/mocks/db/migrate.ts`, `src/app/mocks/db/organization-grants.ts`, `src/app/mocks/db/seed.ts`, `src/app/mocks/db/types.ts`, `src/app/mocks/installation/service.ts`, `src/app/navigation/catalog.ts`, `src/app/navigation/catalog.test.ts`, `src/app/shell/AppShell.tsx`, `src/entities/access/model/permission-catalog.ts`, `src/entities/organization/model/organizationSlice.ts`, `src/entities/project/model/projectSlice.ts`, `src/features/access-management/ui/RoleEditor.tsx`, диалоги создания и `OrganizationsAndProjects.tsx`, `src/features/tasks/model/compose-task.ts`, `src/pages/app/access/ui/AccessPage.tsx`, страница `ogranizations-and-projects/index.tsx`, `en.json`, `ru.json`, `src/shared/lib/errors-handler.ts`.

Добавлены: `src/app/mocks/organizations/service.ts`, `service.test.ts`, `src/entities/organization/model/directory.ts`, `src/features/organizations-and-projects/model/directory-focus.ts`, `directory-focus.test.ts`, `EditOrganizationDialog.tsx`, `EditProjectDialog.tsx`, документы в `docs/organizations-projects/`.

## Команды

До правок этого этапа: `npm test` — 44 файла, 200 тестов, все прошли. Отдельный lint и build до правок заново не снимались; исторический lint репозитория красный.

После реализации: `npm test` — 46 файлов, 212 тестов, все прошли. В том числе владелец при нуле организаций, разделение справочника и рабочего списка, create без чтения чужих объектов, update отдельно от read, изоляция лабораторий, project-scoped минимум, поддельные id и перенос связи, stale write, blocked, имя роли, переименование без смены id задач и форм, миграция без дописки ролей, задача без проекта, writer lock.

`npx tsc -b --pretty false` — код 0. `npm run build` (`tsc -b && vite build --mode mock`) — `built in 51.30s`. `npm run build:live` (`tsc -b && vite build`) — `built in 45.27s`, код 0. Предупреждение Vite о крупных чанках прежнее, к этому этапу не относится.

`npm run lint` — код 1, 148 проблем (122 ошибки, 26 предупреждений). Новые файлы этапа в отчёте lint не появились. Совпадения в `organizationSlice.ts`, `projectSlice.ts` и `errors-handler.ts` — прежний `no-explicit-any` на уже существовавших строках (`transformResponse`, `getProjectMembers`). Этот долг не исправлялся.

## Браузер

Проверен существующий mock на `localhost:5173` без сброса базы. Подробности и список непройденных шагов — в `manual-check.md`. Чистая установка в браузере не проходилась: она покрыта тестом сервиса.

## Ограничения

Mock хранит справочник и PATCH. Live эти запросы не отправляет и не показывает редактирование. Live-создание идёт в прежний POST и считается успешным только после ответа backend. Live-список остаётся рабочим GET: отфильтровать его по новым управленческим правам без backend нельзя. `updateProject` в slice, который шлёт частичный PATCH без revision, экраном не вызывается; экран использует `reviseProject` с `expectedRevision`.

Не проверялось: браузерный проход нулевой установки, выдача роли через UI, прямой запрос к чужому объекту из браузера, открытие форм и создание задачи при выбранном проекте.
