import { PropsWithChildren } from "react"
import { StyleProp, View, ViewStyle } from "react-native"

import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

interface GlassCardProps {
  style?: StyleProp<ViewStyle>
}

export function GlassCard({ children, style }: PropsWithChildren<GlassCardProps>) {
  const { themed } = useAppTheme()

  return (
    <View style={[themed($card), style]}>
      <View pointerEvents="none" style={themed($wash)} />
      {children}
    </View>
  )
}

const $card: ThemedStyle<ViewStyle> = ({ colors, spacing, radius, elevation }) => ({
  backgroundColor: colors.card,
  borderColor: colors.borderSubtle,
  borderRadius: radius.large,
  borderWidth: 1,
  padding: spacing.cardPadding,
  overflow: "hidden",
  position: "relative",
  ...elevation.card,
})

const $wash: ThemedStyle<ViewStyle> = ({ colors }) => ({
  position: "absolute",
  top: -70,
  right: -40,
  width: 160,
  height: 160,
  borderRadius: 999,
  backgroundColor: colors.glowSoft,
})
