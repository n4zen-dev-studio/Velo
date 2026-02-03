import AsyncStorage from "@react-native-async-storage/async-storage"

const ACCESS_TOKEN_KEY = "accessToken"
const REFRESH_TOKEN_KEY = "refreshToken"
const OFFLINE_MODE_KEY = "offlineMode"

export async function getAccessToken() {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY)
}

export async function getRefreshToken() {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY)
}

export async function setAccessToken(token: string) {
  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export async function setRefreshToken(token: string) {
  await AsyncStorage.setItem(REFRESH_TOKEN_KEY, token)
}

export async function clearSession() {
  await AsyncStorage.removeItem(ACCESS_TOKEN_KEY)
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY)
}

export async function hasSession() {
  const refreshToken = await getRefreshToken()
  return !!refreshToken
}

export async function setOfflineMode(enabled: boolean) {
  await AsyncStorage.setItem(OFFLINE_MODE_KEY, enabled ? "1" : "0")
}

export async function clearOfflineMode() {
  await AsyncStorage.removeItem(OFFLINE_MODE_KEY)
}

export async function isOfflineMode() {
  const value = await AsyncStorage.getItem(OFFLINE_MODE_KEY)
  return value === "1"
}
