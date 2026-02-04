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
  backgroundColor: isDark ? colors.palette.neutral300 : colors.palette.neutral200,
  borderColor: isDark ? colors.palette.neutral300 : colors.palette.neutral200,
  borderRadius: 20,
  borderWidth: 1,
  padding: spacing.md,
  shadowColor: colors.palette.neutral800,
  shadowOpacity: 0.1,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 9 },
  elevation: 6,
})
