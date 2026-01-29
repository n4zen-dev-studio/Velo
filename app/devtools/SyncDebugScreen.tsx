import { View, ViewStyle } from "react-native"

import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export function SyncDebugScreen() {
  const { themed } = useAppTheme()

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screen)}>
      <View style={themed($header)}>
        <Text preset="heading" text="Sync debug" />
        <Text preset="formHelper" text="Inspect local change log and sync state" />
      </View>

      <GlassCard>
        <Text preset="formLabel" text="Pending operations" />
        <Text preset="formHelper" text="12 queued · last attempt 5m ago" />
      </GlassCard>

      <GlassCard>
        <Text preset="formLabel" text="Sync cursor" />
        <Text preset="formHelper" text="cursor_2025_01_10_120000" />
      </GlassCard>

      <GlassCard>
        <Text preset="formLabel" text="Conflicts" />
        <Text preset="formHelper" text="2 unresolved" />
      </GlassCard>
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
