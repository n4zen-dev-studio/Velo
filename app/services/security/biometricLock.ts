import { useSyncExternalStore } from "react"
import * as LocalAuthentication from "expo-local-authentication"
import AsyncStorage from "@react-native-async-storage/async-storage"

const BIOMETRIC_LOCK_KEY = "tasktrak.biometricLockEnabled"

type SupportState = "unknown" | "available" | "unsupported" | "unenrolled"

type BiometricLockState = {
  isLoaded: boolean
  enabled: boolean
  isLocked: boolean
  support: SupportState
  biometryLabel: string
}

let state: BiometricLockState = {
  isLoaded: false,
  enabled: false,
  isLocked: false,
  support: "unknown",
  biometryLabel: "Biometrics",
}

const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function setState(next: Partial<BiometricLockState>) {
  state = { ...state, ...next }
  emit()
}

function getBiometryLabel(types: LocalAuthentication.AuthenticationType[]) {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return "Face ID"
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return "Fingerprint"
  return "Biometrics"
}

export async function loadBiometricLockState() {
  const enabled = (await AsyncStorage.getItem(BIOMETRIC_LOCK_KEY)) === "1"
  const hasHardware = await LocalAuthentication.hasHardwareAsync()
  const isEnrolled = hasHardware ? await LocalAuthentication.isEnrolledAsync() : false
  const types = hasHardware ? await LocalAuthentication.supportedAuthenticationTypesAsync() : []
  const support: SupportState = !hasHardware
    ? "unsupported"
    : !isEnrolled
      ? "unenrolled"
      : "available"

  const normalizedEnabled = enabled && support === "available"
  if (enabled !== normalizedEnabled) {
    await AsyncStorage.setItem(BIOMETRIC_LOCK_KEY, normalizedEnabled ? "1" : "0")
  }

  setState({
    isLoaded: true,
    enabled: normalizedEnabled,
    isLocked: normalizedEnabled,
    support,
    biometryLabel: getBiometryLabel(types),
  })
}

export async function setBiometricLockEnabled(enabled: boolean) {
  if (!enabled) {
    await AsyncStorage.setItem(BIOMETRIC_LOCK_KEY, "0")
    setState({ enabled: false, isLocked: false })
    return { ok: true as const }
  }

  const hasHardware = await LocalAuthentication.hasHardwareAsync()
  if (!hasHardware) {
    setState({ support: "unsupported" })
    throw new Error("Biometric unlock is not available on this device.")
  }

  const isEnrolled = await LocalAuthentication.isEnrolledAsync()
  if (!isEnrolled) {
    setState({ support: "unenrolled" })
    throw new Error("Set up Face ID or fingerprint in device settings to use biometric unlock.")
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Enable biometric unlock",
    cancelLabel: "Not now",
    disableDeviceFallback: false,
  })

  if (!result.success) {
    throw new Error("Biometric confirmation was cancelled or failed.")
  }

  await AsyncStorage.setItem(BIOMETRIC_LOCK_KEY, "1")
  setState({ enabled: true, isLocked: false, support: "available" })
  return { ok: true as const }
}

export async function promptForBiometricUnlock() {
  if (!state.enabled) return { success: true }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock Velo",
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  })

  setState({ isLocked: !result.success })
  return result
}

export function lockBiometricGate() {
  if (!state.enabled) return
  setState({ isLocked: true })
}

export function getBiometricLockState() {
  return state
}

export function subscribeBiometricLock(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useBiometricLock() {
  return useSyncExternalStore(subscribeBiometricLock, getBiometricLockState, getBiometricLockState)
}
