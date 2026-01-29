export const useSettingsViewModel = () => {
  return {
    options: [
      { id: "auto_sync", label: "Auto-sync on launch", value: true },
      { id: "wifi_only", label: "Sync on Wi-Fi only", value: false },
      { id: "biometrics", label: "Unlock with biometrics", value: false },
    ],
  }
}
