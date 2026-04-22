import React from "react"
import Svg, { Defs, RadialGradient, Stop, Rect } from "react-native-svg"

type RadialGlowProps = {
  size: number
  // center darkness
  innerColor: string
  // glow tint color (orange/pink etc)
  glowColor: string
  // fade to transparent
  opacity?: number
}

export function RadialGlowAnimated({ size, innerColor, glowColor, opacity = 1 }: RadialGlowProps) {
  return (
    <Svg width={size} height={size} style={{ opacity }}>
      <Defs>
        <RadialGradient id="g" cx="50%" cy="50%" rx="50%" ry="50%">
          {/* dark core */}
          <Stop offset="0%" stopColor={innerColor} stopOpacity={0.9} />
          {/* glow ring */}
          <Stop offset="35%" stopColor={glowColor} stopOpacity={0.35} />
          {/* fade out */}
          <Stop offset="100%" stopColor={glowColor} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#g)" />
    </Svg>
  )
}
