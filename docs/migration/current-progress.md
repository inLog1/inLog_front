# Результат этапа 1

Отчёт обновлён 26 октября 2026 после повторной проверки этапа 1. Новая главная и этап 2 не начинались. Следующий промпт должен читать этот файл и текущие исходники.

## 1. Версия проекта

- Пакет: `inlog` `0.0.0` (`package.json`).
- Ветка: `migration/stage-01-auth`.
- HEAD: `a468f7c8d4297b5b5b3f17a160536d4cf4fe9057` (1 октября 2026, `Merge pull request #1 from inLog1/feature/admin`).
- Ветка указывает на тот же commit, что и `master`. Отдельного commit этапа нет. Push не выполнялся.
- Незакоммиченные изменения есть. Изменены файлы этапа в уже отслеживаемых путях. Добавлены неотслеживаемые каталоги кода, мок-worker, тесты и материалы миграции (`.cursor/`, `docs/`, `design/`, `prompts/`, `baseline/` и соседние заметки). `.env` не менялся.

## 2. Реализованные возможности

| Возможность | Статус |
|---|---|
| Экран входа | готово |
| Локальная авторизация и симуляция SSO | готово |
| Восстановление сессии после обновления страницы | готово |
| Выход и переключение пользователей | готово |
| Тестовые аккаунты и панель тестирования | готово |
| Сохранение и сброс мок-данных | готово |

Экран входа собран отдельно от старого фона: почта, пароль, показ пароля, корпоративная кнопка, язык и тема. Публичная регистрация на `/register` заменена объяснением, что она закрыта; файл `RegisterForm` на диске остаётся. Маршруты восстановления и подтверждения почты на месте.

Локальный вход идёт через существующий `POST auth/login/`. Симуляция SSO есть только в mock: страница `/auth/mock-provider`, выбор вымышленной личности, без поля корпоративного пароля. В live пустой адрес провайдера не подменяется тестовой личностью.

Сессия после обновления проверяется в `SessionProvider`: установка, `token/verify`, `users/me`, в mock ещё `session/access`. Выход чистит сессию текущего режима, черновики `inlog:session-draft:` и кэши зарегистрированных API, останавливает websocket. Смена пользователя идёт через тот же выход и новый bootstrap. Панель «Тестирование» и страница провайдера попадают в граф только при `VITE_API_MODE=mock`.

Шесть фикстур лежат в сиде. Назначения хранятся в IndexedDB и не засеваются заново при повторном открытии. Reset спрашивает подтверждение и заново создаёт только свой namespace.

Не входят в «готово» этапа и не начаты: новая главная, мастер первичной настройки, редактор ролей, полные моки конструктора, задач и отчётов, настоящие OIDC/SAML и 1С.

## 3. Изменённые файлы

Изменены отслеживаемые файлы:

- `package.json`, `package-lock.json` — скрипты `dev:mock` и `test`, зависимости MSW, Vitest и fake-indexeddb.
- `.env.example` — описание `VITE_API_MODE`, `VITE_AUTH_MODE`, live API и необязательного SSO start URL. Секрета провайдера там нет.
- `src/app/main.tsx` — ожидание MSW до render в mock и снятие своего worker в live.
- `src/app/routing/AppRouter.tsx` — session bootstrap вокруг прежних маршрутов; mock-провайдер и панель только в mock-сборке.
- `src/app/store/store.ts` — регистрация session/access API.
- `src/shared/api/clientApi.ts` — токен через session-adapter и разная реакция на 401 логина и защищённого запроса.
- `src/features/auth/model/authSlice.ts` — запись сессии через adapter.
- `src/features/auth/ui/LoginForm.tsx`, `SignHeader.tsx`, `AuthLangPanel.tsx` — новая форма и режимы local/sso/mixed.
- `src/pages/auth/login/index.tsx`, `register/index.tsx` — композиция входа и закрытая регистрация.
- `src/widgets/auth-layout/ui/AuthLayout.tsx` — верхняя панель языка и темы.
- `src/widgets/root-layout/index.tsx` — оболочка больше не владеет первичным verify.
- `src/widgets/header/ui/UserMenu.tsx` — выход через общий logout; `localStorage.clear()` удалён.
- `src/widgets/sidebar/index.tsx` — тот же логотип через `AppLogo`, прежние пункты меню сохранены.
- `src/entities/user/model/selectors.ts`, `src/entities/notification/model/use-notifications-websocket.ts` — чтение токена через adapter; в mock websocket не открывается.
- `src/features/whiteboard/model/use-whiteboard-storage.ts` — ключ сцены дополняется id субъекта. Старый ключ без суффикса не читается и не удаляется. Отложенная запись пропускается, если subject сменился до таймера.
- `src/shared/i18n/locales/ru.json`, `en.json`, `src/shared/styles/index.css`, `src/shared/lib/routes.ts` — тексты, стили входа и путь mock-провайдера.

