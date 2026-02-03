import React, { useMemo, useRef, useState } from "react"
import { LayoutChangeEvent, Pressable, View, ViewStyle } from "react-native"
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated"

// Blur (optional; falls back automatically if not installed)
let BlurView: any = null
try {
  BlurView = require("expo-blur").BlurView
} catch {
  BlurView = null
}

import { Ionicons } from "@expo/vector-icons"
import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import { colors } from "@/theme/colors"

const PILL_HEIGHT = 66
const INDICATOR_SIZE = 53 // circle size
const INDICATOR_PADDING = 0 // inside pill padding

/**
 * ✅ Edit this to control the tab bar width.
 * - "auto" = full available width (default)
 * - number = fixed px width (e.g. 280)
 * - string = percentage (e.g. "70%")
 */
const TAB_BAR_WIDTH: number | string | "auto" = "55%"

/**
 * Optional: nudge indicator position if you want it slightly more left/right.
 * Usually keep 0.
 */
const INDICATOR_X_OFFSET = 0

export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme, themed } = useAppTheme()
  const insets = useSafeAreaInsets()

  // We track the actual pill width after layout (this includes TAB_BAR_WIDTH sizing)
  const [pillWidth, setPillWidth] = useState(0)
  const hasInitialized = useRef(false)

  // Accent color (your purple)
  const active = colors.palette.primary500  ?? colors.palette.primary500 ?? "#8B5CF6"
  const inactive = theme.colors.textDim ?? "rgba(255,255,255,0.65)"

  const glassFill = theme.isDark ? "rgba(255,255,255,0.1)":  "rgba(255,255,255,0.8)"
  const glassStroke =  theme.isDark ?"rgba(255,255,255,0.12)": "rgba(0,0,0,0.12)"

  const routes = state.routes
  const tabCount = routes.length

  // Shared value for the moving circle
  const translateX = useSharedValue(0)

  const tabs = useMemo(() => {
    return routes.map((route, index) => {
      const focused = state.index === index
      const options = descriptors[route.key]?.options ?? {}
      const label =
        options.tabBarLabel ?? options.title ?? (typeof route.name === "string" ? route.name : "Tab")

      // icon map (adjust freely)
      const iconName =
        route.name === "HomeTab"
          ? focused
            ? "home"
            : "home-outline"
          : route.name === "SettingsTab"
            ? focused
              ? "settings"
              : "settings-outline"
            : focused
              ? "bug"
              : "bug-outline"

      return { route, index, focused, label: String(label), iconName }
    })
  }, [routes, state.index, descriptors])

  const calcTargetX = (w: number, index: number) => {
    const tabWidth = w / tabCount
    const centerX = tabWidth * index + (tabWidth / 2 ) -2
    // indicator is absolutely positioned with left = INDICATOR_PADDING
    // so translateX should be relative to that "left" anchor
    return centerX - (INDICATOR_SIZE / 2 )-0+ INDICATOR_X_OFFSET
  }

  const onPillLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    setPillWidth(w)

    // ✅ First time: snap to the correct position (no long travel animation)
    translateX.value = calcTargetX(w, state.index)
    hasInitialized.current = true
  }

  // Whenever index changes and we know width, animate indicator (no overshoot)
  React.useEffect(() => {
    if (!pillWidth) return
    if (!hasInitialized.current) return

    const target = calcTargetX(pillWidth, state.index)

    translateX.value = withSpring(target, {
      damping: 22,
      stiffness: 260,
      overshootClamping: true,
      restDisplacementThreshold: 0.5,
      restSpeedThreshold: 0.5,
    })
  }, [state.index, pillWidth, tabCount])

  const indicatorStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    }
  })

  const bottomPad = Math.max(insets.bottom, 10)

  const PillContainer = BlurView ? BlurView : View

  const pillWidthStyle =
    TAB_BAR_WIDTH === "auto"
      ? null
      : typeof TAB_BAR_WIDTH === "number"
        ? { width: TAB_BAR_WIDTH }
        : { width: TAB_BAR_WIDTH as string } // e.g. "70%"

  return (
    <View pointerEvents="box-none" style={[themed($root), { paddingBottom: bottomPad }]}>
      <View style={[themed($pillShadowWrap), pillWidthStyle, { alignSelf: "center" }]}>
        <PillContainer
          // BlurView props
          {...(BlurView ? { intensity: 24, tint: "dark" } : {})}
          style={[
            themed($pill),
            {
              backgroundColor: glassFill,
              borderColor: glassStroke,
            },
          ]}
          onLayout={onPillLayout}
        >
          {/* Sliding circle indicator */}
          <Animated.View
            pointerEvents="none"
            style={[themed($indicator), { backgroundColor: active }, indicatorStyle]}
          />

          {/* Tabs row */}
          <View style={themed($row)}>
            {tabs.map((t) => {
              const onPress = () => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: t.route.key,
                  canPreventDefault: true,
                })
                if (!t.focused && !event.defaultPrevented) {
                  navigation.navigate(t.route.name)
                }
              }

              const onLongPress = () => {
                navigation.emit({ type: "tabLongPress", target: t.route.key })
              }

              return (
                <Pressable
                  key={t.route.key}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  style={themed($tabPressable)}
                  accessibilityRole="button"
                  accessibilityState={t.focused ? { selected: true } : {}}
                  accessibilityLabel={t.label}
                >
                  <View style={themed($tabInner)}>
                    <Ionicons
                      name={t.iconName}
                      size={20}
                      color={t.focused ?   theme.isDark? "rgba(255,255,255,0.85)" :"rgba(0,0,0,0.85)"  : inactive}
                    />
                    <Text
                      text={t.label}
                      style={[themed($label), { color: t.focused ? theme.isDark? "rgba(255,255,255,0.85)" :"rgba(0,0,0,0.85)"  : inactive }]}
                      numberOfLines={1}
                    />
                  </View>
                </Pressable>
              )
            })}
          </View>
        </PillContainer>
      </View>
    </View>
  )
}

const $root = ({ spacing }: any): ViewStyle => ({
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  paddingHorizontal: spacing?.md ?? 18,
  paddingTop: 10,
})

const $pillShadowWrap = (): ViewStyle => ({
  shadowColor: "#000",
  shadowOpacity: 0.35,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 18,
})

const $pill = (): ViewStyle => ({
  height: PILL_HEIGHT,
  borderRadius: 35,
  borderWidth: 1,
  paddingHorizontal: INDICATOR_PADDING,
  justifyContent: "center",
  overflow: "hidden",
//   borderColor: colors.palette.neutral900
})

const $indicator = (): ViewStyle => ({
  position: "absolute",
  left: INDICATOR_PADDING, // base; translateX moves it
  width: INDICATOR_SIZE,
  height: INDICATOR_SIZE,
  borderRadius: INDICATOR_SIZE / 2,
  top: (PILL_HEIGHT - INDICATOR_SIZE) / 2-1,
  shadowColor: "#000",
  shadowOpacity: 0.25,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 6 },
  elevation: 10,
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
  gap: 0,
})

const $label = (): any => ({
  fontSize: 10.5,
  letterSpacing: 0.2,
  lineHeight: 15,
})
