# Контракты организаций и проектов

Существующие URL списков и создания не заменены. Новые контракты ниже есть только в mock. Live их не вызывает.

## Без изменений для старых потребителей

| Метод | URL | Назначение |
| --- | --- | --- |
| GET | `/organizations/organization/` | рабочий список организаций |
| GET | `/organizations/organization/:id/` | карточка организации |
| POST | `/organizations/organization/` | создание организации |
| GET | `/projects/project/` | рабочий список проектов, фильтр `organization` |
| GET | `/projects/project/:id/` | карточка проекта |
| POST | `/projects/project/` | создание проекта |

В mock POST по-прежнему проходит `createOrganization` / `createProject`. Корпорацию подставляет сервис из проверенного `installationCorporationId`. Тело запроса корпорацию не назначает. Создание не пишет membership и не назначает роль. У новой записи `revision: 1`.

Рабочий GET организаций по-прежнему включает организацию, если до неё дотягивается любой доменный grant. Его нельзя сузить до одного `organizations.read`.

## Новый справочник, только mock

`GET /mock-api/organizations/directory/`

Сессия и `blocked` / `pending` проверяются через `principal`. Идентичность берётся из `installationCorporationId`, и она должна совпадать с `state.corporation.id`. Иначе `403 forbidden`, без имён. Поле корпорации из URL или тела не читается.

Ответ, snake_case:

| Поле | Смысл |
| --- | --- |
| `corporation_empty` | в установке нет канонических организаций. Это не количество |
| `organizations_hidden` | организации есть, и ни одна не читается через `organizations.read`. Количества нет |
| `create_organization` | можно создать организацию в корпорации установки |
| `organizations` | полные строки только для `organizations.read`: id, имена, адрес, kind, revision, `can_update` |
| `projects` | только `projects.read`, плюс минимум организации `{ id, short_name }` и `can_update` |
| `project_create_targets` | минимум организаций, где есть `projects.create` |
| `projects_concealed_organization_ids` | id организаций, которые вызывающий уже может назвать и в которых есть непрочитанный проект. Без числа проектов |

Пустая корпорация владельца: `corporation_empty: true`, списки пустые, `create_organization: true`.

Пользователь только с `organizations.create` получает создание и не получает имена существующих организаций.

## Изменение, только mock

`PATCH /mock-api/organizations/organization/:id/`

Тело: `full_name`, `short_name`, `address`, `kind`, `expectedRevision`. Отличающиеся `id`, `corporation_id` / `corporationId` или любое `organizationId` дают `400 invalid_identity`, запись не меняется.

`PATCH /mock-api/projects/project/:id/`

Тело: `name`, `reservoir`, `expectedRevision`. Отличающиеся `id`, корпорация или `organization` / `organization_id` дают `400 invalid_identity`.

Общее для обоих PATCH:

- нет права `update` на существующий объект — `403`;
- нет `expectedRevision` — `400 invalid_revision`;
- revision не совпала — `409 stale_write`, повторной записи нет;
- `accessVersion` не читается и версией объекта не считается;
- пустые обязательные поля и чужой `kind` — `400`;
- для проекта пустой `reservoir` в теле — `400`. Если поле опущено, хранимое значение сохраняется, даже когда оно пустое;
- успех увеличивает revision на 1 и не клонирует запись;
- id, `corporationId` и `organizationId` остаются прежними.

Ошибки `403`, `409` и `5xx` не инвалидируют кэш как успешное сохранение и не повторяются автоматически. Конфликт writer lock по-прежнему `409`.

## Live

`getApiMode() !== 'mock'` не запрашивает справочник и не вызывает новые PATCH. Экран показывает существующий GET и создание через существующий POST. Кнопок изменения нет: без backend правка не изображается успешной. Отказ POST остаётся ошибкой.

Инвалидация `SessionAccess` после создания в mock не порождает live-запрос: запрос сессионного доступа в live пропущен.
