import { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { AdminPanelNode } from "../../../../entities/admin/model/types"
import { MultiSelect, type MultiSelectOption } from "../../../../shared/ui/multiple-select"
import { findAllParentNodes } from "../../constructor-tree/utils"
import { displayedConnectionValues } from "../model/displayed-connection-values"

interface Props {
    node: AdminPanelNode
    nodes: AdminPanelNode[]
    onChange: (node: AdminPanelNode) => void
    disabled?: boolean
}

const ConstructorNodeConnections = (props: Props) => {
    const { node, nodes, onChange, disabled = false } = props
    const { t, i18n } = useTranslation()
    const currentLang = i18n.language === 'ru' ? 'ru' : 'en'

    const connectionsOptions = useMemo(() => {
        const result: MultiSelectOption[] = []
        if (
            node?.related_groups &&
            node.related_groups.length > 0 &&
            nodes &&
            nodes.length > 0
        ) {
            nodes.forEach((item) => {
                if (node?.related_groups.includes(item.id)) {
                    if (!result.some(el => el.value === item.id.toString())) {
                        result.push({
                            label: item[`name_${currentLang}`],
                            value: item.id.toString(),
                            fixed: item.id === node?.parent,
                        })
                    }
                }
            })
        }

        const parentNodes = findAllParentNodes(nodes, node?.parent || null);

        if (parentNodes && parentNodes.length > 0) {
            const targetNestedEntities = parentNodes.filter(
                (item) => item.parent !== node?.id,
            )
            targetNestedEntities.forEach((item) => {
                if (!result.some(el => el.value === item.id.toString())) {
                    result.push({
                        label: item[`name_${currentLang}`],
                        value: item.id.toString(),
                        fixed: item.id === node?.parent,
                    })
                }
            })
        }

        return result
    }, [nodes, currentLang, node?.related_groups, node?.parent])

    const handleChangeConnections = useCallback((value: string[]) => {
        onChange({...node, related_groups: value.map(Number)})
    }, [node, onChange])

    const connectionValue = displayedConnectionValues(node.related_groups, connectionsOptions)

    return (
        <MultiSelect
            options={connectionsOptions}
            value={connectionValue}
            placeholder={t('admin-page.choose-related-nodes')}
            disabled={disabled}
            onValueChange={handleChangeConnections}
        />
    )
}

export default ConstructorNodeConnections