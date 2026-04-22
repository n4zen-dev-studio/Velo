import { StyleSheet, View, ViewStyle } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { useAppTheme } from "@/theme/context"

import { AnimatedGlowBlob } from "./AnimatedGlowBlob"

interface AnimatedBackgroundProps {
  children: React.ReactNode
}

export const AnimatedBackground = ({ children }: AnimatedBackgroundProps) => {
  const { theme, themed } = useAppTheme()
  return (
    <View style={$container}>
      <LinearGradient
        colors={theme.isDark ? ["#1d1d44", "#150e1b"] : ["#edd8fe", "#e3e3e3"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={$base}
      />
      {theme.isDark && (
        <>
          <View style={$glowTopRight}>
            <AnimatedGlowBlob size={380} innerColor="#383863" glowColor="#527cdfb0" />
          </View>

          <View style={$glowMidLeft}>
            <AnimatedGlowBlob size={260} innerColor="#0f0f18" glowColor="#5b8cff" />
          </View>
        </>
      )}
      <View style={$glowBottomLeft}>
        <AnimatedGlowBlob size={340} innerColor="#050508" glowColor="#7d2e98" />
      </View>
      {<View style={{ flex: 1, zIndex: 1 }}>{children}</View>}
    </View>
  )
}

const $container: ViewStyle = {
  flex: 1,
  backgroundColor: "transparent",
}

const $base: ViewStyle = {
  ...StyleSheet.absoluteFillObject,
  zIndex: 0,
}

const $glowTopRight: ViewStyle = {
  position: "absolute",
  top: -120,
  right: -80,
  width: 320,
  height: 320,
  borderRadius: 160,
  zIndex: 0,
}

const $glowBottomLeft: ViewStyle = {
  position: "absolute",
  bottom: -140,
  left: -120,
  width: 280,
  height: 280,
  borderRadius: 140,
  zIndex: 0,
}

const $glowMidLeft: ViewStyle = {
  position: "absolute",
  top: "40%",
  left: -100,
  width: 260,
  height: 260,
  borderRadius: 130,
  zIndex: 0,
}
