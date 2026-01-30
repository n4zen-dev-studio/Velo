import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios"

import { getAccessToken, getRefreshToken, setAccessToken, clearTokens } from "./tokenStore"
import { refreshToken } from "./authApi"
import { setLastError } from "@/services/sync/syncStore"

export function createHttpClient(baseURL: string): AxiosInstance {
  const client = axios.create({ baseURL, timeout: 15000 })

  client.interceptors.request.use(async (config) => {
    const token = await getAccessToken()
    if (token) {
      config.headers = { ...config.headers, Authorization: `Bearer ${token}` }
    }
    return config
  })

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }
      if (error.response?.status !== 401 || originalRequest._retry) {
        return Promise.reject(error)
      }

      originalRequest._retry = true
      const token = await getRefreshToken()
      if (!token) return Promise.reject(error)

      try {
        const newAccessToken = await refreshToken(client, token)
        await setAccessToken(newAccessToken)
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${newAccessToken}`,
        }
        return client(originalRequest)
      } catch (refreshError) {
        await clearTokens()
        setLastError("Auth refresh failed; staying offline")
        return Promise.reject(refreshError)
      }
    },
  )

  return client
}
