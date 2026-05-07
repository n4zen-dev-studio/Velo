import { useState } from "react"
import { Modal, View, ViewStyle } from "react-native"
import { useNavigation } from "@react-navigation/native"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Switch } from "@/components/Toggle/Switch"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import { clearLocalData } from "@/services/db"
import { clearCurrentUserId, setSessionMode } from "@/services/sync/identity"
import { clearOfflineMode } from "@/services/storage/session"
import { goToAuth } from "@/navigation/navigationActions"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { useAuthViewModel } from "@/screens/AuthScreen/useAuthViewModel"

import { useSettingsViewModel } from "./useSettingsViewModel"

export function SettingsScreen() {
  const { themed } = useAppTheme()
  const { options } = useSettingsViewModel()
  const { logoutUser } = useAuthViewModel()
  const navigation = useNavigation<MainTabScreenProps<"SettingsTab">["navigation"]>()
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  const handleLogout = async () => {
    await logoutUser()
    setShowLogoutModal(true)
  }

  const handleKeepLocal = async () => {
    await setSessionMode("local")
    setShowLogoutModal(false)
    await clearOfflineMode()
    goToAuth()
  }

  const handleWipeLocal = async () => {
    await clearLocalData()
    await clearCurrentUserId()
    await setSessionMode("local")
    setShowLogoutModal(false)
    await clearOfflineMode()
    goToAuth()
  }

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screen)}>
      <View style={themed($header)}>
        <Text preset="heading" text="Settings" />
        <Text preset="formHelper" text="Control sync and offline preferences" />
      </View>

      <GlassCard>
        <View style={themed($stack)}>
          {options.map((option) => (
            <View key={option.id} style={themed($row)}>
              <Text preset="formLabel" text={option.label} />
              <Switch value={option.value} onValueChange={() => undefined} />
            </View>
          ))}
        </View>
      </GlassCard>

      <GlassCard>
        <Button text="Logout" preset="reversed" onPress={handleLogout} />
      </GlassCard>

      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={themed($backdrop)}>
          <GlassCard style={themed($modalCard)}>
            <Text preset="heading" text="Sign out" />
            <Text
              preset="formHelper"
              text="Choose what to do with your local data on this device."
            />
            <View style={themed($modalButtons)}>
              <Button text="Keep local data" preset="default" onPress={handleKeepLocal} />
              <Button text="Wipe local data" preset="reversed" onPress={handleWipeLocal} />
            </View>
          </GlassCard>
        </View>
      </Modal>
    </Screen>
  )
}

const $screen: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.lg,
  gap: spacing.lg,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
})

const $stack: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.md,
})

const $row: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  gap: spacing.sm,
})

const $backdrop: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  padding: 24,
  backgroundColor: colors.palette.overlay50,
})

const $modalCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  width: "100%",
  gap: spacing.md,
})

const $modalButtons: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})