Добавлены: `.env.mock`, `public/mockServiceWorker.js`, `public/images/login-scheme.webp`, `vitest.config.ts`, `src/app/mocks/**`, `src/app/session/**`, `src/app/store/api-registry.ts`, `src/entities/access/**`, `src/entities/session/**`, `src/entities/notification/model/socket-control.ts`, `src/features/auth/model/sso.ts`, `ssoApi.ts`, `sso.test.ts`, `src/features/auth/ui/AuthThemeMenu.tsx`, `src/features/dev-testing/**`, `src/pages/auth/mock-provider/**`, `src/shared/api/endpoint-policy.ts`, `platformApi.ts`, `return-to.ts`, `session-events.ts`, `session-storage.ts`, `session-guards.test.ts`, `src/shared/config/runtime.ts`, `vite-env.d.ts`, `src/shared/ui/app-logo.tsx`, `src/widgets/auth-layout/ui/AuthTopBar.tsx`, `LoginStage.tsx`.

Материалы `.cursor/`, `docs/migration/01–10`, `design/`, `prompts/`, `baseline/` лежат в дереве и не коммитились.

### Конструктор, задачи, отчёты, доска и их API

Исходники и маршруты конструктора, задач, отчётов, профиля, уведомлений и геомеханики сохранены: `/`, `/scheduler` и вложенные tasks/templates/statuses/roadmap, `/admin/constructor`, `/admin/reports`, `/admin/*` за `AdminRoute`, `/settings/profile`, `/settings/notifications`, `/geo-mechanics`, `/register`, `/check-email`, `/email-confirmation`, `/recovery`, `/recovery-message`.

API этих доменов не переписывались. Единственное изменение рядом с доской — суффикс пользователя в ключе localStorage. Handlers задач, конструктора, отчётов, уведомлений и platform-admin не добавлялись.

## 4. Архитектура

- Session bootstrap: `src/app/main.tsx` ждёт worker, `src/app/session/SessionProvider.tsx` проверяет установку и токен, `src/app/session/RequireWorkspace.tsx` и `SessionScreens.tsx` держат защищённый UI закрытым до результата. Выход — `src/app/session/perform-logout.ts`.
- Permissions: `src/entities/access` (`grants.ts`, `accessApi.ts`). `can()` смотрит resource, action и scope. `corporate_superadmin` — отдельная запись полномочия у владельца фикстуры. Название роли такое полномочие не выдаёт. Старый `AdminRoute` по-прежнему смотрит на `user.role`.
- Mock handlers: `src/app/mocks/handlers.ts`, worker — `src/app/mocks/browser.ts`.
- Mock-хранилище: `src/app/mocks/db/repository.ts`, сид `seed.ts`. IndexedDB `inlog:mock:corporate-v2`, `schemaVersion` 1, ключ записи `root`.

### Как включить режимы

