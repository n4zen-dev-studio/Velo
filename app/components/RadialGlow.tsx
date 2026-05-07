import React from "react"
import { ViewStyle } from "react-native"
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg"

type RadialGlowProps = {
  width: number
  height: number
  color: string
  opacity?: number
  style?: ViewStyle
}

export function RadialGlow({
  width,
  height,
  color,
  opacity = 1,
  style,
}: RadialGlowProps) {
  return (
    <Svg
      pointerEvents="none"
      width={width}
      height={height}
      style={[
        {
          position: "absolute",
          overflow: "visible",
        },
        style,
      ]}
    >
      <Defs>
        {/* <RadialGradient id="glow" cx="42%" cy="38%" rx="55%" ry="55%"> */}
        <RadialGradient id="glow" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
          <Stop offset="35%" stopColor={color} stopOpacity={opacity * 0.7} />
          <Stop offset="70%" stopColor={color} stopOpacity={opacity * 0.2} />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Rect x="0" y="0" width={width} height={height} fill="url(#glow)" />
    </Svg>
  )
}