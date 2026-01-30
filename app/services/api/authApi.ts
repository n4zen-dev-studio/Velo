import type { AxiosInstance } from "axios"

import { setTokens } from "./apiClient"

export interface AuthResponse {
  accessToken: string
  refreshToken: string
}

export async function login(client: AxiosInstance, email: string, password: string) {
  const response = await client.post<AuthResponse>("/auth/login", { email, password })
  await setTokens(response.data.accessToken, response.data.refreshToken)
  return response.data
}

export async function refresh(client: AxiosInstance, refreshToken: string) {
  const response = await client.post<{ accessToken: string }>("/auth/refresh", { refreshToken })
  return response.data.accessToken
}
