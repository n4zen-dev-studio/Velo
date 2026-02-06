import React, { ComponentType } from "react"
import {
  Pressable,
  PressableProps,
  PressableStateCallbackType,
  StyleProp,
  TextStyle,
  View,
  ViewStyle,
} from "react-native"

import { useAppTheme } from "@/theme/context"
import { $styles } from "@/theme/styles"
import type { ThemedStyle, ThemedStyleArray } from "@/theme/types"

import { Text, TextProps } from "./Text"

type Presets = "default" | "filled" | "reversed" | "glass"

export interface ButtonAccessoryProps {
  style: StyleProp<any>
  pressableState: PressableStateCallbackType
  disabled?: boolean
}

export interface ButtonProps extends PressableProps {
  tx?: TextProps["tx"]
  text?: TextProps["text"]
  txOptions?: TextProps["txOptions"]
  style?: StyleProp<ViewStyle>
  pressedStyle?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  pressedTextStyle?: StyleProp<TextStyle>
  disabledTextStyle?: StyleProp<TextStyle>
  preset?: Presets
  RightAccessory?: ComponentType<ButtonAccessoryProps>
  LeftAccessory?: ComponentType<ButtonAccessoryProps>
  children?: React.ReactNode
  disabled?: boolean
  disabledStyle?: StyleProp<ViewStyle>
}
function isDarkFromColors(colors: any) {
  // Most Ignite themes use a dark background in dark mode
  // Fallback is safe and non-breaking
  const bg = colors.background ?? "#000"
  return bg.startsWith("#0") || bg.startsWith("#1") || bg.startsWith("#2")
}

/**
 * Glassy modern button:
 * - rounded pill
 * - subtle glass fill + stroke
 * - soft highlight overlay
 * - accent-filled variant
 */
export function Button(props: ButtonProps) {
  const {
    tx,
    text,
    txOptions,
    style: $viewStyleOverride,
    pressedStyle: $pressedViewStyleOverride,
    textStyle: $textStyleOverride,
    pressedTextStyle: $pressedTextStyleOverride,
    disabledTextStyle: $disabledTextStyleOverride,
    children,
    RightAccessory,
    LeftAccessory,
    disabled,
    disabledStyle: $disabledViewStyleOverride,
    ...rest
  } = props

  const { themed, theme } = useAppTheme()
  const isDark = theme.isDark

  const preset: Presets = props.preset ?? "glass"

  function $viewStyle({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> {
      const isGlass = preset === "glass"

    return [
      themed($viewPresets[preset]),
      $viewStyleOverride,
      isGlass && !isDark && $glassLightBoost,

      !!pressed && themed([$pressedViewPresets[preset], $pressedViewStyleOverride]),
      !!disabled && themed([$disabledViewPreset, $disabledViewStyleOverride as any]),
    ]
  }

  function $textStyle({ pressed }: PressableStateCallbackType): StyleProp<TextStyle> {
    return [
      themed($textPresets[preset]),
      $textStyleOverride,
      !!pressed && themed([$pressedTextPresets[preset], $pressedTextStyleOverride]),
      !!disabled && themed([$disabledTextPreset, $disabledTextStyleOverride as any]),
    ]
  }

  return (
    <Pressable
      style={$viewStyle}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      {...rest}
      disabled={disabled}
    >
      {(state) => (
        <>
          {/* subtle sheen overlay (no pointer events) */}
          <View pointerEvents="none" style={themed($sheenOverlay)} />

          {!!LeftAccessory && (
            <LeftAccessory style={$leftAccessoryStyle} pressableState={state} disabled={disabled} />
          )}

          <Text tx={tx} text={text} txOptions={txOptions} style={$textStyle(state)}>
            {children}
          </Text>

          {!!RightAccessory && (
            <RightAccessory style={$rightAccessoryStyle} pressableState={state} disabled={disabled} />
          )}
        </>
      )}
    </Pressable>
  )
}

const $baseViewStyle: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  minHeight: 48,
  borderRadius: 18,
  justifyContent: "center",
  alignItems: "center",
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.md,
  overflow: "hidden",
})

const $baseTextStyle: ThemedStyle<TextStyle> = ({ typography }) => ({
  fontSize: 15,
  lineHeight: 18,
  fontFamily: typography.primary.medium,
  textAlign: "center",
  flexShrink: 1,
  flexGrow: 0,
  zIndex: 2,
  letterSpacing: 0.2,
})

const $rightAccessoryStyle: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginStart: spacing.xs,
  zIndex: 2,
})
const $leftAccessoryStyle: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginEnd: spacing.xs,
  zIndex: 2,
})

/**
 * A subtle "sheen" for glassy feel.
 * Kept very light so it works in both light/dark themes.
 */
const $sheenOverlay: ThemedStyle<ViewStyle> = ({}) => ({
  position: "absolute",
  inset: 0,
  zIndex: 1,
  opacity: 0.9,
  backgroundColor: "rgba(255,255,255,0.03)",
})

const $glassLightBoost: ViewStyle = {
  // More visible glass on light backgrounds
  backgroundColor: "rgba(0,0,0,0.1)",
  borderColor: "rgba(0,0,0,0.04)",
  // opacity:1,

  // subtle lift so it reads like a component, not flat text
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 8 },
  // elevation: 5,
}

const $regularPurpleGlassView: ThemedStyle<ViewStyle> = ({ colors }) => {
  const isDark = isDarkFromColors(colors)

  const bg = isDark
    ? "rgba(190, 155, 255, 0.18)" // light purple glass on dark bg
    : "rgba(88, 52, 170, 0.22)"   // darker purple glass on light bg

  const border = isDark
    ? "rgba(230, 210, 255, 0.28)"
    : "rgba(88, 52, 170, 0.30)"

  return {
    borderWidth: 1,
    borderColor: border,
    backgroundColor: bg,

    shadowColor: "#000",
    shadowOpacity: isDark ? 0.22 : 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  }
}

