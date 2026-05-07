import { Platform } from "react-native"
import Constants from "expo-constants"

import Config from "@/config"

const extra = (Constants.expoConfig?.extra ?? {}) as { apiBaseUrl?: string }

function resolveBaseUrl() {
  if (extra.apiBaseUrl) return extra.apiBaseUrl
  if (Platform.OS === "android") return "http://10.0.2.2:8080"
  return Config.apiUrl
}

export const BASE_URL = resolveBaseUrl()
