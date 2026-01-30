import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios"
import * as SecureStore from "expo-secure-store"

const ACCESS_TOKEN_KEY = "tasktrak.accessToken"
const REFRESH_TOKEN_KEY = "tasktrak.refreshToken"

export async function setTokens(accessToken: string, refreshToken: string) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken)
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken)
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY)
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)
}

export function createApiClient(baseURL: string) {
  const client: AxiosInstance = axios.create({ baseURL, timeout: 15000 })

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
      const refreshToken = await getRefreshToken()
      if (!refreshToken) return Promise.reject(error)

      try {
        const response = await client.post("/auth/refresh", { refreshToken })
        const { accessToken } = response.data
        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken)
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${accessToken}`,
        }
        return client(originalRequest)
      } catch (refreshError) {
        await clearTokens()
        return Promise.reject(refreshError)
      }
    },
  )

  return client
}
