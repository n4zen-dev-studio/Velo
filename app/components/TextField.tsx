// TextField.tsx — polished “glassy” TextField (focus ring, better padding, light-mode visibility)
// Functionality stays the same (same props, same behavior), UI is upgraded.

import { ComponentType, forwardRef, Ref, useImperativeHandle, useMemo, useRef, useState } from "react"
import {
  ImageStyle,
  Pressable,
  StyleProp,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native"

import { isRTL } from "@/i18n"
import { translate } from "@/i18n/translate"
import { useAppTheme } from "@/theme/context"
import { $styles } from "@/theme/styles"
import type { ThemedStyle, ThemedStyleArray } from "@/theme/types"

import { Text, TextProps } from "./Text"

export interface TextFieldAccessoryProps {
  style: StyleProp<ViewStyle | TextStyle | ImageStyle>
  status: TextFieldProps["status"]
  multiline: boolean
  editable: boolean
}

export interface TextFieldProps extends Omit<TextInputProps, "ref"> {
  status?: "error" | "disabled"
  label?: TextProps["text"]
  labelTx?: TextProps["tx"]
  labelTxOptions?: TextProps["txOptions"]
  LabelTextProps?: TextProps
  helper?: TextProps["text"]
  helperTx?: TextProps["tx"]
  helperTxOptions?: TextProps["txOptions"]
  HelperTextProps?: TextProps
  placeholder?: TextProps["text"]
  placeholderTx?: TextProps["tx"]
  placeholderTxOptions?: TextProps["txOptions"]
  style?: StyleProp<TextStyle>
  containerStyle?: StyleProp<ViewStyle>
  inputWrapperStyle?: StyleProp<ViewStyle>
  RightAccessory?: ComponentType<TextFieldAccessoryProps>
  LeftAccessory?: ComponentType<TextFieldAccessoryProps>
}

/**
 * Polished glass TextField:
 * - more padding + modern radius
 * - focus ring / error ring
 * - better light-mode contrast
 * - subtle “sheen” overlay
 */
export const TextField = forwardRef(function TextField(props: TextFieldProps, ref: Ref<TextInput>) {
  const {
    labelTx,
    label,
    labelTxOptions,
    placeholderTx,
    placeholder,
    placeholderTxOptions,
    helper,
    helperTx,
    helperTxOptions,
    status,
    RightAccessory,
    LeftAccessory,
    HelperTextProps,
    LabelTextProps,
    style: $inputStyleOverride,
    containerStyle: $containerStyleOverride,
    inputWrapperStyle: $inputWrapperStyleOverride,
    ...TextInputProps
  } = props

  const input = useRef<TextInput>(null)
  const [isFocused, setIsFocused] = useState(false)

  const { themed, theme } = useAppTheme()
  const colors = (theme as any)?.colors
  const isDark = (theme as any)?.isDark ?? (theme as any)?.dark ?? false

  const disabled = TextInputProps.editable === false || status === "disabled"

  const placeholderContent = placeholderTx ? translate(placeholderTx, placeholderTxOptions) : placeholder

  function focusInput() {
    if (disabled) return
    input.current?.focus()
  }

  useImperativeHandle(ref, () => input.current as TextInput)

  const showLabel = !!(label || labelTx || LabelTextProps?.children)
  const showHelper = !!(helper || helperTx || HelperTextProps?.children)

  const wrapperStateStyle = useMemo<StyleProp<ViewStyle>>(() => {
    if (disabled) return themed([$wrapperDisabled])
    if (status === "error") return themed([$wrapperError])
    if (isFocused) return themed([$wrapperFocused])
    return null
  }, [disabled, status, isFocused, themed])

  const lightBoostStyle = !isDark
    ? ({
        backgroundColor: "rgba(0,0,0,0.03)",
        borderColor: "rgba(0,0,0,0.10)",
      } satisfies ViewStyle)
    : null

  const $containerStyles = [$containerStyleOverride]

  const $labelStyles = themed([$labelStyle, LabelTextProps?.style])
  const $helperStyles = themed([
    $helperStyle,
    status === "error" && { color: colors?.error },
    HelperTextProps?.style,
  ])

  const $inputWrapperStyles = themed([
    $styles.row,
    $inputWrapperStyle,
    lightBoostStyle,
    wrapperStateStyle,
    TextInputProps.multiline && $multilineWrapper,
    LeftAccessory && $hasLeftAccessory,
    RightAccessory && $hasRightAccessory,
    $inputWrapperStyleOverride,
  ])

  const $inputStyles: ThemedStyleArray<TextStyle> = [
    $inputStyle,
    disabled && { color: colors?.textDim },
    isRTL && { textAlign: "right" as TextStyle["textAlign"] },
    TextInputProps.multiline && $multilineInput,
    $inputStyleOverride,
  ]

  return (
    <Pressable
      onPress={focusInput}
      style={$containerStyles}
      accessibilityState={{ disabled }}
      // keeps it feeling like a field, not a button
      android_ripple={undefined as any}
    >
      {showLabel ? (
        <View style={themed($labelRow)}>
          <Text
            preset="formLabel"
            text={label}
            tx={labelTx}
            txOptions={labelTxOptions}
            {...LabelTextProps}
            style={$labelStyles}
          />
        </View>
      ) : null}

      <View style={$inputWrapperStyles}>
        {!!LeftAccessory && (
          <LeftAccessory
            style={themed($leftAccessoryStyle)}
            status={status}
            editable={!disabled}
            multiline={TextInputProps.multiline ?? false}
          />
        )}

        <TextInput
          ref={input}
          underlineColorAndroid={colors?.transparent}
          textAlignVertical={TextInputProps.multiline ? "top" : "center"}
          placeholder={placeholderContent}
          placeholderTextColor={colors?.textDim}
          {...TextInputProps}
          editable={!disabled}
          onFocus={(e) => {
            setIsFocused(true)
            TextInputProps.onFocus?.(e)
          }}
          onBlur={(e) => {
            setIsFocused(false)
            TextInputProps.onBlur?.(e)
          }}
          style={themed($inputStyles)}
        />

        {!!RightAccessory && (
          <RightAccessory
            style={themed($rightAccessoryStyle)}
            status={status}
            editable={!disabled}
            multiline={TextInputProps.multiline ?? false}
          />
        )}

        {/* subtle glass sheen overlay */}
        <View pointerEvents="none" style={[themed($sheen), !isDark && $sheenLight]} />
      </View>

      {showHelper ? (
        <Text
          preset="formHelper"
          text={helper}
          tx={helperTx}
          txOptions={helperTxOptions}
          {...HelperTextProps}
          style={$helperStyles}
        />
      ) : null}
    </Pressable>
  )
})

/** Layout */
const $labelRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.xs,
})

