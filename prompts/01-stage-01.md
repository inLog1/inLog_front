# Этап 1 — вход, корпоративная симуляция и основа моков

Ты работаешь в существующем inLog (React + Vite + TypeScript + Tailwind 4 + shadcn + RTK Query + React Router, FSD). Выполни только этап 1. Это не новый проект. Сохрани конструктор, задачи и связанные существующие функции.

## Контекст и чтение
Прочитай .cursor/rules, docs/migration/01-code-review.md, 02-roadmap.md, 03-architecture.md, 04-access-and-contracts.md, 05-step-01-acceptance.md, 06-preservation-checklist.md, 07-design-spec.md, 09-mock-scenarios.md, 10-corporate-login.md. Визуальная ссылка — design/login.png.
Audit исторический: master c88fbde63b930102f2318b5b72811f3cbb8e355e от 1 августа, проверен 25 октября. Пользователь может работать с более новой версией. Не откатывай его код ради соответствия отчёту.
Уточнения: корпорация может использовать единый вход. Реальную систему и интеграцию с 1С пока не знаем. Нужна mock-симуляция SSO и единая сессия, но не реализация реального OIDC/SAML/SCIM. Роли произвольны, а superadmin — специальное полномочие. На этом этапе нет редактора ролей и нового dashboard.

## A. Подготовка (часть первого этапа)
Проверь git status/HEAD, сохрани пользовательские изменения. Если ветки ещё нет, создай новую migration branch от текущего состояния; не делай reset/clean, force push и чужих commit. Если ветка уже создана — продолжай её. Автоматически commit/push не выполняй.
Прочитай актуальные AppRouter/AdminRoute, RootLayout, Sidebar/UserMenu, authSlice/LoginForm/AuthLayout/SignHeader, userSlice/selectors, clientApi, store, routes, websocket и whiteboard storage consumers. Составь карту их зависимостей и token-key usages через поиск.
Запусти build/lint текущей версии и зафиксируй исходные проблемы в docs/migration/current-baseline.md. Используй существующий package manager/lockfile; не обновляй стек и не исправляй lint массово. Если исходная сборка сломана, отдели минимально нужную починку отдельным объяснимым изменением; не удаляй функцию, чтобы получить green.

## B. Каркас и состояние (минимум под текущий этап)
Используй существующую FSD. app — bootstrap/routing/store/композиция; entities/session и access — явные session/access модели, shared/api/config — технический транспорт; auth feature и auth-layout — UI. Не импортируй entities peer-slices напрямую и app/store из новых entities/shared; orchestration нескольких доменов — app. Не создавай пустые папки будущих конструкторов.
Сохрани восемь существующих RTK API services и exports. Новый proposed service допустим для capabilities/access, без массового слияния. Server data не дублируй в Redux второй копией.
Добавь apiMode=mock|live (явная проверяемая конфигурация, default live) и authMode=local|sso|mixed (capabilities установки; dev panel меняет только mock config). Создай .env.example и dev-инструкции без реальных секретов. Существующий .env не перезаписывай. Не передавай provider client secrets во frontend.

## C. HTTP mocks и изменяемые фикстуры
MSW запускается await до React render в разрешённом mock/dev/test build. Mock API base локальный, не production fallback. Непокрытые API calls блокируются с диагностикой; статика/HMR доступны. Live не импортирует handlers и dev UI, не стартует worker. Продумай остановку старого worker при переходе к live (не снимать чужие service workers на origin).
Текущие endpoints login/verify/logout/me и bootstrap-запросы старого layout поддержи точными current shapes. Новые capabilities/access/mock SSO endpoints явно назови proposed и документируй. Из старого layout убрать зависимость подтверждения сессии от загрузки проектов первой организации. Не переделывать сами org/project selections пока.
В mock отключить реальный WS, не оставлять попытки reconnect к настоящему backend. HTTP MSW сам по себе не закрывает этот канал.
Реализуй минимальный typed mock repository с IndexedDB persistence, schemaVersion и namespace из документа 09. Seed шести accounts, org 101/102/201, projects 1001/1002, memberships/role definitions/grants/assignments/config. Изменения сохраняются после reload/logout, seed не выполняется заново на каждом входе. Пароли пользователя не записываются в IndexedDB/логи; test password публичен и применим только к fixture identities.
Нужны один read protected test-resource и mutation тестового assignment на mock API для проверки scope/пersistence без UI редактора ролей. Этот endpoint существует только в mock build, не является спроектированным production API. Grant/delegation модель раздельна; subset проверяет resource/action/scope; нельзя получить superadmin простым именем роли.
Все legacy CRUD endpoints задач/конструктора сейчас реализовывать не требуется. Непокрытые запросы должны давать честное ограничение mock-coverage, а не success/пустой список. Никакого переключения на боевой API для их демонстрации. Полные handlers идут на этапе 2.

