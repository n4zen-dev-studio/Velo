import type { AxiosInstance } from "axios"

import type { SyncRequest, SyncResponse } from "@/services/sync/syncContract"

export async function sync(client: AxiosInstance, payload: SyncRequest) {
  const response = await client.post<SyncResponse>("/sync", payload)
  return response.data
}
