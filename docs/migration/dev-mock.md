# Mock-режим этапа 1

Инструкция для локальной проверки. Секретов и паролей здесь нет. Публичный пароль фикстур записан в `docs/migration/09-mock-scenarios.md`.

## Как запустить

```bash
npm run dev:mock
```

Это `vite --mode mock` и читает `.env.mock`: `VITE_API_MODE=mock`, `VITE_AUTH_MODE=mixed`. Обычный `npm run dev` остаётся live. Пока `npm run build` тоже собирается с `--mode mock`: в бандл входят worker, мок-API и кнопка «Тестирование». Живая прод-сборка без мока — `npm run build:live`. Существующий `.env` не перезаписывается и в mock не используется как адрес API.

## Два независимых переключателя

- `VITE_API_MODE=mock|live`. По умолчанию live. Mock ходит только на локальный префикс `/mock-api/` и не подставляет `VITE_API_BASE_URL`.
- `VITE_AUTH_MODE=local|sso|mixed`. Для live это возможность установки. Если переменная не задана, live считает режим `local`. В mock начальное значение сида — `mixed`. Панель «Тестирование» меняет `authMode` только в mock-базе и завершает текущую сессию.

Live SSO — это переход на `VITE_SSO_START_URL`, если адрес задан. Пустой адрес показывает, что провайдер не настроен, и не создаёт тестовую личность. Клиентский секрет провайдера во frontend не кладётся.

## Где лежат данные

Адаптер сессии: `src/shared/api/session-storage.ts`.

- Live-ключи совместимости: `token`, `refresh_token`, плюс `inlog:live:session:subject`.
- Mock-ключи: `inlog:mock:session:access`, `inlog:mock:session:refresh`, `inlog:mock:session:subject`.
- Черновики сессии: префикс `inlog:session-draft:`.
- Mock-база: IndexedDB `inlog:mock:corporate-v2`, `schemaVersion` 1. Сид выполняется один раз на пустую базу. Несовпадение схемы базу не стирает.
- Ветка git эти хранилища не изолирует. Logout не равен reset.

## Что чистит logout и reset

Logout снимает ключи сессии и черновики, останавливает websocket, сбрасывает кэши RTK Query. Тема, доска и mock-база остаются. Reset в панели спрашивает подтверждение и заново засевает только этот namespace IndexedDB.

## Worker

В mock `main` дожидается MSW worker (`public/mockServiceWorker.js`) и только потом монтирует React. Непокрытый `/mock-api/*` отвечает `501` с кодом `mock_coverage_gap`. В live worker не регистрируется; при старте live снимается только регистрация, чей script URL содержит `mockServiceWorker.js`.
