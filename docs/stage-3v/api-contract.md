# Этап 3В. Proposed API табличных представлений

Это контракт mock-режима с префиксом `/mock-api`. Это не production-контракт. В live эти пути не вызываются и ошибка сети не считается ответом «ещё не реализовано».

Организация передаётся query-параметром `organization` на чтении и в теле на записи, как у форм этапа 3Б. Сессия — существующий bearer mock-сессии.

## Пути

Список представлений формы:

`GET /mock-api/forms/:formId/table-views/?organization=`

Нужны `forms.read` и `table-views.read`.

Создание:

`POST /mock-api/forms/:formId/table-views/`

Нужны `forms.read` и `table-views.create`. Тело: `schemaVersion`, название, описание, колонки, фильтры, сортировка, размер страницы, `organizationId`. Значения записей не возвращаются. Id выдаёт сервер, ревизия начинается с 1.

Чтение:

`GET /mock-api/forms/:formId/table-views/:viewId/?organization=`

Нужны `forms.read` и `table-views.read`.

Обновление:

`PUT /mock-api/forms/:formId/table-views/:viewId/`

Нужны `forms.read` и `table-views.update`. Тело содержит `expectedRevision`. Совпадение ревизии увеличивает её на 1. Несовпадение — `409 stale_write`, документ не меняется. Id не меняется.

Удаление:

`DELETE /mock-api/forms/:formId/table-views/:viewId/?organization=`

Нужно `table-views.delete`. Форма и `FormRecord` остаются.

Каталог опубликованных колонок:

`GET /mock-api/forms/:formId/columns/?organization=`

Нужны `forms.read` и любое из `table-views.read`, `table-views.create`, `table-views.update`. Черновик в каталог не входит.

Строки сохранённого представления:

`POST /mock-api/forms/:formId/table-views/:viewId/rows/`

Нужны `forms.read`, `table-views.read` и `form-records.read`. Тело может передать временные `filters`, `sort`, `pageSize`, `offset`, `limit`. Ключ в теле — замена сохранённой настройки, в том числе пустой массив фильтров. Отсутствие ключа — использовать документ.

Предпросмотр несохранённой конфигурации:

`POST /mock-api/forms/:formId/table-views/preview/`

Путь зарегистрирован раньше `/:viewId`. Нужны `forms.read`, `form-records.read` и любое из `table-views.create`, `table-views.update`. Документ не пишется, writer lock не берётся.

## Ответ строк

Поля ответа: `organizationId`, `formId`, `viewId` (`null` у предпросмотра), `columns`, `rows`, `total`, `offset`, `limit`, `appliedFilters`, `appliedSort`.

Строка: `recordId`, `formVersionId`, `cells`. `total` — число строк после фильтра и до страницы.

Порядок работы сервиса: сессия и права, организация и форма, записи этой пары, фильтр, сортировка, страница, проекция колонок.

## Ошибки

Тело ошибки — `{ code }` и при необходимости уточнение. `403` содержит только `forbidden` и не раскрывает название или значения. Сессия при этом жива.

- `400 unknown_key` — лишний ключ тела;
- `400 unknown_schema` — `schemaVersion` настроек не 1, или схема опубликованной формы не поддерживается;
- `400 invalid_query` — временная конфигурация или параметры окна неверны; сохранённый фильтр вместо них не подставляется;
- `400 invalid_view` — документ, который пытаются сохранить, не проходит проверку;
- `403 forbidden` — нет нужного операционного права; проверка идёт до поиска сущности;
- `404 not_found` — формы или представления нет в организации, на которую право уже есть;
- `409 stale_write` — `expectedRevision` не совпала;
- `409 incompatible_view` — сохранённые фильтр или сортировка больше не подходят каталогу, временной замены нет; условие не снимается и выборка не расширяется;
- `409 mock_writer_held` / `writer_lock_unavailable`, `507 quota_exceeded` — прежняя обработка lock и квоты.

Неизвестный оператор, неизвестный `fieldId`, смешанная колонка в типовом сравнении или сортировке, слишком большой `limit`, слишком много колонок или фильтров и слишком длинное поисковое значение отклоняются кодом проверки, а не пустым результатом.

Удаление представления не удаляет форму и массив записей.
