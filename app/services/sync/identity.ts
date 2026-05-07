import * as Crypto from "expo-crypto"
import * as SecureStore from "expo-secure-store"

const DEVICE_ID_KEY = "tasktrak.deviceId"
const LOCAL_USER_ID_KEY = "tasktrak.localUserId"
const LOCAL_SESSION_MODE_KEY = "tasktrak.sessionMode"

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

export async function generateUuidV4() {
  const bytes = await Crypto.getRandomBytesAsync(16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytesToHex(bytes)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`
}

export async function getDeviceId() {
  const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY)
  if (stored) return stored
  const nextId = await generateUuidV4()
  await SecureStore.setItemAsync(DEVICE_ID_KEY, nextId)
  return nextId
}

export async function getCurrentUserId() {
  const stored = await SecureStore.getItemAsync(LOCAL_USER_ID_KEY)
  if (stored) return stored
  const nextId = await generateUuidV4()
  await SecureStore.setItemAsync(LOCAL_USER_ID_KEY, nextId)
  return nextId
}

export async function setCurrentUserId(userId: string) {
  await SecureStore.setItemAsync(LOCAL_USER_ID_KEY, userId)
}

export async function deriveUserIdFromEmail(email: string) {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, email)
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(
    16,
    20,
  )}-${digest.slice(20, 32)}`
}

export async function setSessionMode(mode: "local" | "remote") {
  await SecureStore.setItemAsync(LOCAL_SESSION_MODE_KEY, mode)
}

export async function getSessionMode() {
  return SecureStore.getItemAsync(LOCAL_SESSION_MODE_KEY)
}

export async function clearCurrentUserId() {
  await SecureStore.deleteItemAsync(LOCAL_USER_ID_KEY)
}
