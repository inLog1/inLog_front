import type { AdminPanelGroup } from "../../../../entities/admin/model/types"

export interface ColumnConfig {
    key: string
    title: {
      en: string
      ru: string
    }
    inputType: AdminPanelGroup['type']
    width?: number
    dropdownOptions?: string[]
  }