const $labelStyle: ThemedStyle<TextStyle> = () => ({
  opacity: 0.95,
})

const $helperStyle: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginTop: spacing.xs,
  opacity: 0.85,
})

/** Wrapper base */
const $inputWrapperStyle: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  borderWidth: 1,
  borderRadius: 18,
  overflow: "hidden",

  // comfortable touch + iOS-like padding
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,

  // dark-mode glass baseline
  backgroundColor: colors.card ?? "rgba(255,255,255,0.06)",
  borderColor: "rgba(255,255,255,0.14)",
})

/** Focus / Error / Disabled rings */
const $wrapperFocused: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.palette.primary400 ?? "rgba(255,255,255,0.22)",
  backgroundColor: "rgba(255,255,255,0.08)",
  shadowColor: colors.palette.primary500 ?? "#000",
  shadowOpacity: 0.14,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
})

const $wrapperError: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.error,
  shadowColor: colors.error,
  shadowOpacity: 0.12,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
})

const $wrapperDisabled: ThemedStyle<ViewStyle> = () => ({
  opacity: 0.6,
})

/** Input text */
const $inputStyle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  flex: 1,
  alignSelf: "stretch",
  fontFamily: typography.primary.normal,
  color: colors.text,
  fontSize: 15,
  lineHeight: 20,

  // cleaner vertical rhythm
  paddingVertical: 0,
  paddingHorizontal: 0,
  margin: 0,
})

const $multilineWrapper: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "flex-start",
  paddingVertical: spacing.md,
  minHeight: 120,
})

const $multilineInput: ThemedStyle<TextStyle> = () => ({
  height: "auto",
})

/** Accessories */
const $leftAccessoryStyle: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginEnd: spacing.sm,
  justifyContent: "center",
  alignItems: "center",
})

const $rightAccessoryStyle: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginStart: spacing.sm,
  justifyContent: "center",
  alignItems: "center",
})

const $hasLeftAccessory: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingStart: spacing.sm,
})

const $hasRightAccessory: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingEnd: spacing.sm,
})

/** Sheen overlay */
const $sheen: ThemedStyle<ViewStyle> = () => ({
  position: "absolute",
  inset: 0,
  backgroundColor: "rgba(255,255,255,0.06)",
  opacity: 0.6,
})

const $sheenLight: ViewStyle = {
  backgroundColor: "rgba(255,255,255,0.45)",
  opacity: 0.85,
}
