import { PropsWithChildren } from "react"
import { StyleProp, View, ViewStyle } from "react-native"

import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

interface GlassCardProps {
  style?: StyleProp<ViewStyle>
}

export function GlassCard({ children, style }: PropsWithChildren<GlassCardProps>) {
  const { themed } = useAppTheme()

  return <View style={[themed($card), style]}>{children}</View>
}

const $card: ThemedStyle<ViewStyle> = ({ colors, spacing, isDark }) => ({
  backgroundColor: isDark ? "rgba(30, 26, 36, 0.85)" : "rgba(255, 255, 255, 0.82)",
  borderColor: isDark ? colors.palette.neutral300 : colors.palette.neutral200,
  borderRadius: 20,
  borderWidth: 1,
  padding: spacing.md,
  shadowColor: colors.palette.neutral900,
  shadowOpacity: 0.1,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
})
