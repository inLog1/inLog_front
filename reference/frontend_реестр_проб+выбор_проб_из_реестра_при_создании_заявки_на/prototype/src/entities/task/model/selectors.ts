import { createSelector } from "@reduxjs/toolkit";
import { taskApi } from "./taskSlice";

export const makeSelectTaskStatuses = (projectId: number) => 
    createSelector(
      [taskApi.endpoints.getStatuses.select({ projectId })],
      (statusesResult) => statusesResult?.data ?? []
    );

    export const makeAllTasks = (projectId: number) => 
    createSelector(
      [taskApi.endpoints.getTasks.select({ projectId, params: { limit: 9999, offset: 0 } })],
      (tasksResult) => tasksResult?.data?.results ?? []
    );