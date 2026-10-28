# Контракт чтения пользователей

Это предложенный mock-контракт рядом с существующим access API. Прежние `GET access/directory/`, `POST access/assignments/` и `DELETE access/assignments/:id/` не меняют семантику. `scope=corporation` у directory по-прежнему возвращает только назначения с `scope.type === 'corporation'`.

Live (`VITE_API_MODE` не `mock`) эти запросы не отправляет. Страница списка и карточка показывают экран недоступности и не монтируют query.

Ответы — только разрешённые DTO. Токенов, паролей, хешей и полного mock-документа в них нет. Legacy platform-admin API не используется.

## `GET /mock-api/access/users/`

Параметры:

| Параметр | Значение |
| --- | --- |
| `organization` | `all` или id организации. Пустое значение трактуется как `all` |
| `q` | подстрока имени или рабочей почты, до 200 символов |
| `page` | с 1, по умолчанию 1 |
| `pageSize` | по умолчанию 20, максимум 50 |

Ошибки: `400 invalid_organization`, `400 invalid_query`, `400 invalid_page`, `404 not_found` для неизвестной организации этой корпорации, `403 forbidden` без count, если организацию нельзя читать или читать справочник негде.

`200`:

```json
{
  "accessVersion": 1,
  "corporationId": 1,
  "coverage": "corporation",
  "organizations": [{ "id": 101, "shortName": "Лаб. А" }],
  "projects": [{ "id": 1001, "name": "Проект А-1", "organizationId": 101 }],
  "query": { "organization": "all", "q": "", "page": 1, "pageSize": 20 },
  "count": 1,
  "users": []
}
```

`coverage` — `corporation` у суперадминистратора установки и `granted` у остальных. `count` — размер видимого набора до страницы. `query` повторяет разобранные аргументы. Один пользователь — один элемент, даже при нескольких назначениях. Пользователь без назначений остаётся в списке.

Поля строки: `id`, `fullName`, `email`, `status` (`active` | `blocked`), `corporateSuperadmin`, `organizations` (только читаемые membership), `assignments` (только читаемые области: `id`, роль, область, `canRevoke`).

## `GET /mock-api/access/users/:userId/`

`userId` — положительное целое. Иначе и для скрытого человека: `404 { "code": "not_found" }`.

`200` добавляет к полям списка `canAssign` и `roleChoices`. Выбор роли: `id`, `displayName`, `ownerScope`, краткий `operational`, `hasDelegation`, `scopes[]` с `assignable` и `reason` (`forbidden`, `scope_expansion`, `self_elevation`, `invalid_scope`). Области выбора — только те, где актор может управлять назначением и получатель допустим.

## Запись

Новых команд записи нет. Карточка вызывает прежние:

- `POST /mock-api/access/assignments/` с `{ userId, roleId, scope, expectedAccessVersion }`
- `DELETE /mock-api/access/assignments/:assignmentId/?expectedAccessVersion=`

`409 stale_write` не меняет назначения и capability. Идемпотентный повтор отвечает `200` и не создаёт вторую строку. `403` на создании или снятии оставляет уже существующие назначения.