- `apiMode`: `VITE_API_MODE=mock|live`. Для `npm run dev` по умолчанию live. Mock в разработке: `npm run dev:mock` (`vite --mode mock`, файл `.env.mock`). Пока `npm run build` тоже собирается с `--mode mock`: worker, мок-API и кнопка «Тестирование» попадают в бандл. На Railway `.dockerignore` не копирует `.env.mock`, а сервисная переменная `VITE_API_MODE=live` иначе перекрывает файл: сборка mock-режима принудительно вшивает `mock` и `mixed`. Живая прод-сборка без мока — `npm run build:live`. Mock ходит на `/mock-api/` и не подставляет `VITE_API_BASE_URL`.
- `authMode`: `local|sso|mixed`. В live это `VITE_AUTH_MODE`, при пустом значении — `local`. В mock начальный сид — `mixed`; панель меняет режим только в mock-базе и завершает текущую сессию.
- Live SSO — переход на `VITE_SSO_START_URL`, если адрес задан. Пустой адрес показывает, что провайдер не настроен.

### Разделение mock и live

Adapter: `src/shared/api/session-storage.ts`.

- Live: `token`, `refresh_token`, `inlog:live:session:subject`.
- Mock: `inlog:mock:session:access`, `inlog:mock:session:refresh`, `inlog:mock:session:subject`.
- Черновики: префикс `inlog:session-draft:`.
- Доска: `inlog-whiteboard:${storageKey}:u${subjectId}`.
- Git-ветка хранилище браузера не изолирует. Logout не равен reset. Токены live в mock не копируются.

### Контракты

Существующие, формы сохранены и есть mock-handlers:

- `POST auth/login/`
- `POST auth/token/verify/`
- `POST auth/logout/`
- `GET users/me/`
- `GET organizations/organization/`
- `GET projects/project/?organization=`

Предложенные, только mock, это не production API:

- `GET authentication/capabilities/`
- `GET installation/status/`
- `GET session/access/`
- `GET auth/mock-sso/identities/`, `POST auth/mock-sso/complete/`, `POST auth/mock-sso/cancel/`
- `GET mock/test-resource/`, `POST mock/test-assignments/`
- `GET auth/dev/accounts/`, `POST auth/dev/switch/`, `POST auth/dev/settings/`, `POST auth/dev/reset/`

Live-сборка эти dev-вызовы не регистрирует. В live-`dist` строки `auth/mock-sso/complete/` и `auth/dev/switch/` остаются только в списке credential-endpoints политики 401. Непокрытый `/mock-api/*` отвечает `501` и `mock_coverage_gap`.

## 5. Результаты проверок

Команды повторного прогона, 26 октября 2026, уже с исправлениями этой проверки:

- `npm test` — Vitest 3.2.7, 6 файлов, 17 тестов, все прошли, около 2.3 с.
- `npm run build` (`tsc -b && vite build`) — exit 0, Vite 7.3.6, около 50 с. Крупнейший chunk около 7.91 MB / 2.45 MB gzip. Предупреждение Rollup о размере chunk остаётся.
- `npm run lint` в этом проходе не повторялся. Предыдущий прогон этапа: exit 1, 150 замечаний (123 ошибки, 27 предупреждений). Исходный снимок до этапа — в `docs/migration/current-baseline.md`: 157 (128 ошибок, 29 предупреждений).

### Что исправлено по результатам проверки

- Узкий login. На 320 px колонка формы была шире экрана: у grid-элемента срабатывал min-content длинной подписи SSO. У сетки, колонки и карточки стоит `min-w-0`, кнопка SSO переносит текст.
- Поздний `auth/dev/switch`. Два быстрых перехода оставляли сессию первого пользователя, потому что его ответ записывал токен уже после второго. Теперь номер перехода растёт на каждый клик; старый ответ не пишет сессию и не запускает новый bootstrap.
- Поздний bootstrap. Выход увеличивает generation сессии. После каждого ожидания bootstrap сверяет generation и токен и не записывает subject и `setAuthenticated`, если сессия уже сменилась. `beginBootstrap` обнуляет `subjectId`, пока идёт загрузка.
- Поздний ответ API. `baseQuery` сравнивает токен до запроса и после. Если токен сменился, ответ не попадает в кэш и не вызывает logout, в том числе запоздалый 401.
- Экран ошибки сессии. И «Сеть», и 5xx показывали текст про сеть. Для `error === 'server'` теперь текст «Сервис временно недоступен. Повторите попытку.»
- Отложенное сохранение доски. Если subject успел смениться до таймера, запись в ключ нового пользователя не выполняется.

