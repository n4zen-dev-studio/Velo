import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { LayoutChangeEvent, Pressable, View, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import { ThemedStyle } from "@/theme/types"

import { RadialGlow } from "../RadialGlow"

let BlurView: any = null
try {
  BlurView = require("expo-blur").BlurView
} catch {
  BlurView = null
}

const PILL_HEIGHT = 72
const INDICATOR_PADDING = 6

export function GlassTabBar({
  state,
  descriptors,
  navigation,
  hidden = false,
}: BottomTabBarProps & { hidden?: boolean }) {
  const { theme, themed } = useAppTheme()
  const insets = useSafeAreaInsets()
  const [pillWidth, setPillWidth] = useState(0)
  const hasInitialized = useRef(false)
  const translateX = useSharedValue(0)
  const visibilityProgress = useSharedValue(hidden ? 0 : 1)

  const tabs = useMemo(() => {
    return state.routes.map((route, index) => {
      const focused = state.index === index
      const options = descriptors[route.key]?.options ?? {}
      const label = String(options.tabBarLabel ?? options.title ?? route.name)
      const iconName =
        route.name === "DashboardTab"
          ? focused
            ? "grid"
            : "grid-outline"
          : route.name === "ProjectsTab"
            ? focused
              ? "layers"
              : "layers-outline"
            : route.name === "SettingsTab"
              ? focused
                ? "settings"
                : "settings-outline"
              : focused
                ? "sync"
                : "sync-outline"

      return { route, index, focused, label, iconName }
    })
  }, [descriptors, state.index, state.routes])

  const calcTargetX = useCallback(
    (width: number, index: number) => {
      const tabWidth = width / state.routes.length
      return tabWidth * index + INDICATOR_PADDING
    },
    [state.routes.length],
  )

  const onPillLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width
    setPillWidth(width)
    translateX.value = calcTargetX(width, state.index)
    hasInitialized.current = true
  }

  useEffect(() => {
    if (!pillWidth || !hasInitialized.current) return
    translateX.value = withSpring(calcTargetX(pillWidth, state.index), {
      damping: 20,
      stiffness: 240,
      overshootClamping: true,
    })
  }, [calcTargetX, pillWidth, state.index, translateX])

  useEffect(() => {
    visibilityProgress.value = withTiming(hidden ? 0 : 1, {
      duration: hidden ? 170 : 220,
    })
  }, [hidden, visibilityProgress])

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  const rootAnimatedStyle = useAnimatedStyle(() => ({
    opacity: visibilityProgress.value,
    transform: [{ translateY: (1 - visibilityProgress.value) * 32 }],
  }))
  const indicatorWidth = pillWidth ? pillWidth / state.routes.length - INDICATOR_PADDING * 2 : 0
  const indicatorFrameStyle = useMemo(() => ({ width: indicatorWidth }), [indicatorWidth])

  const BlurContainer = BlurView ? BlurView : View

  return (
    <Animated.View
      pointerEvents={hidden ? "none" : "box-none"}
      style={[themed($root), { paddingBottom: Math.max(insets.bottom, 10) }, rootAnimatedStyle]}
    >
      <BlurContainer
        {...(BlurView
          ? { intensity: theme.isDark ? 42 : 70, tint: theme.isDark ? "dark" : "light" }
          : {})}
        style={themed($pill)}
        onLayout={onPillLayout}
      >
        <Animated.View
          pointerEvents="none"
          style={[themed($indicator), indicatorFrameStyle, indicatorStyle]}
        >
          {/* <View style={themed($indicatorGlowLeft)} />
          <View style={themed($indicatorGlowRight)} /> */}
          <RadialGlow
            width={30}
            height={80}
            color={theme.colors.gradientStart}
            opacity={0.9}
            style={themed($indicatorGlowLeft)}
          />

          <RadialGlow
            width={40}
            height={80}
            color={theme.colors.gradientEnd}
            opacity={0.9}
            style={themed($indicatorGlowRight)}
          />
        </Animated.View>

        <View style={themed($row)}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.route.key}
              onPress={() => {
                if (tab.focused) {
                  return
                }

                const event = navigation.emit({
                  type: "tabPress",
                  target: tab.route.key,
                  canPreventDefault: true,
                })

                if (!event.defaultPrevented) {
                  navigation.navigate(tab.route.name)
                }
              }}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: tab.route.key })}
              style={themed($tabPressable)}
              accessibilityRole="button"
              accessibilityState={tab.focused ? { selected: true } : {}}
              accessibilityLabel={tab.label}
            >
              <View style={themed($tabInner)}>
                <Ionicons
                  name={tab.iconName as any}
                  size={20}
                  color={tab.focused ? theme.colors.textInverse : theme.colors.textDim}
                />
                <Text
                  text={tab.label}
                  preset="caption"
                  style={{ color: tab.focused ? theme.colors.textInverse : theme.colors.textDim }}
                  numberOfLines={1}
                />
              </View>
            </Pressable>
          ))}
        </View>
      </BlurContainer>
    </Animated.View>
  )
}

const $root = ({ spacing }: any): ViewStyle => ({
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  paddingHorizontal: spacing.screenHorizontal,
  paddingTop: 10,
})

const $pill = ({ colors, radius, elevation }: any): ViewStyle => ({
  alignSelf: "center",
  width: "88%",
  height: PILL_HEIGHT,
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderStrong,
  backgroundColor: colors.surfaceGlass,
  justifyContent: "center",
  overflow: "hidden",
  ...elevation.floating,
})

const $indicator = ({ colors, radius }: any): ViewStyle => ({
  position: "absolute",
  top: INDICATOR_PADDING,
  bottom: INDICATOR_PADDING,
  left: 0,
  borderRadius: radius.pill,
  backgroundColor: colors.primary,
  overflow: "hidden",
})

const $indicatorGlowLeft: ThemedStyle<ViewStyle> = () => ({
  position: "absolute",
  left: -6,
  top: -10,
  width: 40,
  height: 80,
})

const $indicatorGlowRight: ThemedStyle<ViewStyle> = () => ({
  position: "absolute",
  right: -10,
  top: -10,
  width: 40,
  height: 80,
})

const $row = (): ViewStyle => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  height: PILL_HEIGHT,
})

const $tabPressable = (): ViewStyle => ({
  flex: 1,
  height: PILL_HEIGHT,
})

const $tabInner = (): ViewStyle => ({
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
})
