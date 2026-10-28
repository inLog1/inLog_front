# Предложенные mock-контракты первичной установки

Эти маршруты существуют только в mock worker (`/mock-api`). Они не согласованы с backend. Live их не вызывает и не подменяет корпоративный вход этими ответами.

Пароль, соль и проверочное значение ни в одном ответе не возвращаются.

## `GET /mock-api/installation/status/`

Существующий статус. Добавлено поле `needsOwner: boolean`. Оно истинно только у пустой ненастроенной установки. Демонстрационный пресет «Нужна настройка» при уже существующих пользователях остаётся информационным: `needsOwner` ложен.

## `POST /mock-api/installation/setup/`

Тело: `corporationName`, `givenName`, `surname`, `email`, `password`, `passwordConfirmation`.

- `200` и `signedIn: true` — установка сохранена и сессия выдана (`access_token`, `refresh_token`, `user`).
- `200` и `signedIn: false` — установка сохранена, вход не завершён. Повторять создание владельца нельзя.
- `409` `already_configured` — владелец уже есть, запись не меняется.
- `400` `invalid_setup` — поля или пароль не приняты, запись не меняется.
- `409` `mock_writer_held` или `stale_write` — запись не меняется.

Идентификатор корпорации назначает запись. Поле `corporationId` из тела не читается.

## `POST /mock-api/organizations/organization/`

Предложенное mock-создание. Тело использует текущие поля организации: `full_name`, `short_name`, `address`, и в mock ещё `kind` (`laboratory` или `customer`). `corporationId` из тела игнорируется.

`201` возвращает созданную организацию. `403` `forbidden` — нет отдельного `organizations.create` на корпорацию установки. `400` `invalid_organization` — пустые поля или неизвестный тип.

## `POST /mock-api/projects/project/`

Предложенная запись для уже существующего диалога «Создать проект». Тело: `name`, `reservoir`, `organization`. Идентификатор корпорации берётся у этой организации, поле из тела не читается.

`201` возвращает проект с `reservoir`. `403` `forbidden` — нет отдельного `projects.create` в этой организации. `projects.read` создание не даёт. `400` `invalid_project` — пустые поля или организация не из этой установки.

## Dev-инструменты

Они доступны панели «Тестирование», а не продуктовому интерфейсу сотрудника.

- `POST /mock-api/auth/dev/personal/reset/` — сброс только `inlog:mock:personal-v1`. Демонстрация не читается и не очищается.
- `POST /mock-api/auth/dev/release-writer/` — отпускает writer lock документа, который уже открыт. Чужой lock не забирается.
- `GET /mock-api/auth/dev/directory/` — строки симуляции и организации установки. Секретов нет.
- `POST /mock-api/auth/dev/directory/employees/` — добавить или обновить строку источника. Тело: `id`, `givenName`, `surname`, `email`, `organizationId`, `providerId`, `externalSubject`.
- `POST /mock-api/auth/dev/directory/sync/` — создать или обновить профили. Ответ: `created`, `updated`, `skipped`. Роли и назначения не выдаются, отсутствующие строки никого не удаляют.

`POST /mock-api/auth/dev/reset/` по-прежнему сбрасывает только базу открытого документа. На личной установке панель его не показывает.

Вход сотрудника остаётся существующим mock SSO: список идентичностей берётся из активной базы. Свободный ввод `externalSubject` сотрудником не добавляется.
