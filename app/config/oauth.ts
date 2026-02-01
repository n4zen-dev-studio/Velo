import Constants from "expo-constants"

const extra = (Constants.expoConfig?.extra ?? {}) as {
  googleAndroidClientId?: string
  googleIosClientId?: string
  googleWebClientId?: string
}

export const googleOauth = {
  androidClientId: extra.googleAndroidClientId ?? "",
  iosClientId: extra.googleIosClientId ?? "",
  webClientId: extra.googleWebClientId ?? "",
}

export function isValidGoogleClientId(value: string) {
  if (!value) return false
  if (value.includes("your_")) return false
  return value.includes(".apps.googleusercontent.com")
}
