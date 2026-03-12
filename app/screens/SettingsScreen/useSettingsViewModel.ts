import { useCallback, useMemo, useState } from "react"

export type SettingsOptionId = "biometrics"

type Option = {
  id: SettingsOptionId
  label: string
  value: boolean
  helperText?: string
}

type SettingsState = Record<SettingsOptionId, boolean>

const DEFAULTS: SettingsState = {
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
