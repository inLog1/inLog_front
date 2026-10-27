# Что найдено в актуальном коде

## Причина owner

- entities/access/model/grants.ts: can() учитывает только effectiveGrants; hasInstallationCapability применяется к административному canManageAssignment, но не ко всем операционным проверкам.
- assignmentDenial сначала проверяет выдаваемый набор по canDelegate, затем для assigneeId === actorId запрещает любое новое операционное право через self_elevation. Исключения для настоящего корпоративного суперадминистратора нет.
- app/mocks/db/seed.ts: role-owner получает права задач и legacy-конструктора операционно. Права новых forms/table-views/sections лежат только в delegationGrantIds. Поэтому даже свежий owner не видит все новые разделы.
- app/mocks/access/service.ts: delegableIds строится через canDelegate. Старый сохранённый снимок без новых делегируемых grants дополнительно ограничивает доступные чекбоксы, хотя системная capability присутствует.
- features/access-management/ui/PermissionSets.tsx: обе длинные колонки допускают добавление только из delegableIds; дальнейшая выдача дополнительно зависит от canDelegateFurther.
- Навигация и useWorkspaceSection смотрят на effectiveGrants; недостаточно добавить кнопку или исправить один mutation.

Три проверки в отдельном временном тесте подтвердили:
1. user 1 имеет capability установки, can(forms.read, org101) == false, canDelegate == true.
2. Назначение читателя форм этому owner возвращает self_elevation, назначение той же роли user 3 разрешено.
3. Административное название роли у обычного пользователя не выдаёт capability.
Это проверки текущего поведения, а не доказательство, что новое требование уже реализовано.

## Визуальные причины

- HomePage.tsx: одна сетка смешивает рабочие и служебные карточки. Все быстрые действия одинаково primary. max-w-5xl + mx-auto отодвигают содержимое на широком экране. Заголовок дублирует шапку.
- AppShell.tsx: рабочий список содержит также инструменты конфигурации. Шапка динамического раздела использует общее nav.section-page вместо названия раздела.
- widgets/header/index.tsx: wrapping и селекторы в одном flex формируют высокую многострочную шапку. RU занимает много места рядом с уведомлениями.
- shared/styles/index.css: muted-foreground дополнительно прозрачен; голубая шапка, тёмный sidebar, яркий синий primary и бирюзовый accent дают несколько конкурирующих акцентов. Изменять семантические цвета нужно с учётом календаря, таблиц, доски и тёмной темы.
- RoleEditor и PermissionSets показывают слишком много прав сразу и дублируют каталог в двух колонках. Технические resource.action видны постоянно. Выдача готовой роли и её создание пока связаны с assignments.update.

Рекомендуемые точки входа для правок: app/home, app/shell, app/navigation, widgets/header, widgets/sidebar, features/access-management, shared/styles; доменная политика — entities/access и mock services. Массовый перенос FSD не нужен.
