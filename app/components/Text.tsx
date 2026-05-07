import { ReactNode, forwardRef, ForwardedRef } from "react"
// eslint-disable-next-line no-restricted-imports
import { StyleProp, Text as RNText, TextProps as RNTextProps, TextStyle } from "react-native"
import { TOptions } from "i18next"

import { isRTL, TxKeyPath } from "@/i18n"
import { translate } from "@/i18n/translate"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle, ThemedStyleArray } from "@/theme/types"
import { typography } from "@/theme/typography"

type Sizes = keyof typeof $sizeStyles
type Weights = keyof typeof typography.primary
type Presets = "default" | "bold" | "heading" | "subheading" | "formLabel" | "formHelper"

export interface TextProps extends RNTextProps {
  tx?: TxKeyPath
  text?: string
  txOptions?: TOptions
  style?: StyleProp<TextStyle>
  preset?: Presets
  weight?: Weights
  size?: Sizes
  children?: ReactNode
}

export const Text = forwardRef(function Text(props: TextProps, ref: ForwardedRef<RNText>) {
  const { weight, size, tx, txOptions, text, children, style: $styleOverride, ...rest } = props
  const { themed } = useAppTheme()

  const i18nText = tx && translate(tx, txOptions)
  const content = i18nText || text || children

  const preset: Presets = props.preset ?? "default"
  const $styles: StyleProp<TextStyle> = [
    $rtlStyle,
    themed($presets[preset]),
    weight && $fontWeightStyles[weight],
    size && $sizeStyles[size],
    $styleOverride,
  ]

  return (
    <RNText {...rest} style={$styles} ref={ref}>
      {content}
    </RNText>
  )
})

/**
 * Slightly more modern typographic scale:
 * - headings not absurdly large
 * - tighter line height & subtle letterSpacing
 */
const $sizeStyles = {
  xxl: { fontSize: 30, lineHeight: 36 } satisfies TextStyle,
  xl: { fontSize: 24, lineHeight: 30 } satisfies TextStyle,
  lg: { fontSize: 18, lineHeight: 24 } satisfies TextStyle,
  md: { fontSize: 16, lineHeight: 22 } satisfies TextStyle,
  sm: { fontSize: 14, lineHeight: 20 } satisfies TextStyle,
  xs: { fontSize: 12, lineHeight: 18 } satisfies TextStyle,
  xxs: { fontSize: 11, lineHeight: 16 } satisfies TextStyle,
}

const $fontWeightStyles = Object.entries(typography.primary).reduce((acc, [w, fontFamily]) => {
  return { ...acc, [w]: { fontFamily } }
}, {}) as Record<Weights, TextStyle>

/**
 * Base stays theme-driven (important: used everywhere)
 */
const $baseStyle: ThemedStyle<TextStyle> = (theme) => ({
  ...$sizeStyles.sm,
  ...$fontWeightStyles.normal,
  color: theme.colors.text,
})

const $presets: Record<Presets, ThemedStyleArray<TextStyle>> = {
  default: [
    $baseStyle,
    {
      letterSpacing: 0.2,
    },
  ],

  bold: [
    $baseStyle,
    {
      ...$fontWeightStyles.bold,
      letterSpacing: 0.15,
    },
  ],

  heading: [
    $baseStyle,
    {
      ...$sizeStyles.xxl,
      ...$fontWeightStyles.bold,
      letterSpacing: -0.3,
    },
  ],

  subheading: [
    $baseStyle,
    {
      ...$sizeStyles.lg,
      ...$fontWeightStyles.medium,
      letterSpacing: -0.1,
    },
  ],

  formLabel: [
    $baseStyle,
    {
      ...$sizeStyles.sm,
      ...$fontWeightStyles.medium,
      letterSpacing: 0.15,
    },
  ],

  formHelper: [
    $baseStyle,
    {
      ...$sizeStyles.xs,
      ...$fontWeightStyles.normal,
      opacity: 0.85,
      letterSpacing: 0.2,
    },
  ],
}

const $rtlStyle: TextStyle = isRTL ? { writingDirection: "rtl" } : {}
