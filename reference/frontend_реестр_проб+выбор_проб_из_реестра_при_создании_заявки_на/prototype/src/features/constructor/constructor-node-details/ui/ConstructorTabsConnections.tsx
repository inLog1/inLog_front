import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSelector } from "react-redux"
import { makeSelectAdminPanelNodes } from "../../../../entities/admin"
import type { AdminPanelNode, AdminPanelNodeTab } from "../../../../entities/admin/model/types"
import { Card, CardContent, CardHeader, CardTitle } from "../../../../shared/ui/card"
import { MultiSelect } from "../../../../shared/ui/multiple-select"
import { findAllRelativeTabs, getConnectionTabsOptions } from "../../constructor-tree/utils"

interface Props {
    node?: AdminPanelNode
    tab: AdminPanelNodeTab
    organizationId: number
    onChange: (tab: AdminPanelNodeTab) => void
}

const ConstructorTabsConnections = ({ node, tab, organizationId, onChange }: Props) => {
    const { t, i18n } = useTranslation()
    const currentLang = i18n.language === 'ru' ? 'ru' : 'en'
    const [connectionTabs, setConnectionTabs] = useState<AdminPanelNodeTab[]>([])
    const nodes = useSelector(makeSelectAdminPanelNodes(organizationId!))

    const connectionsOptions = useMemo(() => getConnectionTabsOptions(nodes, node?.id || 0, currentLang), [nodes, node?.id, currentLang])

    useEffect(() => {
        if (nodes.length > 0 && tab.id) {
            const relativeTabs = findAllRelativeTabs(nodes, tab) || []
            setConnectionTabs(relativeTabs)
        } else {
            setConnectionTabs([])
        }
    }, [nodes, tab.id, tab?.related_structure_elements, node])

    const handleChangeConnections = (value: string[]) => {
        onChange({...tab, related_structure_elements: value.map(Number)})
    }
    return (
        <Card className=" border-border bg-background">
            <CardHeader>
                <CardTitle>{t('admin-page.related-tabs')}</CardTitle>
            </CardHeader>

            <CardContent>

                <MultiSelect
                    options={connectionsOptions}
                    value={connectionTabs.map(tab => tab.id!.toString())}
                    placeholder={t('admin-page.choose-related-tabs')}
                    onValueChange={handleChangeConnections}
                />

            </CardContent>
        </Card>
    )
}

export default ConstructorTabsConnections