import { PropsWithChildren } from "react"
import { StyleProp, View, ViewStyle } from "react-native"

import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { RadialGlow } from "./RadialGlow"

interface GlassCardProps {
  style?: StyleProp<ViewStyle>
}

export function GlassCard({ children, style }: PropsWithChildren<GlassCardProps>) {
  const { themed, theme } = useAppTheme()

  return (
    <View style={[themed($card), style]}>
      <RadialGlow
        width={160}
        height={190}
        color={theme.colors.glowSoft}
        opacity={0.2}
        style={themed($wash)}
      />
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

const $wash: ThemedStyle<ViewStyle> = () => ({
  position: "absolute",
  top: -70,
  right: -40,
  width: 160,
  height: 160,
})