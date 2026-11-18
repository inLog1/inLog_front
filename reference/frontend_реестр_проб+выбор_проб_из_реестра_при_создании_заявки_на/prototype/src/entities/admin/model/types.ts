export interface AdminPanelTableColumn {
    id: number
    name_en: string
    name_ru: string
    structure_element: number
    structure_element_id: number
    group?: number
    type: string
}

export interface AdminPanelField {
    group: number
    id: number
    name_en: string
    name_ru: string
    structure_element: number
    type: string
    entityType?: 'group' | 'tab' | 'field' //добавил для удобства составления отчета
}

export interface AdminPanelNodeTab {
    id?: number
    group: number
    name_en: string
    name_ru: string
    related_structure_elements?: number[]

    columns?: AdminPanelTableColumn[]
    nestLevel?: number //добавил для удобства вывода в tree и подсчета уровня вложенности
    entityType?: 'group' | 'tab' | 'field' //добавил для удобства составления отчета
    parent_node?: number  //добавил для удобства составления отчета

    structure_element_fields?: AdminPanelField[]
}

export interface AdminPanelNode {
    id: number
    name_en: string
    name_ru: string
    organization: number
    parent: number
    related_groups: number[]
    pre_made_structure_elements?: AdminPanelNodeTab[]

    columns?: AdminPanelTableColumn[]

    // nestLevel?: number //добавил для удобства вывода в tree и подсчета уровня вложенности
    entityType?: 'group' | 'tab' | 'field' //добавил для удобства составления отчета

    structure_element_fields?: AdminPanelField[]
}

export interface AdminPanelNodeRequest {
    name_en: string
    name_ru: string
    organization: number
    parent?: number
    related_groups?: number[]
    pre_made_structure_elements?: {
        id?: number
        name_en: string
        name_ru: string
        related_structure_elements?: number[]
    }[]
}

export interface AdminPanelColumn {
    id: number
    name_en: string
    name_ru: string
    structure_element: number
    structure_element_id: number
    group?: number
    type: string
}

export interface AdminPanelGroup {
    // id: number
    // name_en: string
    // name_ru: string
    // organization: number
    // parent: number
    // related_groups: number[]
    pre_made_structure_elements?: AdminPanelNodeTab[]

    // columns?: AdminPanelTableColumn[]

    // nestLevel?: number //добавил для удобства вывода в tree и подсчета уровня вложенности
    // entityType?: 'group' | 'tab' | 'field' //добавил для удобства составления отчета

    // structure_element_fields?: AdminPanelField[]

    group: number
    id: number
    name_en: string
    name_ru: string
    structure_element: number
    type: 'string' | 'integer' | 'date' | 'file' | 'dropdown'
    parent_node?: number  //добавил для удобства составления отчета
    parent_tab?: number  //добавил для удобства составления отчета
    dropdown_choices?: string[]

}

export interface AdminPanelGroupRequest {
    name_en: string
    name_ru: string
    structure_element?: number
    group?: number
    type: string
    dropdown_choices?: string[]
}

export interface AdminPanelReportRequest {
    group?: number
    fields: number[]
    element?:number
}

export interface AdminPanelRowRequest {
    structure_element?: number
    group: number
    data: {
        [key: string]: {
            type: AdminPanelGroup['type']
            value: string
        }
    }
}

export type AdminPanelRowData = Record<string, {
    type: AdminPanelGroup['type'];
    value: string;
    rowIndex?:number; //добавил для удобства составления отчета
}>

export type AdminPanelReport = {
    id?: number
    structure_element: number
    type: 'group' | 'element'
    data: {
        id: number;
        name_en: string;
        name_ru: string;
        objects: Array<{
            id: number;
            data: AdminPanelRowData;
        }>;
        organization: number;
        parent: number;
        related_groups: number[];
        requested_fields: Array<{
            group: number;
            id: number;
            name_en: string;
            name_ru: string;
            structure_element: number;
            type: string;
        }>;
    }
}

export type AdminPanelReportTable = Record<string, Array<{
    value: string
    type: string
    id: number
}>>