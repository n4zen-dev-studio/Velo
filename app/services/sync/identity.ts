import * as Crypto from "expo-crypto"
import * as SecureStore from "expo-secure-store"

const DEVICE_ID_KEY = "tasktrak.deviceId"
const LOCAL_USER_ID_KEY = "tasktrak.localUserId"

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
