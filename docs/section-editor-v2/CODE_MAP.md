# Ориентиры в ранее присланном коде

Сначала проверить наличие и актуальность файлов. Не переносить содержимое старого снимка в новую ветку.

| Файл | Что учитывать |
|---|---|
| src/features/section-builder/ui/SectionEditor.tsx | Основной объект редизайна: JSX полей, toolbar, status, предупреждения и publish-dialog. Сохранить обработчики и локальный буфер |
| src/pages/app/sections/ui/SectionEditorPage.tsx | Контейнер, max-width, lockedOrg, dirty, leave-dialog, saveRef, права. Менять преимущественно классы контейнера |
| src/features/section-builder/ui/icons.ts | Использовать прежние ключи и существующие иконки |
| src/entities/section/model/types.ts | Конфигурация и статусы. Только читать |
| src/entities/section/model/rules.ts | Валидация, порядок, правила URL. Только читать |
| src/entities/section/model/sectionApi.ts | RTK Query и invalidation. Только читать |
| src/pages/app/sections/ui/SectionWorkPage.tsx | Рабочий экран и настоящий preview. Для регрессии, без редизайна в этом этапе |
| src/pages/app/forms/model/use-leave-guard.ts | Общее поведение ухода. Не переписывать |
| src/app/mocks/sections/service.ts | Сервисная логика. Не менять ради нового UI |
| src/shared/i18n/locales/ru.json, en.json | Добавить/уточнить только необходимые подписи |

Разрешены маленькие UI-компоненты внутри features/section-builder/ui, например SectionAppearancePreview и SectionEditorCard. Не дублировать доменную модель и не создавать второй редактор с отдельным буфером. Межслойные импорты — по действующей FSD проекта. Общий shell и shared/ui не переписывать ради одной страницы.
