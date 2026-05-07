import { Platform } from "react-native"
import Constants from "expo-constants"

import Config from "@/config"

const extra = (Constants.expoConfig?.extra ?? {}) as { apiBaseUrl?: string }

function resolveBaseUrl() {
  if (extra.apiBaseUrl) return extra.apiBaseUrl
  if (__DEV__ && Platform.OS === "android") return process.env.API_BASE_URL
  return Config.apiUrl
}

export const BASE_URL = resolveBaseUrl()
