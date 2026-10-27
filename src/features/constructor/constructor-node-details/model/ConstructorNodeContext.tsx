import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useGenerateReportMutation, useGetAdminPanelGroupsQuery } from "../../../../entities/admin/model/adminSlice";
import type { AdminPanelGroup, AdminPanelReportRequest, AdminPanelReportTable } from "../../../../entities/admin/model/types";
import { errorsHandler } from "../../../../shared/lib/errors-handler";
import { useTranslation } from "react-i18next";

interface Props {
  children: React.ReactNode
  nodeId: number
  groups: AdminPanelGroup[]
  organizationId: number | null
  canReadRecords: boolean
}

interface ProviderState {
  nodeId:number | null;
  tableRowsData: AdminPanelReportTable,
  
  setTableRowsData: (data: AdminPanelReportTable) => void,
  refetchRows:()=>void
}

const initialState: ProviderState = {
  nodeId:null,
  tableRowsData: {},
  setTableRowsData: (data: AdminPanelReportTable) => data,
  refetchRows:()=>{}
};

const ConstructorNodeContext = createContext<ProviderState>(initialState)

export function ConstructorNodeProvider({
  children,
  nodeId,
  organizationId,
  canReadRecords,
}: Props) {
  const {t} = useTranslation()

  const [tableRowsData, setTableRowsData] = useState<AdminPanelReportTable>({})
  const requestSerial = useRef(0)

  const { data: groups } = useGetAdminPanelGroupsQuery({
    group: nodeId,
    organizationId: organizationId ?? 0,
  }, {
    skip: !nodeId || organizationId == null || !canReadRecords
  })

  const [generateReport] = useGenerateReportMutation()

  const fetchTableRows = async () => {
    const serial = requestSerial.current
    const requestedOrganizationId = organizationId
    const requestedNodeId = nodeId
    try {
      if (!canReadRecords || !groups || organizationId == null) return
      const body: AdminPanelReportRequest[] = []
      body.push({
        group: nodeId,
        fields: groups.map((group) => Number(group.id))
      })
      const response = await generateReport({
        organizationId,
        body
      }).unwrap()
      if (
        serial !== requestSerial.current
        || requestedOrganizationId !== organizationId
        || requestedNodeId !== nodeId
      ) return
      setTableRowsData(response ?? {})
    } catch (error) {
      if (serial !== requestSerial.current) return
      setTableRowsData({})
      errorsHandler(error, t)
    }
  }

  useEffect(() => {
    requestSerial.current += 1
    setTableRowsData({})
  }, [nodeId, organizationId])

  useEffect(() => {
    if (canReadRecords && groups && groups.length > 0) {
        fetchTableRows()
    }
}, [groups, canReadRecords])


  return (
    <ConstructorNodeContext.Provider value={{
      nodeId,
      tableRowsData,
      setTableRowsData,
      refetchRows:fetchTableRows
    }}>
      {children}
    </ConstructorNodeContext.Provider>
  )
}

export default ConstructorNodeProvider;

export const useConstructorNodeContext = () => {
  return useContext(ConstructorNodeContext)
}