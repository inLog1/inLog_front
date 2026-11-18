import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { AdminPanelGroup, AdminPanelNode } from "../../../../../entities/admin/model/types"

interface SelectOption {
    label: string
    value: string
}

export interface RelatedTabsOptionsData {
    node: AdminPanelGroup
    parentNodes: AdminPanelNode[]
    relativeNodes:Array<AdminPanelNode>
    isCreating?:boolean,
}

export const useRelatedTabsOptions = (data:RelatedTabsOptionsData)=> {
    const {i18n} = useTranslation()
    const {relativeNodes, isCreating, node} = data

    const currentLang = i18n.language === 'ru' ? 'ru' : 'en'

    const tabConnectionOptions = useMemo((): SelectOption[] => {
        const result: SelectOption[] = []
        if (relativeNodes && relativeNodes.length > 0) {
            relativeNodes.forEach((item) => {
                if (
                    item.pre_made_structure_elements &&
                    item.pre_made_structure_elements.length > 0
                ) {
                    item.pre_made_structure_elements.forEach((tab) => {
                        result.push({
                            label: `${item[`name_${currentLang}`]} — ${
                                tab[`name_${currentLang}`]
                            }`,
                            value: tab.id!.toString(),
                        })
                    })
                }
            })
        }
  
        if(!isCreating){
            return result.filter(item=>{
                const targetTab = node?.pre_made_structure_elements?.find(tab=>tab?.id===Number(item.value))
                return !targetTab
            })
        }
        return result
    }, [relativeNodes,isCreating, i18n.language])

    return tabConnectionOptions
}