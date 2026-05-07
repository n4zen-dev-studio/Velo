import * as SecureStore from "expo-secure-store"

const HAS_SEEN_ONBOARDING_KEY = "hasSeenOnboarding"

export async function hasSeenOnboarding() {
  const value = await SecureStore.getItemAsync(HAS_SEEN_ONBOARDING_KEY)
  return value === "1"
}

export async function setSeenOnboarding() {
  await SecureStore.setItemAsync(HAS_SEEN_ONBOARDING_KEY, "1")
}
