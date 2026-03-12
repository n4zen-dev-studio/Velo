import { useMemo, useRef, useState } from "react"
import {
  FlatList,
  Pressable,
  View,
  ViewStyle,
  TextStyle,
  NativeScrollEvent,
  NativeSyntheticEvent,
  useWindowDimensions,
  Image,
} from "react-native"
import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import LottieView from "lottie-react-native"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import type { RootStackParamList } from "@/navigators/navigationTypes"
import { setSeenOnboarding } from "@/services/storage/firstLaunch"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { LinearGradient } from "expo-linear-gradient"
import { RadialGlow } from "@/components/RadialGlow"

type ScreenProps = NativeStackScreenProps<RootStackParamList, "Onboarding">

const ROBOT_ANIM = require("@assets/animations/robot.json")
const SYNC_ANIM = require("@assets/animations/Computer-sharing.json")
const MOTION_ANIM = require("@assets/animations/launch-quickly.json")
const logo = require("@assets/images/logo.png")


type Slide = {
  id: string
  overline: string
  title: string
  body: string
  cta: string
  kind: "robot" | "offline" | "sync"
}

const SLIDES: Slide[] = [
  {
    id: "welcome",
    overline: "Welcome",
    title: "Welcome to Velo.\nMove work forward.",
    body: "Plan, track, and move work forward with a workspace built for focus.",
    cta: "Continue",
    kind: "robot",
  },
  {
    id: "offline",
    overline: "Offline-first",
    title: "Stay in motion offline.",
    body: "Keep creating and updating tasks locally. Velo keeps every change ready to sync when you are.",
    cta: "Continue",
    kind: "offline",
  },
  {
    id: "sync",
    overline: "Execution",
    title: "Sync when it matters.",
    body: "Organize projects, move tasks across stages, and sync your work when connection is available.",
    cta: "Get Started",
    kind: "sync",
  },
]

export function OnboardingScreen({ navigation }: ScreenProps) {
  const { themed, theme } = useAppTheme()
  const { width } = useWindowDimensions()
  const listRef = useRef<FlatList<Slide>>(null)
  const [index, setIndex] = useState(0)

  const slides = useMemo(() => SLIDES, [])

  const completeOnboarding = async () => {
    await setSeenOnboarding()
    navigation.replace("AuthGate")
  }

  const handleContinue = async () => {
    if (index === slides.length - 1) {
      await completeOnboarding()
      return
    }
    const nextIndex = index + 1
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true })
    setIndex(nextIndex)
  }

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width)
    if (Number.isFinite(nextIndex)) {
      setIndex(Math.max(0, Math.min(slides.length - 1, nextIndex)))
    }
  }

  return (
    <Screen
      preset="fixed"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={themed($screen)}
      style={themed($root)}
    >
      {/* <View style={themed($backgroundGlowTop)} pointerEvents="none" />
      <View style={themed($backgroundGlowBottom)} pointerEvents="none" /> */}
      <RadialGlow
        width={280}
        height={280}
        color={theme.colors.gradientStart}
        opacity={0.3}
        style={themed($backgroundGlowTop)}
      />

      <RadialGlow
        width={240}
        height={240}
        color={theme.colors.gradientEnd}
        opacity={0.24}
        style={themed($backgroundGlowBottom)}
      />

      <View style={themed($topBar)}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <View style={themed($brandPill)}>
            <Image source={logo} style={{width: 55, height: 55}} resizeMode='contain' />
          </View>
          <Text preset='heading' text="VELO" style={themed($brandText)} />
        </View>
        <Pressable onPress={() => void completeOnboarding()} hitSlop={12}>
          <Text preset="caption" text="Skip" style={themed($skipText)} />
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={handleMomentumEnd}
        renderItem={({ item }) => (
          <OnboardingSlide slide={item} width={width} isFirst={item.id === "welcome"} />
        )}
      />

      <View style={themed($footer)}>
        <Pagination count={slides.length} index={index} />
        <Button text={slides[index]?.cta} onPress={() => void handleContinue()} />
      </View>
    </Screen>
  )
}

function OnboardingSlide({
  slide,
  width,
  isFirst,
}: {
  slide: Slide
  width: number
  isFirst: boolean
}) {
  const { themed } = useAppTheme()

  return (
    <View style={[themed($page), { width }]}>
      <View style={themed($heroBlock(isFirst))}>
        <View style={themed($heroOrbPrimary(slide.kind))} pointerEvents="none" />
        <View style={themed($heroOrbSecondary)} pointerEvents="none" />
        <IllustrationHero kind={slide.kind} />
      </View>

      <View style={themed($copyBlock)}>
        <Text preset="overline" text={slide.overline} style={themed($slideOverline)} />
        <Text preset="display" text={slide.title} style={themed($slideTitle)} />
        <Text preset="body" text={slide.body} style={themed($slideBody)} />
      </View>
    </View>
  )
}

function IllustrationHero({ kind }: { kind: Slide["kind"] }) {
  const { themed } = useAppTheme()

  if (kind === "robot") {
    return (
      <View style={themed($robotCard)}>
        <View style={themed($robotFrame)}>
          <LottieView source={ROBOT_ANIM} autoPlay loop style={themed($robot)} />
        </View>
        <View style={themed($heroBadgeRow)}>
          <MiniBadge label="Offline-first" />
          <MiniBadge label="Focused flow" />
        </View>
      </View>
    )
  }

  return (
    <View style={themed($robotCard)}>
        <View style={themed($robotFrame)}>
          <LottieView source={kind !== "offline"?SYNC_ANIM: MOTION_ANIM} autoPlay loop style={themed($robot)} />
        </View>
        <View style={themed($heroBadgeRow)}>
        <MiniBadge label={kind === "offline" ? "Saved locally" : "Boards"} />
        <MiniBadge label={kind === "offline" ? "Sync later" : "Projects"} />
        </View>
      </View>
  )
}

