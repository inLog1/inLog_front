# Приёмка этапа 1 — обновлено 26 октября

Результат этапа — готовый front auth flow на моках и основа будущих доменов. Главная пока существующая. Полные mocks конструктора/задач, setup wizard и role editor не требуются в этой итерации и не выдаются за готовые.

## Исходное состояние
- HEAD и изменения рабочей копии зафиксированы без reset/clean и чужих commit.
- Build/lint выполнены для текущей версии; старый baseline — только ориентир (25 октября build OK, lint 131 error/31 warning).
- Карта routes и protected modules обновлена при расхождении с историческим audit.

## UI
- Login по design/login.png: desktop 1440/1280, mobile 390/320 без horizontal overflow. Декор скрывается на узком экране.
- Visible labels, keyboard, focus, show password, pending, validation/общая ошибка, RU/EN.
- Local форма использует текущий email DTO; login password не блокируется неуместным правилом создания пароля.
- local/sso/mixed отображают корректные работающие элементы. SSO-mode не требует локального пароля.
- Role selector и публичная регистрация отсутствуют; recovery/email flows сохранены, register source не удалён.
- Dev-панель существует только в explicit mock build и отделена от product UI.

## Проверяемые сценарии
1. Локально войти каждым из шести demo accounts; профиль соответствует человеку, набор memberships/grants различается.
2. Simulated SSO для owner/admin/employee; success приводит к тому же bootstrap, cancel/error не создают session. Два разных provider subjects с одинаковой почтой не объединяются сами (проверка adapter).
3. Pending user видит «Доступ пока не назначен». Blocked user получает другое сообщение и не открывает workspace.
4. Неверные local credentials → ошибка формы без reload/expired toast. 401 private → один logout; 403 → без logout; network/5xx → повтор.
5. Reload/deep link ждёт session check; неизвестный state не открывает protected UI. Corrupt storage token не вызывает crash. ReturnTo только локальный допустимый URL, не внешний redirect.
6. A → logout → B: кеш A очищен во всех API; профиль/записи A не мелькают. Чужой org/project URL не даёт доступ сам по себе; полные legacy guards будут проверены на следующем этапе.
7. Logout сохраняет свой persisted mock DB, тему и whiteboard. Сохранённая чужая сцена не выводится новому человеку; при невозможности гарантировать scope старый экран не рендерит её до своей проверки.
8. Изменение тестового assignment через repository/handler сохраняется после reload и нового входа; fixtures не засеваются заново на каждый login. Редактор ролей для этого теста не нужен.
9. Reset требует подтверждения и трогает только namespace mock. Проверка другого namespace/legacy keys подтверждает сохранность. Режимы mock/live не используют токены друг друга.
10. Mock initialization await до render. Необработанный API request блокируется явно; ни HTTP, ни WS не уходят на настоящий backend. Статика и HMR работают.
11. Live build не содержит работающего mock-switch/login обхода; worker не запущен. Unconfigured SSO не подменяется mock. Фактическую реальную SSO-интеграцию считать непроверенной.
12. Ready/uninitialized presets переключаются контролируемо. Uninitialized показывает состояние первичной настройки, но не фальшивый завершённый мастер.
13. Старые constructor/tasks/report/profile/notifications/geo-mechanics routes и исходники сохранены. Для legacy API без handlers показано честное ограничение mock-coverage; ни fallback на боевой API, ни ложное «0 записей».

## Автоматические проверки
Meaningful tests: неправильный пароль без redirect; SSO success/cancel/pending; session check/401/403; logout и смена пользователя с cache isolation; сохранение mock assignment после re-open DB; reset namespace isolation; grant scope/delegation subset; никакого создания superadmin из roleName.
Build должен проходить. Run tests для этих сценариев и lint с честным сравнением baseline. Не отключать strict/rules и не выполнять массовые исправления старого кода. Если браузер/сервер недоступен — перечислить непроверенные сценарии, не писать «всё работает».

## Отчёт
Заполнить 08-handoff-template.md → current-progress.md. Отдельно указать: что изменено, что действительно проверено, какие mocks endpoints current/proposed, какие ограничения старых разделов и что нужно для этапа 2. Реальные пароли/токены не прикладывать.
