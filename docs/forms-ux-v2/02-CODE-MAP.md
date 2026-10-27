# Опорные места в ранее присланном коде

Пути сверять с актуальным проектом, не копировать старые файлы.

| Область | Найденные файлы |
|---|---|
| Список/создание | pages/app/forms/ui/FormsPage.tsx |
| Gate редактора и dirty guard | pages/app/forms/ui/FormEditorPage.tsx, model/use-leave-guard.ts, leave-guard.ts |
| Buffer и publish | features/form-builder/ui/FormEditor.tsx, model/editor-state.ts |
| Поля | features/form-builder/ui/FieldSettings.tsx |
| Запись | pages/app/forms/ui/FormRecordPage.tsx, features/form-fill/ui/FormRecordView.tsx |
| Общий renderer | entities/form/ui/FormRenderer.tsx |
| Writer-флаги | entities/session session model/selectors; SessionProvider читает installation.writeLocked/writesUnavailable |
| Источник статуса | entities/access/model/accessApi.ts; app/mocks/auth/handlers.ts; app/mocks/http.ts writeSupport |

В FormEditor.publish() найдено сохранение грязного buffer перед publishForm. Нельзя заменить это новым disabled={dirty}, ориентируясь только на макет.

В FormRecordView используется <FormRenderer ... readOnly />. Изменение общего readOnly поведения затронет другие страницы: вводить отдельный record presentation и проверить прежние вызовы.

FormsPage строит четыре ссылки в каждой строке. Их визуально группируем, не сокращая доступные сценарии и не меняя URL/guards.

Нижняя writer-плашка идёт из dev/testing и не означает отсутствие прав owner. Локальная форма может использовать существующий session state, сохранив gate и проверку service. Не изобретать local boolean, который снимает реальную блокировку.
