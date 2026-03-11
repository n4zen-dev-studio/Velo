import { Image, ImageProps, ImageStyle, StyleProp, TextStyle, View, ViewStyle } from "react-native"

import { translate } from "@/i18n/translate"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

import { Button, ButtonProps } from "./Button"
import { GlassCard } from "./GlassCard"
import { Text, TextProps } from "./Text"

const sadFace = require("@assets/images/sad-face.png")

interface EmptyStateProps {
  preset?: "generic"
  style?: StyleProp<ViewStyle>
  imageSource?: ImageProps["source"]
  imageStyle?: StyleProp<ImageStyle>
  ImageProps?: Omit<ImageProps, "source">
  heading?: TextProps["text"]
  headingTx?: TextProps["tx"]
  headingTxOptions?: TextProps["txOptions"]
  headingStyle?: StyleProp<TextStyle>
  HeadingTextProps?: TextProps
  content?: TextProps["text"]
  contentTx?: TextProps["tx"]
  contentTxOptions?: TextProps["txOptions"]
  contentStyle?: StyleProp<TextStyle>
  ContentTextProps?: TextProps
  button?: TextProps["text"]
  buttonTx?: TextProps["tx"]
  buttonTxOptions?: TextProps["txOptions"]
  buttonStyle?: ButtonProps["style"]
  buttonTextStyle?: ButtonProps["textStyle"]
  buttonOnPress?: ButtonProps["onPress"]
  ButtonProps?: ButtonProps
}

export function EmptyState(props: EmptyStateProps) {
  const {
    theme: { spacing, colors },
  } = useAppTheme()

  const preset = {
    imageSource: sadFace,
    heading: translate("emptyStateComponent:generic.heading"),
    content: translate("emptyStateComponent:generic.content"),
    button: translate("emptyStateComponent:generic.button"),
  }

  const {
    button = preset.button,
    buttonTx,
    buttonOnPress,
    buttonTxOptions,
    content = preset.content,
    contentTx,
    contentTxOptions,
    heading = preset.heading,
    headingTx,
    headingTxOptions,
    imageSource = preset.imageSource,
    style: $containerStyleOverride,
    buttonStyle: $buttonStyleOverride,
    buttonTextStyle: $buttonTextStyleOverride,
    contentStyle: $contentStyleOverride,
    headingStyle: $headingStyleOverride,
    imageStyle: $imageStyleOverride,
    ButtonProps,
    ContentTextProps,
    HeadingTextProps,
    ImageProps,
  } = props

  return (
    <GlassCard style={$containerStyleOverride}>
      {imageSource ? (
        <Image
          source={imageSource}
          {...ImageProps}
          style={[$image, { marginBottom: spacing.sm }, $imageStyleOverride]}
          tintColor={colors.primary}
        />
      ) : null}
      <Text
        preset="subheading"
        text={heading}
        tx={headingTx}
        txOptions={headingTxOptions}
        {...HeadingTextProps}
        style={[$heading, $headingStyleOverride]}
      />
      <Text
        preset="formHelper"
        text={content}
        tx={contentTx}
        txOptions={contentTxOptions}
        {...ContentTextProps}
        style={[$content, $contentStyleOverride]}
      />
      {button ? (
        <Button
          onPress={buttonOnPress}
          text={button}
          tx={buttonTx}
          txOptions={buttonTxOptions}
          textStyle={$buttonTextStyleOverride}
          style={[{ marginTop: spacing.lg }, $buttonStyleOverride]}
          {...ButtonProps}
        />
      ) : null}
    </GlassCard>
  )
}

const $image: ImageStyle = { alignSelf: "center", width: 72, height: 72, resizeMode: "contain" }
const $heading: TextStyle = { textAlign: "center" }
const $content: TextStyle = { textAlign: "center" }
