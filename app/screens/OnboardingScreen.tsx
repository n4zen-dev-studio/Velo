import { useMemo } from "react"
import {
  ImageBackground,
  Pressable,
  View,
  ViewStyle,
  TextStyle,
  StyleSheet,
  Dimensions,
} from "react-native"
import type { NativeStackScreenProps } from "@react-navigation/native-stack"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { setSeenOnboarding } from "@/services/storage/firstLaunch"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import type { RootStackParamList } from "@/navigators/navigationTypes"
import { SliderCTA } from "@/components/SliderTCA"

type ScreenProps = NativeStackScreenProps<RootStackParamList, "Onboarding">

const onboardingMain = require("@assets/onboarding/onboarding-main.png")


export function OnboardingScreen({ navigation }: ScreenProps) {
  const { themed } = useAppTheme()

  return (
    // 1. Ensure Screen doesn't add padding and uses the full window
    <Screen 
      preset="fixed" 
      safeAreaEdges={[]} 
      contentContainerStyle={{ flex: 1 }} // Force the internal container to fill
      style={themed($root)}
    >
      <ImageBackground 
        source={onboardingMain} 
        resizeMode="cover" 
        // 2. Use style for the container, imageStyle for the actual bitmap
        style={StyleSheet.absoluteFill} 
        imageStyle={themed($bgImage)}
      >
        {/* 3. The Overlay must be absolute to stay behind text */}
        <View style={themed($overlay)} />
        {/* <View style={themed($bottomFade)} /> */}

        {/* 4. This container now controls the layout flow */}
        <View style={themed($mainContainer)}>
          <View style={themed($centerMarkWrap)} pointerEvents="none">
            <Text text="TaskTrak" style={themed($centerMark)} />
          </View>

          <View style={themed($content)}>
            <View style={themed($copy)}>
              <Text text={"Your Work.\nOrganized."} style={themed($title)} />
              <Text
                text="Offline-first task tracking with reliable sync and conflict resolution."
                style={themed($subtitle)}
              />
            </View>


            <SliderCTA
              text="Get Started"
              completeAt={0.85}
              onComplete={async () => {
                await setSeenOnboarding()
                navigation.replace("AuthGate")
              }}
            />
          </View>
        </View>
      </ImageBackground>
    </Screen>
  )
}


const $root: ThemedStyle<ViewStyle> = () => ({ 
  flex: 1, 
  backgroundColor: "#000",// Prevents white flashes
  zIndex: 0,
})

const $bgImage: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  zIndex: -3,
})

const $mainContainer: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  justifyContent: "flex-end", // Pushes content to bottom
})

const $overlay: ThemedStyle<ViewStyle> = ({ colors }) => ({
  ...StyleSheet.absoluteFillObject,
  backgroundColor: "rgba(0,0,0,0.5)",
  zIndex: -1,
})

const $bottomFade: ThemedStyle<ViewStyle> = () => ({
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: "100%",
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  zIndex: -1,
})

const $content: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.lg,
  paddingBottom: spacing.xl + 20, // Extra padding for home indicator
  gap: spacing.lg,
})

const $bg: ThemedStyle<ViewStyle> = () => ({ flex: 1 })



const $centerMarkWrap: ThemedStyle<ViewStyle> = () => ({
  position: "absolute",
  top: 0.2 * Dimensions.get("window").height,
  left: 0,
  right: 0,
  alignItems: "center",
})

const $centerMark: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontSize: 77,
  lineHeight: 130,
  fontWeight: "800",
  letterSpacing: -4,
  color: colors.palette.neutral100,
  opacity: 0.5,
})

const $copy: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
  maxWidth: 320,
})

const $title: ThemedStyle<TextStyle> = () => ({
  fontSize: 44,
  lineHeight: 46,
  fontWeight: "800",
  color: "#FFFFFF",
})

const $subtitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontSize: 14,
  lineHeight: 20,
  color: colors.palette.neutral500,
})

const $cta: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  height: 64,
  borderRadius: 999,
  paddingHorizontal: spacing.md,
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "rgba(23,20,24,0.95)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
})

const $ctaIcon: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 46,
  height: 46,
  borderRadius: 23,
  backgroundColor: colors.palette.primary300,
  alignItems: "center",
  justifyContent: "center",
})

const $ctaDot: ThemedStyle<ViewStyle> = () => ({
  width: 14,
  height: 14,
  borderRadius: 7,
  backgroundColor: "#FFFFFF",
})

const $ctaCenter: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  alignItems: "center",
})

const $ctaText: ThemedStyle<TextStyle> = () => ({
  color: "#FFFFFF",
  fontSize: 15,
  fontWeight: "700",
})

const $ctaRight: ThemedStyle<ViewStyle> = () => ({
  width: 52,
  alignItems: "flex-end",
})

const $ctaChevron: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontSize: 18,
  letterSpacing: 2,
  color: colors.palette.neutral600,
})