## D. Login UI
Реализуй композицию design/login.png, не screenshot background. Существующий LogoIcon + inLog, shared/ui, lucide-react. Desktop: спокойная левая часть и форма справа. Mobile 320/390: доступная форма без декора и горизонтального скролла. Новые auth styles/tokens не ломают старые таблицы/Gantt/темы. Если AuthLayout нужен другим flows — добавь variant вместо разрушительной замены.
local: email/password, label «Рабочая почта», показать пароль, помощь/recovery, loading/error. mixed: оба метода, как на референсе. sso: одна основная кнопка корпоративного входа и помощь, без собственной парольной формы. Существующий DTO требует email, свободный username не обещать.
Login password валидируется на непустоту; требования создания нового пароля не должны блокировать существующий вход. visible labels/aria/autocomplete/keyboard submit/focus, RU/EN через i18n. Не нужны выбор роли, публичная самостоятельная регистрация или credentials banners.
Сохрани registration components/history, но публичный /register и ссылки для новой концепции закрыты корректным объяснением/redirect без рендеринга формы. Recovery/email routes сохраняются. SSO provider в live без конфигурации не симулируется: скрытая кнопка/честная ошибка конфигурации, без fallback на локальный fake user.

## E. Simulated SSO
Только mock-mode: «Войти через корпоративный аккаунт» ведёт на явно обозначенную тестовую provider-страницу. Там выбор вымышленной identity и Continue/Cancel; корпоративный пароль не запрашивать. Успех возвращается через mock flow и общий session bootstrap. Отмена/ошибка не создаёт session. Identity mapping provider+externalSubject, не email; автоматического superadmin первому вошедшему нет. Не делай настоящий OAuth/PKCE/token exchange без известного backend-контракта; раздели mock adapter и future live adapter.

## F. Общая сессия и доступ
Единые состояния unknown/loading/authenticated/anonymous/error; отдельно authentication success и готовность рабочего access. Pending без grants — понятный экран без доступа; blocked — другое состояние. Оба варианта входа и dev quick switch получают одинаковый bootstrap.
Сохрани действующий live login контракт через adapter. Используй текущий getMe как один источник user server data; не создавай конкурирующий user state. Token JSON читается безопасно. Защищённый экран не рендерится до определения сессии/access. ReturnTo только локальный допустимый route, без внешнего redirect, query валидируется перед использованием.
401 от login → ошибка формы без reload/«сессия истекла». 401 private → один controlled logout при параллельных запросах. 403 → недостаточно прав без logout; network/5xx → retry. Политику endpoint задавай явно, не грубым includes('login').
Во всех точках выхода единый logout: остановка WS/subscriptions/in-flight session requests, очистка session access/refresh и нового state, reset всех восьми API caches плюс новых caches, переход к login даже при ошибке logout API. Очистить прошлые пользовательские UI-черновики. localStorage.clear запрещён; доска/тема/mock DB остаются. Сохранённую сцену другого человека нельзя показывать следующему пользователю; если её старый scope не подтверждён, не рендери её до проверки, не стирай.
Mock/live session keys разделены единым техническим storage adapter для всех consumers, без автоматического копирования live tokens в mock. Ветка Git сама этого не обеспечивает. Документируй совместимость current live keys.
Минимальная access модель и fixtures нужны сейчас; полную замену legacy guards/динамического меню и editor roles не заявлять завершённой — они на следующих этапах. Не повышать org admin до corporation admin ради открытия старой страницы.

## G. Панель тестирования
Только explicit mock build, сворачиваемая «Тестирование», не часть обычного входа. Аккаунты/права из fixture DB, не roleName hardcode в product components.
Действия: quick switch через полный lifecycle; authMode local/sso/mixed; ready/uninitialized preset; controlled errors expired/403/network/SSO cancel/blocked; reset fixtures с подтверждением. Ошибка влияет на нужный endpoint, не все запросы сразу. Reset только своего namespace, logout не reset. Preset switch завершает session. Для uninitialized покажи честный экран необходимости начальной настройки, но сам wizard сейчас не реализуй (этап 3).
Не подменяй полноценную проверку обычного login быстрым switch; оба пути тестируются.

## H. Проверка и завершение
Пройди docs/migration/05-step-01-acceptance.md. Добавь только необходимые meaningful tests для auth/SSO/session/errors/cache isolation/persisted assignments/namespace reset/grants, не тесты каждой кнопки ради покрытия. Если test tooling нет — введи минимальный актуальный setup и script. Build обязателен; lint сравни с текущим baseline, не отключай правила и strict. Исправления защищённых legacy модулей только узкие, объяснённые текущей совместимостью.
По возможности проверь login на desktop/mobile и все шесть аккаунтов; browser/backend недоступен — явно обозначь непроверенное. Не отправляй реальные мутации на backend, не включай mock bypass в live.
Обнови docs/migration/current-progress.md по 08-handoff-template.md: файлы, команды/результаты, текущие/proposed endpoints, известные ограничения, screenshots. Укажи, что реальный SSO и 1С не реализованы, старые domain mocks ещё не полные. Не делай commit/push чужих правок автоматически. Не приступай к этапу 2, новой главной, роли-editor, setup wizard и конструкторам после этого задания.
