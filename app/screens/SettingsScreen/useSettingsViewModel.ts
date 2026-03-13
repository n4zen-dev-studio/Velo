import { useMemo } from "react"

import { useBiometricLock } from "@/services/security/biometricLock"

export type SettingsOptionId = "biometrics"

type Option = {
  id: SettingsOptionId
  label: string
  value: boolean
  helperText?: string
}

export const useSettingsViewModel = () => {
  const biometricLock = useBiometricLock()
  const values = useMemo(() => ({ biometrics: biometricLock.enabled }), [biometricLock.enabled])

  const options: Option[] = useMemo(
    () => [
      {
        id: "biometrics",
        label: "Unlock with biometrics",
        value: values.biometrics,
        helperText:
          biometricLock.support === "unsupported"
            ? "Biometric unlock is not available on this device."
            : biometricLock.support === "unenrolled"
              ? "Set up Face ID or fingerprint in device settings first."
              : "Biometric unlock protects local access to your workspace.",
      },
    ],
    [biometricLock.support, values],
  )

  return {
    options,
    values,
  }
}
