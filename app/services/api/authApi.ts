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

export async function signup(
  client: AxiosInstance,
  email: string,
  password: string,
  username?: string,
) {
  const response = await client.post<{ ok: boolean; requiresEmailVerification: boolean }>(
    "/auth/register",
    { email, password, username },
  )
  return response.data
}

export async function verifyEmail(client: AxiosInstance, email: string, code: string) {
  const response = await client.post<AuthResponse>("/auth/verify-email", { email, code })
  return response.data
}

export async function resendVerification(client: AxiosInstance, email: string) {
  const response = await client.post<{ ok: boolean }>("/auth/resend-verification", { email })
  return response.data
}

export async function logout(client: AxiosInstance, refreshToken: string) {
  await client.post("/auth/logout", { refreshToken })
}

export async function requestPasswordReset(client: AxiosInstance, email: string) {
  const response = await client.post<{ ok: boolean }>("/auth/request-password-reset", { email })
  return response.data
}

export async function confirmPasswordReset(
  client: AxiosInstance,
  email: string,
  code: string,
  newPassword: string,
) {
  const response = await client.post<{ ok: boolean }>("/auth/reset-password", {
    email,
    code,
    newPassword,
  })
  return response.data
}

export async function googleLogin(client: AxiosInstance, idToken: string) {
  const response = await client.post<AuthResponse>("/auth/google", { idToken })
  return response.data
}

export async function appleLogin(client: AxiosInstance, idToken: string) {
  const response = await client.post<AuthResponse>("/auth/apple", { idToken })
  return response.data
}
