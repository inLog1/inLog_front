import { createSelector } from "@reduxjs/toolkit";
import { adminApi } from "./adminSlice";

export const makeSelectAdminPanelNodes = (organizationId: number) => 
    createSelector(
      [adminApi.endpoints.getAdminPanelNodes.select({ organizationId })],
      (nodesResult) => nodesResult?.data ?? []
    );