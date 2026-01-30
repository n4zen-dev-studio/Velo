import * as SecureStore from "expo-secure-store"

const ACCESS_TOKEN_KEY = "tasktrak.accessToken"
const REFRESH_TOKEN_KEY = "tasktrak.refreshToken"

export async function setTokens(accessToken: string, refreshToken: string) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken)
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken)
}

export async function setAccessToken(accessToken: string) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken)
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
