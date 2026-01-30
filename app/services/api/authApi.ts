import type { AxiosInstance } from "axios"

export interface AuthResponse {
  accessToken: string
  refreshToken: string
}

export async function login(client: AxiosInstance, email: string, password: string) {
  const response = await client.post<AuthResponse>("/auth/login", { email, password })
  return response.data
}

export async function refreshToken(client: AxiosInstance, refreshToken: string) {
  const response = await client.post<{ accessToken: string }>("/auth/refresh", { refreshToken })
  return response.data.accessToken
}

export async function signup(client: AxiosInstance, email: string, password: string) {
  const response = await client.post<{ ok: boolean; requiresEmailVerification: boolean }>(
    "/auth/signup",
    { email, password },
  )
  return response.data
}

export async function resendVerification(client: AxiosInstance, email: string) {
  const response = await client.post<{ ok: boolean }>("/auth/resend-verification", { email })
  return response.data
}