function MiniBadge({ label }: { label: string }) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($miniBadge)}>
      <Text preset="caption" text={label} style={themed($miniBadgeText)} />
    </View>
  )
}

function Pagination({ count, index }: { count: number; index: number }) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($pagination)}>
      {Array.from({ length: count }).map((_, dotIndex) => (
        <View
          key={`dot-${dotIndex}`}
          style={[themed($paginationDot), dotIndex === index ? themed($paginationDotActive) : null]}
        />
      ))}
    </View>
  )
}

const $root: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flex: 1,
  backgroundColor: colors.background,
})

const $screen: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $backgroundGlowTop: ThemedStyle<ViewStyle> = () => ({
  position: "absolute",
  top: -120,
  right: -40,
  width: 280,
  height: 280,
})

const $backgroundGlowBottom: ThemedStyle<ViewStyle> = () => ({
  position: "absolute",
  left: -60,
  bottom: 120,
  width: 240,
  height: 240,
})

const $topBar: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: spacing.screenHorizontal,
  paddingTop: spacing.md,
  paddingBottom: spacing.sm,
})

const $brandPill: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  // paddingHorizontal: spacing.sm,
  // paddingVertical: spacing.xs,
  borderRadius: 99,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surfaceGlass,
})

const $brandText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  padding: 10,
})

const $skipText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
})

const $page: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  paddingHorizontal: spacing.screenHorizontal,
  paddingTop: spacing.xxxl+30,
  paddingBottom: spacing.lg,
  justifyContent: "space-between",
})

const $heroBlock =
  (isFirst: boolean): ThemedStyle<ViewStyle> =>
  ({ spacing, radius }) => ({
    minHeight: 360,
    borderRadius: radius.xl,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginTop: spacing.sm,
  })

const $heroOrbPrimary =
  (kind: Slide["kind"]): ThemedStyle<ViewStyle> =>
  ({ colors }) => ({
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor:
      kind === "robot"
        ? colors.gradientStart
        : kind !== "offline"
          ? colors.gradientMid
          : colors.gradientEnd,
    opacity: 0.24,
  })

const $heroOrbSecondary: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  position: "absolute",
  top: spacing.xxxl+60,
  width: 120,
  height: 120,
  borderRadius: 999,
  backgroundColor: colors.glowStrong,
  opacity: 0.3,
})

const $robotCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  width: "100%",
  alignItems: "center",
  gap: spacing.md,
})

const $robotFrame: ThemedStyle<ViewStyle> = ({ colors, radius }) => ({
  width: 240,
  height: 240,
  borderRadius: radius.xl,
  overflow: "hidden",
  alignItems: "center",
  justifyContent: "center",
  // backgroundColor: colors.surfaceGlass,
})

const $robot: ThemedStyle<ViewStyle> = () => ({
  width: 240,
  height: 240,
})

const $heroBadgeRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: spacing.xs,
})

const $placeholderCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  width: "100%",
  alignItems: "center",
  gap: spacing.md,
  paddingVertical: spacing.lg,
})

const $placeholderOrb =
  (kind: Slide["kind"]): ThemedStyle<ViewStyle> =>
  ({ colors }) => ({
    width: 164,
    height: 164,
    borderRadius: 999,
    backgroundColor: kind === "offline" ? colors.gradientMid : colors.gradientEnd,
    opacity: 0.9,
  })

const $placeholderPanel: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  width: "78%",
  borderRadius: radius.large,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  padding: spacing.md,
  gap: spacing.sm,
})

const $placeholderLineWide: ThemedStyle<ViewStyle> = ({ colors, radius }) => ({
  height: 12,
  borderRadius: radius.pill,
  backgroundColor: colors.surfaceElevated,
})

const $placeholderLineShort: ThemedStyle<ViewStyle> = ({ colors, radius }) => ({
  width: "66%",
  height: 12,
  borderRadius: radius.pill,
  backgroundColor: colors.surfaceElevated,
})

const $placeholderBadgeRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.xs,
})

const $miniBadge: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderStrong,
  backgroundColor: colors.surfaceGlass,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
})

const $miniBadgeText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
})

const $copyBlock: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  gap: spacing.sm,
  paddingHorizontal: spacing.md,
})

const $slideOverline: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.primary,
  textAlign: "center",
})

const $slideTitle: ThemedStyle<TextStyle> = () => ({
  textAlign: "center",
  fontSize: 34,
  lineHeight: 40,
})

const $slideBody: ThemedStyle<TextStyle> = ({ colors }) => ({
  textAlign: "center",
  color: colors.textMuted,
  maxWidth: 320,
})

const $footer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.screenHorizontal,
  paddingBottom: spacing.xl,
  gap: spacing.md,
})

const $pagination: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "center",
  gap: spacing.xs,
})

const $paginationDot: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 8,
  height: 8,
  borderRadius: 999,
  backgroundColor: colors.borderStrong,
  opacity: 0.6,
})

const $paginationDotActive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 24,
  backgroundColor: colors.primary,
  opacity: 1,
})
