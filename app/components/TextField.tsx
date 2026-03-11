import { ComponentType, forwardRef, Ref, useImperativeHandle, useRef, useState } from "react"
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
  const { colors } = theme

  const disabled = TextInputProps.editable === false || status === "disabled"
  const placeholderContent = placeholderTx
    ? translate(placeholderTx, placeholderTxOptions)
    : placeholder

  function focusInput() {
    if (!disabled) input.current?.focus()
  }

  useImperativeHandle(ref, () => input.current as TextInput)

  const showLabel = !!(label || labelTx || LabelTextProps?.children)
  const showHelper = !!(helper || helperTx || HelperTextProps?.children)

  const wrapperStateStyle = disabled
    ? themed($wrapperDisabled)
    : status === "error"
      ? themed($wrapperError)
      : isFocused
        ? themed($wrapperFocused)
        : null

  const $inputWrapperStyles = themed([
    $styles.row,
    $inputWrapperStyle,
    wrapperStateStyle,
    TextInputProps.multiline && $multilineWrapper,
    LeftAccessory && $hasLeftAccessory,
    RightAccessory && $hasRightAccessory,
    $inputWrapperStyleOverride,
  ])

  const $inputStyles: ThemedStyleArray<TextStyle> = [
    $inputStyle,
    disabled && { color: colors.textDim },
    isRTL && { textAlign: "right" as TextStyle["textAlign"] },
    TextInputProps.multiline && $multilineInput,
    $inputStyleOverride,
  ]

  return (
    <Pressable
      onPress={focusInput}
      style={$containerStyleOverride}
      accessibilityState={{ disabled }}
    >
      {showLabel ? (
        <Text
          preset="formLabel"
          text={label}
          tx={labelTx}
          txOptions={labelTxOptions}
          {...LabelTextProps}
          style={themed([$labelStyle, LabelTextProps?.style])}
        />
      ) : null}

      <View style={$inputWrapperStyles}>
        <View pointerEvents="none" style={themed($fieldWash)} />

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
          underlineColorAndroid={colors.transparent}
          textAlignVertical={TextInputProps.multiline ? "top" : "center"}
          placeholder={placeholderContent}
          placeholderTextColor={colors.textDim}
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
      </View>

      {showHelper ? (
        <Text
          preset="formHelper"
          text={helper}
          tx={helperTx}
          txOptions={helperTxOptions}
          {...HelperTextProps}
          style={themed([
            $helperStyle,
            status === "error" && { color: colors.error },
            HelperTextProps?.style,
          ])}
        />
      ) : null}
    </Pressable>
  )
})

const $labelStyle: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.xs,
})

const $helperStyle: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginTop: spacing.xs,
})

const $inputWrapperStyle: ThemedStyle<ViewStyle> = ({ colors, spacing, radius, elevation }) => ({
  alignItems: "center",
  borderWidth: 1,
  borderRadius: radius.medium,
  overflow: "hidden",
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  backgroundColor: colors.surface,
  borderColor: colors.borderSubtle,
  position: "relative",
  ...elevation.card,
})

const $wrapperFocused: ThemedStyle<ViewStyle> = ({ colors, elevation }) => ({
  borderColor: colors.primary,
  backgroundColor: colors.surfaceElevated,
  ...elevation.glow,
})

const $wrapperError: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.error,
})

const $wrapperDisabled: ThemedStyle<ViewStyle> = () => ({
  opacity: 0.55,
})

const $fieldWash: ThemedStyle<ViewStyle> = ({ colors }) => ({
  position: "absolute",
  top: -40,
  right: -10,
  width: 120,
  height: 120,
  borderRadius: 999,
  backgroundColor: colors.glowSoft,
  opacity: 0.8,
})

const $inputStyle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  flex: 1,
  alignSelf: "stretch",
  ...typography.roles.body,
  color: colors.text,
  paddingVertical: 0,
  paddingHorizontal: 0,
  margin: 0,
})

const $multilineWrapper: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "flex-start",
  paddingVertical: spacing.md,
  minHeight: 132,
})

const $multilineInput: ThemedStyle<TextStyle> = () => ({
  height: "auto",
})

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