const $regularPurpleGlassText: ThemedStyle<TextStyle> = ({ colors }) => {
  const isDark = isDarkFromColors(colors)

  return {
    color: isDark
      ? "rgba(255,255,255,0.94)"
      : "rgba(0,0,0,0.96)",
  }
}

const $regularPurpleGlassPressedView: ThemedStyle<ViewStyle> = ({ colors }) => {
  const isDark = isDarkFromColors(colors)

  return {
    backgroundColor: isDark
      ? "rgba(190, 155, 255, 0.26)"
      : "rgba(88, 52, 170, 0.30)",
    borderColor: isDark
      ? "rgba(240, 225, 255, 0.34)"
      : "rgba(88, 52, 170, 0.36)",
  }
}



const $viewPresets: Record<Presets, ThemedStyleArray<ViewStyle>> = {
  // ✅ regular presets now use purple glass styling
  default: [$styles.row, $baseViewStyle, $regularPurpleGlassView],
  filled: [$styles.row, $baseViewStyle, $regularPurpleGlassView],
  reversed: [$styles.row, $baseViewStyle, $regularPurpleGlassView],

  // ✅ KEEP THIS EXACTLY THE SAME AS YOU SAID
  glass: [
    $styles.row,
    $baseViewStyle,
    ({ colors }) => ({
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.14)",
      backgroundColor: colors.card ?? "rgba(255,255,255,0.1)",
    }),
  ],
}


// const $viewPresets: Record<Presets, ThemedStyleArray<ViewStyle>> = {
//   // keep legacy presets working
//   default: [
//     $styles.row,
//     $baseViewStyle,
//     ({ colors }) => ({
//       borderWidth: 1,
//       borderColor: colors.palette.neutral400,
//       backgroundColor: colors.palette.neutral100,
//     }),
//   ],
//   filled: [$styles.row, $baseViewStyle, ({ colors }) => ({ backgroundColor: colors.palette.neutral300 })],
//   reversed: [$styles.row, $baseViewStyle, ({ colors }) => ({ backgroundColor: colors.palette.neutral800 })],

//   /**
//    * ✅ Modern "glass" default:
//    * - translucent fill
//    * - thin bright stroke
//    * - uses your theme card/background values if present
//    */
//   glass: [
//     $styles.row,
//     $baseViewStyle,
//     ({ colors }) => ({
//       borderWidth: 1,
//       borderColor: "rgba(255,255,255,0.14)",
//       backgroundColor: colors.card ?? "rgba(255,255,255,0.1)",
//     }),
//   ],
// }

// const $textPresets: Record<Presets, ThemedStyleArray<TextStyle>> = {
//   default: [$baseTextStyle],
//   filled: [$baseTextStyle],
//   reversed: [$baseTextStyle, ({ colors }) => ({ color: colors.palette.neutral100 })],
//   glass: [
//     $baseTextStyle,
//     ({ colors }) => ({
//       color: colors.text ?? "rgba(255,255,255,0.92)",
//     }),
//   ],
// }

const $textPresets: Record<Presets, ThemedStyleArray<TextStyle>> = {
  default: [$baseTextStyle, $regularPurpleGlassText],
  filled: [$baseTextStyle, $regularPurpleGlassText],
  reversed: [$baseTextStyle, $regularPurpleGlassText],

  // ✅ KEEP THIS EXACTLY THE SAME
  glass: [
    $baseTextStyle,
    ({ colors }) => ({
      color: colors.text ?? "rgba(255,255,255,0.92)",
    }),
  ],
}


// const $pressedViewPresets: Record<Presets, ThemedStyle<ViewStyle>> = {
//   default: ({ colors }) => ({ backgroundColor: colors.palette.neutral200 }),
//   filled: ({ colors }) => ({ backgroundColor: colors.palette.neutral400 }),
//   reversed: ({ colors }) => ({ backgroundColor: colors.palette.neutral700 }),

//   /**
//    * Glass press: slightly brighter + subtle scale-ish feel (via padding/opacity)
//    */
//   glass: () => ({
//     backgroundColor: "rgba(0,0,0,0.12)",
//     borderColor: "rgba(255,255,255,0.18)",
//   }),
// }

const $pressedViewPresets: Record<Presets, ThemedStyle<ViewStyle>> = {
  default: $regularPurpleGlassPressedView,
  filled: $regularPurpleGlassPressedView,
  reversed: $regularPurpleGlassPressedView,

  // (you can keep yours as-is; this doesn’t change it)
  glass: () => ({
    backgroundColor: "rgba(0,0,0,0.12)",
    borderColor: "rgba(255,255,255,0.18)",
  }),
}

const $pressedTextPresets: Record<Presets, ThemedStyle<TextStyle>> = {
  default: () => ({ opacity: 0.9 }),
  filled: () => ({ opacity: 0.9 }),
  reversed: () => ({ opacity: 0.9 }),
  glass: () => ({ opacity: 0.92 }),
}

const $disabledViewPreset: ThemedStyle<ViewStyle> = () => ({
  opacity: 0.45,
})

const $disabledTextPreset: ThemedStyle<TextStyle> = () => ({
  opacity: 0.9,
})

/**
 * Optional: Add a "primary/glassFilled" behavior without creating a new preset
 * by passing style override like:
 * style={{ backgroundColor: theme.colors.tint, borderColor: "transparent" }}
 * textStyle={{ color: "rgba(0,0,0,0.85)" }}
 *
 * But if you DO want it as a preset, tell me and I’ll add `glassFilled`.
 */