### Что проверено вручную

Mock-сервер `npm run dev:mock`, `http://127.0.0.1:5173/`. После панели режим оставлен `mixed`, установка `ready`, fault снят, заблокированных фикстур нет. Пробный ключ доски, созданный только для проверки, удалён. Прежние ключи доски на месте.

Login, горизонтальный overflow:

| Ширина | scrollWidth | Карточка | Заголовок слева | Обрезанные элементы |
|---|---|---|---|---|
| 320 | 320 | 16–304 | скрыт, ширина 0 | 0 |
| 390 | 390 | 16–374 | скрыт, ширина 0 | 0 |
| 1280 | 1280 | правый край 1184 | ширина 448 | 0 |
| 1440 | 1440 | правый край 1264 | ширина 448 | 0 |

На 320 кнопка SSO занимает две строки (высота 58) и остаётся внутри карточки. Сверка с `design/login.png`: слева заголовок и декор, справа почта, пароль и корпоративная кнопка. В этом браузере тема тёмная — это сохранённая настройка. Подпись поля — «Рабочая почта», как в `docs/migration/07-design-spec.md`. Нижняя строка макета в спецификации этапа не требуется и на экран не выведена.

### Что не проверялось

- Страницы конструктора, задач, отчётов, профиля, уведомлений, геомеханики, recovery и email как рабочие экраны.
- Покадровый кадр с фамилией предыдущего пользователя. Во время загрузки рабочая область закрыта, `subjectId` в store пустой; отдельная видеозапись кадра не делалась.
- Повреждённый токен, внешний `returnTo` и deep link в браузере. Для них есть только unit-тесты.
- Live-сборка в браузере и любой реальный backend.
- Доска как экран. Проверялись ключи и загрузчик, холст не открывался.
- Пиксельное совпадение с PNG: светлая тема макета в этом браузере не включалась.

## 6. Проверенные сценарии

Проверено в браузере на mock-сервере раньше и сохраняет силу:

- Вход формой под всеми шестью фикстурами. Установившиеся подписи: Власова (есть «Админка платформы»), Лебедев («Участник», кнопки админки нет), Соколова, Морозов, Орлова, затем экран «Доступ пока не назначен» у пользователя без назначений. Пароль в отчёт не входит; он записан в `docs/migration/09-mock-scenarios.md`.
- Неверный пароль для владельца: форма остаётся на `/login`, текст «Неверная почта или пароль.», ключей сессии нет.
- SSO-успех, отказ теневой личности того же email и отмена SSO.
- Обновление страницы под владельцем оставляет оболочку.
- Выход и следующий вход не оставляют предыдущую фамилию в установившемся экране.
- Выход удаляет mock-ключи сессии и оставляет тему, сайдбар и ключи доски.
- Reset только своего namespace; чужой namespace, доска, тема и пробный live-ключ не стирались.
- Наблюдавшиеся запросы шли на `/mock-api/`. Непокрытый `GET /mock-api/projects/1001/tasks/task/` вернул `501` и `mock_coverage_gap`.

Добавлено этой проверкой:

