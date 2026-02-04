import { useCallback, useMemo, useState } from "react"

export type SettingsOptionId = "auto_sync" | "wifi_only" | "biometrics"

type Option = {
  id: SettingsOptionId
  label: string
  value: boolean
  helperText?: string
}

type SettingsState = Record<SettingsOptionId, boolean>

const DEFAULTS: SettingsState = {
  auto_sync: true,
  wifi_only: false,
  biometrics: false,
}

export const useSettingsViewModel = () => {
  const [values, setValues] = useState<SettingsState>(DEFAULTS)

  const setOption = useCallback((id: SettingsOptionId, value: boolean) => {
    setValues((prev) => {
      // no-op if unchanged (prevents extra re-renders)
      if (prev[id] === value) return prev
      return { ...prev, [id]: value }
    })
  }, [])

  const toggleOption = useCallback((id: SettingsOptionId) => {
    setValues((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const options: Option[] = useMemo(
    () => [
      {
        id: "auto_sync",
        label: "Auto-sync on launch",
        value: values.auto_sync,
      },
      {
        id: "wifi_only",
        label: "Sync on Wi-Fi only",
        value: values.wifi_only,
      },
      {
        id: "biometrics",
        label: "Unlock with biometrics",
        value: values.biometrics,
      },
    ],
    [values],
  )

  return {
    options,
    values, // optional: useful if other screens/services need to read them
    setOption,
    toggleOption,
  }
}
