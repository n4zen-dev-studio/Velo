import React, { useEffect, useMemo, useState } from "react"
import { LayoutChangeEvent, View, ViewStyle, TextStyle } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  cancelAnimation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { Icon } from "./Icon"

// Worklet-safe clamp
const clampW = (v: number, min: number, max: number) => {
  "worklet"
  return Math.min(max, Math.max(min, v))
}

// Worklet-safe idle controls
const stopIdleW = (idle: Animated.SharedValue<number>) => {
  "worklet"
  cancelAnimation(idle)
  idle.value = 0
}

const startIdleW = (
  idle: Animated.SharedValue<number>,
  maxX: number,
  disabled?: boolean,
) => {
  "worklet"
  if (disabled) return
  const amp = maxX * 0.12
  if (amp <= 0) return
  idle.value = withRepeat(withTiming(amp, { duration: 1200 }), -1, true)
}

type SliderCTAProps = {
  text?: string
  onComplete: () => void
  completeAt?: number
  disabled?: boolean
}

export function SliderCTA({
  text = "Get Started",
  onComplete,
  completeAt = 0.85,
  disabled,
}: SliderCTAProps) {
  const { themed, theme } = useAppTheme()
  const colors = theme.colors

  const [trackW, setTrackW] = useState(0)

  const PAD = 10
  const THUMB = 46

  const maxX = Math.max(0, trackW - PAD * 2 - THUMB)

  // drag position [0..maxX]
  const x = useSharedValue(0)
  const startX = useSharedValue(0)

  // idle hint offset (adds to x when not dragging)
  const idle = useSharedValue(0)

  const dragging = useSharedValue(false)
  const completed = useSharedValue(false)
  const progress = useSharedValue(0) // 0..1

  // Start idle once width is known (JS thread -> ok)
  useEffect(() => {
    if (trackW > 0) {
      // Restart cleanly
      cancelAnimation(idle)
      idle.value = 0
      // Kick idle hint (UI worklets allowed here too)
      // but this runs on JS thread; assignment is fine
      const amp = maxX * 0.1
      if (!disabled && amp > 0) {
        idle.value = withRepeat(withTiming(amp, { duration: 1200 }), -1, true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackW, disabled, maxX])

  const onLayout = (e: LayoutChangeEvent) => {
    setTrackW(e.nativeEvent.layout.width)
  }

  const gesture = useMemo(() => {
    return Gesture.Pan()
      .enabled(!disabled)
      .onBegin(() => {
        if (completed.value) return
        dragging.value = true

        // stop idle hint while dragging (worklet-safe)
        stopIdleW(idle)

        cancelAnimation(x)
        startX.value = x.value
      })
      .onUpdate((evt) => {
        if (completed.value) return
        const next = clampW(startX.value + evt.translationX, 0, maxX)
        x.value = next
        progress.value = maxX === 0 ? 0 : next / maxX
      })
      .onEnd(() => {
        if (completed.value) return
        dragging.value = false

        const p = progress.value
        if (p >= completeAt) {
          completed.value = true

          x.value = withTiming(maxX, { duration: 180 }, (finished) => {
            if (finished) runOnJS(onComplete)()
          })
          progress.value = withTiming(1, { duration: 180 })
        } else {
          x.value = withSpring(0, { damping: 14, stiffness: 180 })
          progress.value = withTiming(0, { duration: 180 })

          // resume idle hint (worklet-safe)
          startIdleW(idle, maxX, disabled)
        }
      })
      .onFinalize(() => {
        dragging.value = false
      })
  }, [completeAt, disabled, maxX, onComplete])

  // Thumb: x + idle (only when not dragging)
  const thumbStyle = useAnimatedStyle(() => {
    const idleAdd = dragging.value || completed.value ? 0 : idle.value
    const tx = clampW(x.value + idleAdd, 0, maxX)
    const p = maxX === 0 ? 0 : tx / maxX

    const bg = interpolateColor(p, [0, 1], [colors.tint, colors.tintInactive])

    return {
      transform: [{ translateX: tx }],
      backgroundColor: bg,
      opacity: disabled ? 0.6 : 1,
    }
  })

  // Fill behind thumb
  const fillStyle = useAnimatedStyle(() => {
    const p = progress.value
    const w = interpolate(p, [0, 1], [THUMB + PAD * 2, trackW])
    const bg = interpolateColor(
      p,
      [0, 1],
      ["rgba(213,179,255,0.18)", "rgba(44,39,52,0.20)"],
    )
    return {
      width: w,
      backgroundColor: bg,
      opacity: disabled ? 0.5 : 1,
    }
  })

  // Label fades slightly
  const labelFade = useAnimatedStyle(() => {
    const p = progress.value
    return { opacity: interpolate(p, [0, 1], [1, 0.8]) }
  })

  return (
    <View onLayout={onLayout} style={themed($wrap)}>
      <View style={themed($track)}>
        <Animated.View style={[themed($fillBase), fillStyle]} />

        <Animated.View style={[themed($labelWrap), labelFade]} pointerEvents="none">
          <Text text={text} style={themed($label)} />
        </Animated.View>

        <View style={themed($chevWrap)} pointerEvents="none">
          <Text text="›››" style={themed($chev)} />
        </View>

        <GestureDetector gesture={gesture}>
          <Animated.View style={[themed($thumbBase), thumbStyle]}>
            <Text text="›" style={themed($thumbChevron)} />
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  )
}

/* ───────────────────────── styles ───────────────────────── */

const $wrap: ThemedStyle<ViewStyle> = () => ({ width: "100%" })

const $track: ThemedStyle<ViewStyle> = () => ({
  height: 64,
  borderRadius: 999,
  padding: 10,
  overflow: "hidden",
  justifyContent: "center",
  backgroundColor: "rgba(23,20,24,0.95)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
})

const $fillBase: ThemedStyle<ViewStyle> = () => ({
  position: "absolute",
  left: 0,
  top: 0,
  bottom: 0,
  borderRadius: 999,
})

const $labelWrap: ThemedStyle<ViewStyle> = () => ({
  position: "absolute",
  left: 0,
  right: 0,
  alignItems: "center",
  justifyContent: "center",
})

const $label: ThemedStyle<TextStyle> = () => ({
  color: "#FFFFFF",
  fontSize: 15,
  fontWeight: "700",
})

const $chevWrap: ThemedStyle<ViewStyle> = () => ({
  position: "absolute",
  right: 18,
  alignItems: "flex-end",
  justifyContent: "center",
})

const $chev: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontSize: 18,
  letterSpacing: 2,
  color: colors.palette.neutral600,
})

const $thumbBase: ThemedStyle<ViewStyle> = () => ({
  width: 46,
  height: 46,
  borderRadius: 23,
  alignItems: "center",
  justifyContent: "center",
})

const $thumbDot: ThemedStyle<ViewStyle> = () => ({
  width: 14,
  height: 14,
  borderRadius: 7,
  backgroundColor: "#FFFFFF",
})
const $thumbChevron: ThemedStyle<TextStyle> = () => ({
  color: "#FFFFFF",       // white icon
  fontSize: 30,           // icon size
  lineHeight: 26,
  fontWeight: "800",
  marginLeft: 2,          // optical centering
})