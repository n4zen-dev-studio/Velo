import { TouchableOpacity, View, ViewStyle } from "react-native"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { Ionicons } from "@expo/vector-icons"

import { useConflictResolutionViewModel } from "./useConflictResolutionViewModel"

export function ConflictResolutionScreen() {
  const { themed, theme } = useAppTheme()
  const { title, local, server } = useConflictResolutionViewModel()

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screen)}>
      <View style={themed($header)}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons
              name={"arrow-back"}
              size={25}
              color={theme.colors.text}
              style={{ padding: 5 }}
            />
          </TouchableOpacity>

          <Text preset="heading" text="Resolve conflict" />
        </View>
        <Text preset="formHelper" text={title} />
      </View>

      <View style={themed($grid)}>
        <GlassCard>
          <Text preset="subheading" text="Local" />
          <Text preset="formHelper" text={`Status: ${local.status}`} />
          <Text preset="formHelper" text={local.description} />
        </GlassCard>

        <GlassCard>
          <Text preset="subheading" text="Server" />
          <Text preset="formHelper" text={`Status: ${server.status}`} />
          <Text preset="formHelper" text={server.description} />
        </GlassCard>
      </View>

      <GlassCard>
        <Text preset="formLabel" text="Choose resolution" />
        <View style={themed($buttonRow)}>
          <Button text="Keep local" preset="default" />
          <Button text="Use server" preset="reversed" />
        </View>
        <View style={themed($buttonRow)}>
          <Button text="Merge fields" preset="default" />
        </View>
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

const $grid: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.md,
})

const $buttonRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
  marginTop: spacing.sm,
})
