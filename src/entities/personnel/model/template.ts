import {
  COLUMN_FIO,
  COLUMN_STATE,
  PERSONNEL_TEMPLATE_ID,
  PERSONNEL_TEMPLATE_VERSION,
  type DirectoryDefinition,
  type DirectoryEntry,
  type DirectoryField,
  type PersonnelConfig,
  type PersonnelField,
  type PersonnelFieldType,
  type PersonnelGroup,
  type StarterParts,
} from './types'

export const STARTER_DIRECTORY_KEYS = [
  'departments',
  'positions',
  'workplaces',
  'qualification-status',
] as const

export function directoryId(organizationId: number, key: string): string {
  return `dir:${organizationId}:${key}`
}

export function directoryFieldId(organizationId: number, directoryKey: string, fieldKey: string): string {
  return `df:${organizationId}:${directoryKey}:${fieldKey}`
}

export function personnelFieldId(organizationId: number, key: string): string {
  return `pf:${organizationId}:${key}`
}

export function personnelTabId(organizationId: number): string {
  return `tab:${organizationId}:employee`
}

export function qualificationEntryId(organizationId: number, key: string): string {
  return `de:${organizationId}:qualification-status:${key}`
}

function textField(
  organizationId: number,
  directoryKey: string,
  key: string,
  label: string,
  required: boolean,
): DirectoryField {
  return {
    id: directoryFieldId(organizationId, directoryKey, key),
    key,
    label,
    type: 'text',
    required,
    archived: false,
  }
}

function personnelField(
  organizationId: number,
  key: string,
  label: string,
  group: PersonnelGroup,
  type: PersonnelFieldType,
  required: boolean,
  order: number,
  directoryKey: string | null = null,
): PersonnelField {
  return {
    id: personnelFieldId(organizationId, key),
    key,
    label,
    tabId: personnelTabId(organizationId),
    group,
    type,
    directoryKey,
    required,
    visible: true,
    system: true,
    archived: false,
    order,
    sourceOwned: false,
  }
}

/** Independent copies for one organization. Titles are stored data, not translation keys. */
export function buildStarter(organizationId: number): StarterParts {
  const qualificationTitle = directoryFieldId(organizationId, 'qualification-status', 'title')
  const directories: DirectoryDefinition[] = [
    {
      id: directoryId(organizationId, 'departments'),
      organizationId,
      key: 'departments',
      title: 'Подразделения',
      description: 'Реестр подразделений организации.',
      revision: 1,
      source: { type: 'registry', registry: 'departments' },
      archived: false,
      fields: [
        textField(organizationId, 'departments', 'name', 'Название', true),
        textField(organizationId, 'departments', 'code', 'Код', false),
        textField(organizationId, 'departments', 'parent', 'Родительское подразделение', false),
      ],
    },
    {
      id: directoryId(organizationId, 'positions'),
      organizationId,
      key: 'positions',
      title: 'Должности',
      description: 'Список должностей организации.',
      revision: 1,
      source: { type: 'manual' },
      archived: false,
      fields: [textField(organizationId, 'positions', 'title', 'Название', true)],
    },
    {
      id: directoryId(organizationId, 'workplaces'),
      organizationId,
      key: 'workplaces',
      title: 'Рабочие места',
      description: 'Реестр рабочих мест организации.',
      revision: 1,
      source: { type: 'registry', registry: 'workplaces' },
      archived: false,
      fields: [
        textField(organizationId, 'workplaces', 'name', 'Название', true),
        textField(organizationId, 'workplaces', 'department', 'Подразделение', false),
      ],
    },
    {
      id: directoryId(organizationId, 'qualification-status'),
      organizationId,
      key: 'qualification-status',
      title: 'Статус квалификации',
      description: 'Информационный статус. Права доступа и допуск к работам не выдаёт.',
      revision: 1,
      source: { type: 'manual' },
      archived: false,
      fields: [textField(organizationId, 'qualification-status', 'title', 'Название', true)],
    },
  ]
  const qualification: Array<[string, string]> = [
    ['unspecified', 'Не указано'],
    ['confirmed', 'Подтверждена'],
    ['needs-confirmation', 'Требует подтверждения'],
  ]
  const entries: DirectoryEntry[] = qualification.map(([key, title]) => ({
    id: qualificationEntryId(organizationId, key),
    organizationId,
    directoryId: directoryId(organizationId, 'qualification-status'),
    values: { [qualificationTitle]: title },
    revision: 1,
    archived: false,
  }))
  const fields: PersonnelField[] = [
    personnelField(organizationId, 'last-name', 'Фамилия', 'personal', 'text', true, 0),
    personnelField(organizationId, 'first-name', 'Имя', 'personal', 'text', true, 1),
    personnelField(organizationId, 'patronymic', 'Отчество', 'personal', 'text', false, 2),
    personnelField(organizationId, 'birth-date', 'Дата рождения', 'personal', 'date', false, 3),
    personnelField(organizationId, 'mobile-phone', 'Мобильный телефон', 'contacts', 'text', false, 4),
    personnelField(organizationId, 'work-phone', 'Рабочий телефон', 'contacts', 'text', false, 5),
    personnelField(organizationId, 'email', 'Email', 'contacts', 'text', false, 6),
    personnelField(organizationId, 'department', 'Подразделение', 'work', 'directory', false, 7, 'departments'),
    personnelField(organizationId, 'position', 'Должность', 'work', 'directory', false, 8, 'positions'),
    personnelField(organizationId, 'personnel-number', 'Табельный номер', 'work', 'text', false, 9),
    personnelField(organizationId, 'office', 'Кабинет', 'work', 'text', false, 10),
    personnelField(organizationId, 'start-date', 'Дата начала работы', 'work', 'date', false, 11),
    personnelField(organizationId, 'workplace', 'Рабочее место', 'work', 'directory', false, 12, 'workplaces'),
    personnelField(organizationId, 'duties', 'Основные функции', 'work', 'textarea', false, 13),
    personnelField(organizationId, 'lab-start', 'Дата начала лабораторной деятельности', 'tenure', 'date', false, 14),
    personnelField(organizationId, 'function-start', 'Дата начала работы по текущей функции', 'tenure', 'date', false, 15),
    personnelField(organizationId, 'qualification-status', 'Статус квалификации', 'qualification', 'directory', false, 16, 'qualification-status'),
    personnelField(organizationId, 'certification-until', 'Аттестация действует до', 'qualification', 'date', false, 17),
    personnelField(organizationId, 'in-accreditation', 'В области аккредитации', 'qualification', 'checkbox', false, 18),
  ]
  const config: PersonnelConfig = {
    organizationId,
    revision: 1,
    templateId: PERSONNEL_TEMPLATE_ID,
    templateVersion: PERSONNEL_TEMPLATE_VERSION,
    tabs: [{ id: personnelTabId(organizationId), label: 'Сотрудник', order: 0, system: true }],
    fields,
    columns: [
      COLUMN_FIO,
      personnelFieldId(organizationId, 'position'),
      personnelFieldId(organizationId, 'department'),
      personnelFieldId(organizationId, 'qualification-status'),
      personnelFieldId(organizationId, 'certification-until'),
      COLUMN_STATE,
    ],
  }
  return {
    workspace: {
      organizationId,
      templateId: PERSONNEL_TEMPLATE_ID,
      templateVersion: PERSONNEL_TEMPLATE_VERSION,
    },
    directories,
    entries,
    config,
  }
}
