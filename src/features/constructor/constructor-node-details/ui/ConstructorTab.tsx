import ConstructorTableWrapper from "./ConstructorTableWrapper"

import type { AdminPanelNodeTab } from "../../../../entities/admin/model/types"
import { TabsContent } from "../../../../shared/ui/tabs"
import { useGetAdminPanelGroupsQuery } from "../../../../entities/admin/model/adminSlice"

interface Props {
    tab: AdminPanelNodeTab
    organizationId: number
    access: {
        schemaCreate: boolean
        schemaUpdate: boolean
        schemaDelete: boolean
        recordsRead: boolean
        recordsCreate: boolean
        recordsUpdate: boolean
        recordsDelete: boolean
    }
}

const ConstructorTab = ({ tab, organizationId, access }: Props) => {
    
    const { data: groups } = useGetAdminPanelGroupsQuery({
        structure_element: tab.id,
        organizationId: organizationId,
    }, {
        skip: !tab.id
    })

    return (
        <TabsContent key={tab.id} value={tab.id!.toString()}>
            <div className="p-4 flex flex-col gap-6">
                <ConstructorTableWrapper
                    groups={groups || []}
                    access={access}
                    data={{
                        entityId: tab.id!,
                        name_en: tab.name_en,
                        name_ru: tab.name_ru,
                        organizationId: organizationId,
                        type: 'structure_element'
                    }}
                />
            </div>
        </TabsContent>
    )
}
export default ConstructorTab;