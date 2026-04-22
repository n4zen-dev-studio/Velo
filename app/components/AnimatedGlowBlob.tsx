import React, { useEffect } from "react"
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated"
import { RadialGlowAnimated as RadialGlow } from "./RadialGlowAnimated"

type Props = {
  size: number
  innerColor: string
  glowColor: string
}

export function AnimatedGlowBlob({ size, innerColor, glowColor }: Props) {
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const sc = useSharedValue(1)
  const rot = useSharedValue(0)

  useEffect(() => {
    const ease = Easing.inOut(Easing.quad)

    tx.value = withRepeat(
      withSequence(
        withTiming(34, { duration: 6000, easing: ease }),
        withTiming(-28, { duration: 7000, easing: ease }),
        withTiming(18, { duration: 5500, easing: ease }),
      ),
      -1,
      false,
    )

    ty.value = withRepeat(
      withSequence(
        withTiming(-26, { duration: 6500, easing: ease }),
        withTiming(22, { duration: 7200, easing: ease }),
        withTiming(-14, { duration: 5200, easing: ease }),
      ),
      -1,
      false,
    )

    sc.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 5200, easing: ease }),
        withTiming(0.96, { duration: 5600, easing: ease }),
        withTiming(1.08, { duration: 6000, easing: ease }),
      ),
      -1,
      false,
    )

    rot.value = withRepeat(
      withSequence(
        withTiming(0.06, { duration: 7000, easing: ease }),
        withTiming(-0.05, { duration: 7600, easing: ease }),
        withTiming(0.03, { duration: 6800, easing: ease }),
      ),
      -1,
      false,
    )
  }, [])

  const a = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: sc.value },
      { rotateZ: `${rot.value}rad` },
    ],
  }))

  return (
    <Animated.View style={a}>
      <RadialGlow size={size} innerColor={innerColor} glowColor={glowColor} opacity={0.9} />

      <Animated.View style={{ position: "absolute", left: size * 0.12, top: size * 0.18, opacity: 0.65 }}>
        <RadialGlow size={Math.round(size * 0.85)} innerColor={innerColor} glowColor={glowColor} opacity={1} />
      </Animated.View>

      <Animated.View style={{ position: "absolute", left: -size * 0.10, top: size * 0.30, opacity: 0.5 }}>
        <RadialGlow size={Math.round(size * 0.72)} innerColor={innerColor} glowColor={glowColor} opacity={1} />
      </Animated.View>
    </Animated.View>
  )
}
