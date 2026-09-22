import { createContext, useContext, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useGenerateReportMutation, useGetAdminPanelGroupsQuery } from "../../../../entities/admin/model/adminSlice";
import type { AdminPanelGroup, AdminPanelReportRequest, AdminPanelReportTable } from "../../../../entities/admin/model/types";
import { errorsHandler } from "../../../../shared/lib/errors-handler";
import { useTranslation } from "react-i18next";

interface Props {
  children: React.ReactNode
  nodeId: number
  groups: AdminPanelGroup[],
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
  nodeId
}: Props) {
  const {t} = useTranslation()
  const [searchParams] = useSearchParams()
  const organizationId = Number(searchParams.get('org'))

  const [tableRowsData, setTableRowsData] = useState<AdminPanelReportTable>({})

  const { data: groups } = useGetAdminPanelGroupsQuery({
    group: nodeId,
    organizationId: organizationId,
  }, {
    skip: !nodeId
  })

  const [generateReport] = useGenerateReportMutation()

  const fetchTableRows = async () => {
    try {
      if (!groups) return
      const body: AdminPanelReportRequest[] = []
      body.push({
        group: nodeId,
        fields: groups.map((group) => Number(group.id))
      })
      const { data: response } = await generateReport({
        organizationId: organizationId,
        body
      })
      if(response){
        setTableRowsData(response)
      }
    } catch (error) {
      errorsHandler(error, t)
    }
  }

  useEffect(() => {
    setTableRowsData({})
  }, [nodeId])

  useEffect(() => {
    if (groups && groups.length > 0) {
        fetchTableRows()
    }
}, [groups])


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