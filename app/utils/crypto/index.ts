import * as Crypto from "expo-crypto"
import * as SecureStore from "expo-secure-store"
import CryptoJS from "crypto-js"

const KEY_ALIAS = "tasktrak.encryption.v1"

function toWordArray(bytes: Uint8Array) {
  return CryptoJS.lib.WordArray.create(bytes as unknown as number[])
}

async function getOrCreateKey() {
  const stored = await SecureStore.getItemAsync(KEY_ALIAS)
  if (stored) return stored

  const randomBytes = await Crypto.getRandomBytesAsync(32)
  const key = CryptoJS.enc.Base64.stringify(toWordArray(randomBytes))
  await SecureStore.setItemAsync(KEY_ALIAS, key)
  return key
}

export async function encryptText(plainText: string) {
  const key = await getOrCreateKey()
  const ivBytes = await Crypto.getRandomBytesAsync(16)
  const iv = toWordArray(ivBytes)
  const keyWordArray = CryptoJS.enc.Base64.parse(key)
  const encrypted = CryptoJS.AES.encrypt(plainText, keyWordArray, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  })

  const ivString = CryptoJS.enc.Base64.stringify(iv)
  return `${ivString}:${encrypted.toString()}`
}

export async function decryptText(payload: string) {
  const key = await getOrCreateKey()
  const [ivString, ciphertext] = payload.split(":")
  if (!ivString || !ciphertext) return ""

  const iv = CryptoJS.enc.Base64.parse(ivString)
  const keyWordArray = CryptoJS.enc.Base64.parse(key)
  const decrypted = CryptoJS.AES.decrypt(ciphertext, keyWordArray, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  })

  return decrypted.toString(CryptoJS.enc.Utf8)
}
