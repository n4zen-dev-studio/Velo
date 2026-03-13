import { useEffect, useRef } from "react"
import { AppState, Pressable, StyleSheet, View, ViewStyle, TextStyle } from "react-native"

import { Button } from "@/components/Button"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import {
  loadBiometricLockState,
  lockBiometricGate,
  promptForBiometricUnlock,
  useBiometricLock,
} from "@/services/security/biometricLock"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const { themed } = useAppTheme()
  const biometricLock = useBiometricLock()
  const hasPromptedRef = useRef(false)

  useEffect(() => {
    void loadBiometricLockState()
  }, [])

  useEffect(() => {
    if (!biometricLock.isLoaded || !biometricLock.enabled || !biometricLock.isLocked) return
    if (hasPromptedRef.current) return
    hasPromptedRef.current = true
    void promptForBiometricUnlock().finally(() => {
      hasPromptedRef.current = false
    })
  }, [biometricLock.enabled, biometricLock.isLoaded, biometricLock.isLocked])

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (!biometricLock.enabled) return
      if (nextState === "background" || nextState === "inactive") {
        lockBiometricGate()
        return
      }
      if (nextState === "active") {
        void promptForBiometricUnlock()
      }
    })
    return () => subscription.remove()
  }, [biometricLock.enabled])

  return (
    <View style={themed($container)}>
      {children}
      {biometricLock.enabled && biometricLock.isLocked ? (
        <View style={themed($overlay)}>
          <Screen preset="fixed" contentContainerStyle={themed($cardWrap)}>
            <View style={themed($card)}>
              <Text preset="overline" text="Locked" />
              <Text preset="heading" text="Unlock Velo" />
              <Text
                preset="caption"
                text={`${biometricLock.biometryLabel} protects local access to your workspace.`}
                style={themed($muted)}
              />
              <Button
                text={`Unlock with ${biometricLock.biometryLabel}`}
                preset="default"
                onPress={() => void promptForBiometricUnlock()}
              />
              <Pressable
                onPress={() => void promptForBiometricUnlock()}
                style={themed($subtleAction)}
              >
                <Text preset="caption" text="Try again" style={themed($muted)} />
              </Pressable>
            </View>
          </Screen>
        </View>
      ) : null}
    </View>
  )
}

const $container: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $overlay: ThemedStyle<ViewStyle> = ({ colors }) => ({
  ...StyleSheet.absoluteFillObject,
  backgroundColor: colors.overlay,
})

const $cardWrap: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  justifyContent: "center",
  paddingHorizontal: spacing.screenHorizontal,
})

const $card: ThemedStyle<ViewStyle> = ({ colors, spacing, radius, elevation }) => ({
  borderRadius: radius.xl,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surfaceElevated,
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.lg,
  gap: spacing.sm,
  ...elevation.card,
})

const $muted: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
})

const $subtleAction: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  paddingVertical: spacing.xs,
})
