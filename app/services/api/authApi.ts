import type { AxiosInstance } from "axios"

import { setTokens } from "./tokenStore"

export interface AuthResponse {
  accessToken: string
  refreshToken: string
}

export async function login(client: AxiosInstance, email: string, password: string) {
  try {
    const response = await client.post<AuthResponse>("/auth/login", { email, password })
    await setTokens(response.data.accessToken, response.data.refreshToken)
    return response.data
  } catch (error: any) {
    if (error.response?.status === 401) {
      const registered = await client.post<AuthResponse>("/auth/register", { email, password })
      await setTokens(registered.data.accessToken, registered.data.refreshToken)
      return registered.data
    }
    throw error
  }
}

export async function refreshToken(client: AxiosInstance, refreshToken: string) {
  const response = await client.post<{ accessToken: string }>("/auth/refresh", { refreshToken })
  return response.data.accessToken
}
