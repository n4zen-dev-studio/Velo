import { ReactNode, forwardRef, ForwardedRef } from "react"
import { StyleProp, Text as RNText, TextProps as RNTextProps, TextStyle } from "react-native"
import { TOptions } from "i18next"

import { isRTL, TxKeyPath } from "@/i18n"
import { translate } from "@/i18n/translate"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle, ThemedStyleArray } from "@/theme/types"
import { typography } from "@/theme/typography"

type Sizes = keyof typeof $sizeStyles
type Weights = keyof typeof typography.primary
type Presets =
  | "default"
  | "bold"
  | "heading"
  | "subheading"
  | "formLabel"
  | "formHelper"
  | "display"
  | "sectionTitle"
  | "caption"
  | "overline"

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

const $sizeStyles = {
  xxl: { fontSize: 34, lineHeight: 40 } satisfies TextStyle,
  xl: { fontSize: 28, lineHeight: 34 } satisfies TextStyle,
  lg: { fontSize: 22, lineHeight: 28 } satisfies TextStyle,
  md: { fontSize: 17, lineHeight: 24 } satisfies TextStyle,
  sm: { fontSize: 15, lineHeight: 22 } satisfies TextStyle,
  xs: { fontSize: 13, lineHeight: 18 } satisfies TextStyle,
  xxs: { fontSize: 12, lineHeight: 16 } satisfies TextStyle,
}

const $fontWeightStyles = Object.entries(typography.primary).reduce((acc, [w, fontFamily]) => {
  return { ...acc, [w]: { fontFamily } }
}, {}) as Record<Weights, TextStyle>

const $baseStyle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  ...typography.roles.body,
  color: colors.text,
})

const $presets: Record<Presets, ThemedStyleArray<TextStyle>> = {
  default: [$baseStyle],
  bold: [$baseStyle, ({ typography }) => typography.roles.body, { ...$fontWeightStyles.bold }],
  heading: [$baseStyle, ({ typography }) => typography.roles.title1],
  subheading: [$baseStyle, ({ typography }) => typography.roles.title3],
  formLabel: [
    $baseStyle,
    ({ typography, colors }) => ({ ...typography.roles.label, color: colors.textMuted }),
  ],
  formHelper: [
    $baseStyle,
    ({ typography, colors }) => ({ ...typography.roles.bodySmall, color: colors.textDim }),
  ],
  display: [$baseStyle, ({ typography }) => typography.roles.display],
  sectionTitle: [$baseStyle, ({ typography }) => typography.roles.sectionTitle],
  caption: [
    $baseStyle,
    ({ typography, colors }) => ({ ...typography.roles.caption, color: colors.textDim }),
  ],
  overline: [
    $baseStyle,
    ({ typography, colors }) => ({
      ...typography.roles.overline,
      color: colors.textDim,
      textTransform: "uppercase",
    }),
  ],
}

const $rtlStyle: TextStyle = isRTL ? { writingDirection: "rtl" } : {}
