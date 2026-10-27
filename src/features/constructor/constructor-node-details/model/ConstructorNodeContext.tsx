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

  const screenKey = `${organizationId ?? ''}:${nodeId}`
  const [storedRows, setStoredRows] = useState<{ key: string; data: AdminPanelReportTable }>({ key: '', data: {} })
  const tableRowsData = storedRows.key === screenKey ? storedRows.data : {}
  const requestSerial = useRef(0)
  const screenRef = useRef({ organizationId, nodeId })
  const setTableRowsData = (data: AdminPanelReportTable) => {
    setStoredRows({ key: screenKey, data })
  }

  const groupsQuery = useGetAdminPanelGroupsQuery({
    group: nodeId,
    organizationId: organizationId ?? 0,
  }, {
    skip: !nodeId || organizationId == null || !canReadRecords
  })
  const groups = groupsQuery.currentData

  const [generateReport] = useGenerateReportMutation()

  const fetchTableRows = async () => {
    const serial = requestSerial.current
    const requestedOrganizationId = organizationId
    const requestedNodeId = nodeId
    const requestedGroups = groups
    try {
      if (!canReadRecords || !requestedGroups || requestedOrganizationId == null) return
      const body: AdminPanelReportRequest[] = []
      body.push({
        group: requestedNodeId,
        fields: requestedGroups.map((group) => Number(group.id))
      })
      const response = await generateReport({
        organizationId: requestedOrganizationId,
        body
      }).unwrap()
      if (
        serial !== requestSerial.current
        || requestedOrganizationId !== screenRef.current.organizationId
        || requestedNodeId !== screenRef.current.nodeId
      ) return
      setStoredRows({ key: `${requestedOrganizationId ?? ''}:${requestedNodeId}`, data: response ?? {} })
    } catch (error) {
      if (
        serial !== requestSerial.current
        || requestedOrganizationId !== screenRef.current.organizationId
        || requestedNodeId !== screenRef.current.nodeId
      ) return
      setStoredRows({ key: `${requestedOrganizationId ?? ''}:${requestedNodeId}`, data: {} })
      errorsHandler(error, t)
    }
  }

  useEffect(() => {
    screenRef.current = { organizationId, nodeId }
    requestSerial.current += 1
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