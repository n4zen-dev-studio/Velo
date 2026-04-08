import { Platform } from "react-native"
import Constants from "expo-constants"

import Config from "@/config"

const extra = (Constants.expoConfig?.extra ?? {}) as { apiBaseUrl?: string }

function resolveBaseUrl() {
  if (extra.apiBaseUrl) return extra.apiBaseUrl
  if (__DEV__ && Platform.OS === "android") return "https://velo-api.n4zen.dev"
  return Config.apiUrl
}

export const BASE_URL = resolveBaseUrl()