- Панель, 403: статус `403`, сессия сотрудника А осталась.
- Панель, «Сеть»: заголовок «Не удалось проверить сессию», текст про недоступную сеть, `error: network`. «Повторить» вернуло того же сотрудника А.
- Панель, 5xx: тот же заголовок и текст «Сервис временно недоступен. Повторите попытку.», `error: server`. Повтор тоже вернул сотрудника А.
- Панель, 401 на `auth/token/verify/`: `/login`, фаза anonymous, mock-ключи сессии пустые, виден текст «Сессия истекла».
- `local`: почта, пароль и «Войти», корпоративной кнопки нет. `sso`: только «Войти через корпоративный аккаунт», полей пароля нет. `mixed`: оба способа.
- «Нужна настройка» после подтверждения: «Требуется первичная настройка», ключей сессии нет. «Готовая установка» возвращает форму входа.
- «Блок» текущего сотрудника А: «Доступ заблокирован». «Снять блок» возвращает рабочий экран «Главная» и `accessState: ready`.
- Быстрый переход на Морозова при закрытой панели: на экране есть Морозов и нет подписей Соколовой и Власовой. Почта в кэше `employee.b@example.test`, subject `4`.
- Два перехода, пока ответ первого `auth/dev/switch` задержан: в кэше остаётся только второй пользователь. Почта владельца после второго перехода в кэш не попадала. Два клика в одном такте выпускают только последний запрос.
- Запрос организаций начат от одного пользователя и переход выполнен до ответа: установившийся профиль — новый пользователь. Список организаций предыдущего пользователя в кэше не появлялся. Пока фаза `loading`, `subjectId` в store равен `null`.
- Старые ключи доски `inlog-whiteboard:task-1-a`, `inlog-whiteboard:task-1-a:u1`, `inlog-whiteboard:task-9:u1` после переходов на месте. Загрузчик для ключа без суффикса вернул пустую сцену и не создал копию `:u${subjectId}`.

Автоматически, без браузера: прежние 15 тестов и два новых. Новые проверяют, что коммит разрешён только последнему переходу панели, и что новый bootstrap стирает subject предыдущей сессии. Остальные тесты по-прежнему покрывают пароль, SSO, pending/blocked, название роли, делегирование, namespace, reset, границы logout и return path.

## 7. Ограничения

Пока не работает как продукт:

- Настоящий корпоративный провайдер, 1С и проверка пароля вне inLog.
- Мастер первичной настройки. Экран «Требуется первичная настройка» открывается пресетом панели; самого мастера нет.
- Редактор ролей, произвольные назначения через UI и новое меню из grants.
- Новая главная. После входа открывается прежний dashboard.
- Старые разделы на моках: их запросы получают честный `501`, не пустой список и не боевой хост.
- `AdminRoute` и `isPlatformAdmin(user.role)`. У владельца фикстуры legacy-роль `super_admin`, поэтому старая консоль у него открывается. У администратора лаборатории legacy-роль `member`, консоль не открывается. Это не модель grants.

### Старые сцены доски

Ключ без владельца: `inlog-whiteboard:${storageKey}`. Новое сохранение: `inlog-whiteboard:${storageKey}:u${subjectId}`. Загрузчик читает только второй. Первый не удаляется и не копируется текущему пользователю: в старом ключе нет subject, автоматическая выдача сцены другому человеку была бы неверной.

Безопасное восстановление, отдельной задачей, не в этом этапе: показать владельцу установки список ключей без суффикса и дать явное действие «прикрепить эту сцену ко мне» либо выгрузить JSON. Пока человек сам не выбрал сцену, код её не открывает и не переписывает. Полная миграция всех старых досок остаётся отдельной задачей.

Старые endpoints без mock-handler, группы:

- регистрация, сброс пароля, подтверждение и смена почты, social login;
- `users/me/settings/`, документы, участники проекта и role-request;
- создание и изменение организаций и проектов;
- задачи, исполнители, комментарии, файлы, теги и статусы;
- конструктор: structure-element, fields, objects, combined constructor data;
- platform-admin: users, members, organizations, projects, tasks, statuses, tags;
- `notifications/notification/` и ответы на приглашения.

На этапе 2 нужны единый org/project context, handlers старых задач, конструктора и отчётов, новое меню и главная. Замена legacy guards не должна превращать администратора организации в корпоративное полномочие. Этот отчёт этап 2 не начинает.
