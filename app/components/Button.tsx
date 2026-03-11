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
    preset = "default",
    ...rest
  } = props

  const { themed } = useAppTheme()

  function $viewStyle({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> {
    return [
      themed($viewPresets[preset]),
      $viewStyleOverride,
      pressed && themed([$pressedViewPresets[preset], $pressedViewStyleOverride]),
      disabled && themed([$disabledViewPreset, $disabledViewStyleOverride as any]),
    ]
  }

  function $textStyle({ pressed }: PressableStateCallbackType): StyleProp<TextStyle> {
    return [
      themed($textPresets[preset]),
      $textStyleOverride,
      pressed && themed([$pressedTextPresets[preset], $pressedTextStyleOverride]),
      disabled && themed([$disabledTextPreset, $disabledTextStyleOverride as any]),
    ]
  }

  return (
    <Pressable
      style={$viewStyle}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      {...rest}
    >
      {(state) => (
        <>
          {preset === "default" ? (
            <>
              <View pointerEvents="none" style={themed($gradientWash)} />
              <View pointerEvents="none" style={themed($gradientBlobLeft)} />
              <View pointerEvents="none" style={themed($gradientBlobRight)} />
            </>
          ) : null}
          {preset === "glass" ? <View pointerEvents="none" style={themed($glassSheen)} /> : null}

          {!!LeftAccessory && (
            <LeftAccessory style={$leftAccessoryStyle} pressableState={state} disabled={disabled} />
          )}

          <Text tx={tx} text={text} txOptions={txOptions} style={$textStyle(state)}>
            {children}
          </Text>

          {!!RightAccessory && (
            <RightAccessory
              style={$rightAccessoryStyle}
              pressableState={state}
              disabled={disabled}
            />
          )}
        </>
      )}
    </Pressable>
  )
}

const $baseViewStyle: ThemedStyle<ViewStyle> = ({ spacing, radius }) => ({
  minHeight: 54,
  borderRadius: radius.pill,
  justifyContent: "center",
  alignItems: "center",
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.lg,
  overflow: "hidden",
  position: "relative",
})

const $baseTextStyle: ThemedStyle<TextStyle> = ({ typography }) => ({
  ...typography.roles.button,
  textAlign: "center",
  flexShrink: 1,
  zIndex: 2,
})

const $rightAccessoryStyle: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginStart: spacing.xs,
  zIndex: 2,
})

const $leftAccessoryStyle: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginEnd: spacing.xs,
  zIndex: 2,
})

const $gradientWash: ThemedStyle<ViewStyle> = ({ colors }) => ({
  ...$absoluteFill,
  backgroundColor: colors.primary,
  opacity: 0.26,
})

const $gradientBlobLeft: ThemedStyle<ViewStyle> = ({ colors }) => ({
  position: "absolute",
  left: -10,
  top: -16,
  width: 110,
  height: 110,
  borderRadius: 999,
  backgroundColor: colors.gradientStart,
  opacity: 0.92,
})

const $gradientBlobRight: ThemedStyle<ViewStyle> = ({ colors }) => ({
  position: "absolute",
  right: -18,
  top: -14,
  width: 130,
  height: 110,
  borderRadius: 999,
  backgroundColor: colors.gradientEnd,
  opacity: 0.88,
})

const $glassSheen: ThemedStyle<ViewStyle> = ({ colors }) => ({
  ...$absoluteFill,
  backgroundColor: colors.glowSoft,
  opacity: 0.55,
})

const $viewPresets: Record<Presets, ThemedStyleArray<ViewStyle>> = {
  default: [
    $styles.row,
    $baseViewStyle,
    ({ colors, elevation }) => ({
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.24)",
      ...elevation.glow,
    }),
  ],
  filled: [
    $styles.row,
    $baseViewStyle,
    ({ colors, elevation }) => ({
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      ...elevation.card,
    }),
  ],
  reversed: [
    $styles.row,
    $baseViewStyle,
    ({ colors }) => ({
      backgroundColor: colors.surfaceGlass,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    }),
  ],
  glass: [
    $styles.row,
    $baseViewStyle,
    ({ colors }) => ({
      backgroundColor: colors.surfaceGlass,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    }),
  ],
}

const $textPresets: Record<Presets, ThemedStyleArray<TextStyle>> = {
  default: [$baseTextStyle, ({ colors }) => ({ color: colors.textInverse })],
  filled: [$baseTextStyle, ({ colors }) => ({ color: colors.text })],
  reversed: [$baseTextStyle, ({ colors }) => ({ color: colors.text })],
  glass: [$baseTextStyle, ({ colors }) => ({ color: colors.text })],
}

const $pressedViewPresets: Record<Presets, ThemedStyle<ViewStyle>> = {
  default: () => ({ transform: [{ scale: 0.985 }], opacity: 0.96 }),
  filled: () => ({ transform: [{ scale: 0.985 }], opacity: 0.94 }),
  reversed: () => ({ transform: [{ scale: 0.985 }], opacity: 0.92 }),
  glass: () => ({ transform: [{ scale: 0.985 }], opacity: 0.92 }),
}

const $pressedTextPresets: Record<Presets, ThemedStyle<TextStyle>> = {
  default: () => ({ opacity: 0.98 }),
  filled: () => ({ opacity: 0.96 }),
  reversed: () => ({ opacity: 0.96 }),
  glass: () => ({ opacity: 0.96 }),
}

const $disabledViewPreset: ThemedStyle<ViewStyle> = () => ({
  opacity: 0.5,
})

const $disabledTextPreset: ThemedStyle<TextStyle> = () => ({
  opacity: 0.82,
})

const $absoluteFill: ViewStyle = {
  position: "absolute",
  inset: 0,
}
