# Источники

Код изучен через GitHub plugin и локальную read-only копию того же commit:
https://github.com/TrocyukS96/inLog/tree/c88fbde63b930102f2318b5b72811f3cbb8e355e

Основные места: src/app/routing/AppRouter.tsx; src/shared/api/clientApi.ts; src/widgets/sidebar/index.tsx; src/entities/admin/model/adminSlice.ts; src/features/constructor; src/entities/task/model/taskSlice.ts; src/features/tasks; src/features/whiteboard.

Официальная документация проверена 25 октября 2026:
- Cursor rules (.cursor/rules/*.mdc, frontmatter): https://cursor.com/docs/rules
- FSD layers/imports: https://feature-sliced.design/docs/reference/layers
- RTK Query injectEndpoints: https://redux.js.org/toolkit/rtk-query/usage/code-splitting
- MSW browser/startup: https://mswjs.io/guides/integrations/browser

Предлагаемая продуктовая модель и будущие контракты — архитектурные рекомендации для inLog, а не требования из этих источников.


Дополнение 26 октября (проверено в обсуждении SSO):
- Разделение SSO/provisioning: https://learn.microsoft.com/en-us/entra/identity/app-provisioning/user-provisioning
- Пример identity brokering/federation, не выбор конкретного продукта для заказчика: https://www.keycloak.org/docs/26.7.0/server_admin/index.html
Сам IdP заказчика и протоколы ещё не выбраны. Текущий пакет не устанавливает Keycloak/Entra и не обещает прямую интеграцию с 1С.
