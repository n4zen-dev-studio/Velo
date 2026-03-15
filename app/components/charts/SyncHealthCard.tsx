import { View, ViewStyle, TextStyle } from "react-native"
import { LinearGradient } from "expo-linear-gradient"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type TrendPoint = {
  key: string
  label: string
  total: number
  successRate: number
}

export function SyncHealthCard(props: {
  healthPercent: number
  sent: number
  pending: number
  failed: number
  trend: TrendPoint[]
}) {
  const { themed, theme } = useAppTheme()
  const maxTotal = Math.max(...props.trend.map((point) => point.total), 1)

  return (
    <LinearGradient
      colors={
        theme.isDark
          ? ["rgba(71, 28, 92, 0.42)", "rgba(19, 8, 25, 0.69)"]
          : ["rgba(186, 120, 255, 0.16)", "rgba(255, 255, 255, 0.96)"]
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={themed($gradientCard)}
    >
      <View style={themed($topRow)}>
        <View style={themed($copy)}>
          <Text preset="caption" text="Sync health" style={themed($eyebrow)} />
          <Text preset="heading" text={`${props.healthPercent}%`} style={themed($heroValue)} />
          <Text
            preset="caption"
            text={`${props.sent} delivered · ${props.pending} queued`}
            style={themed($heroMeta)}
          />
        </View>
        <View style={themed($ringWrap)}>
          <View style={themed($ringTrack)}>
            <View style={[themed($ringFill), { width: `${props.healthPercent}%` }]} />
          </View>
        </View>
      </View>

      <View style={themed($trendRow)}>
        {props.trend.map((point) => (
          <View key={point.key} style={themed($trendColumn)}>
            <View style={themed($trendTrack)}>
              <View
                style={[
                  themed($trendFill),
                  {
                    height: `${Math.max((point.total / maxTotal) * 100, point.total > 0 ? 18 : 0)}%`,
                  },
                ]}
              />
            </View>
            <Text preset="caption" text={`${point.successRate}%`} style={themed($trendRate)} />
            <Text preset="caption" text={point.label} style={themed($heroMeta)} />
          </View>
        ))}
      </View>

      <View style={themed($metricRow)}>
        <MetricPill label="Pending" value={`${props.pending}`} />
        <MetricPill label="Failed" value={`${props.failed}`} />
        <MetricPill label="Sent" value={`${props.sent}`} />
      </View>
    </LinearGradient>
  )
}

function MetricPill(props: { label: string; value: string }) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($metricPill)}>
      <Text preset="caption" text={props.label} style={themed($heroMeta)} />
      <Text preset="caption" text={props.value} style={themed($metricValue)} />
    </View>
  )
}

const $gradientCard: ThemedStyle<ViewStyle> = ({ spacing, radius }) => ({
  borderRadius: radius.xl,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.md,
  gap: spacing.md,
  overflow: "hidden",
})

const $topRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: spacing.md,
})

const $copy: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxxs,
})

const $eyebrow: ThemedStyle<TextStyle> = ({ colors, isDark }) => ({
  color: isDark ? "rgba(226, 214, 255, 0.76)" : "rgba(109, 40, 217, 0.78)",
  textTransform: "uppercase",
})

const $heroValue: ThemedStyle<TextStyle> = ({  isDark }) => ({
  color: isDark ? "#FFFFFF" : "#1F1230",
})

const $heroMeta: ThemedStyle<TextStyle> = ({ colors, isDark }) => ({
  color: isDark ? "rgba(237, 221, 255, 0.72)" : "rgba(76, 29, 149, 0.72)",
})

const $ringWrap: ThemedStyle<ViewStyle> = () => ({
  width: 82,
  alignItems: "flex-end",
})

const $ringTrack: ThemedStyle<ViewStyle> = ({ isDark }) => ({
  width: "100%",
  height: 10,
  borderRadius: 999,
  backgroundColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(109, 40, 217, 0.12)",
  overflow: "hidden",
})

const $ringFill: ThemedStyle<ViewStyle> = ({ isDark }) => ({
  height: "100%",
  borderRadius: 999,
  backgroundColor: isDark ? "#bd66ff" : "#a855f7",
})

const $trendRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: spacing.xs,
})

const $trendColumn: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  alignItems: "center",
  gap: spacing.xxxs,
})

const $trendTrack: ThemedStyle<ViewStyle> = ({ isDark }) => ({
  width: "100%",
  height: 64,
  borderRadius: 16,
  backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(109, 40, 217, 0.08)",
  justifyContent: "flex-end",
  overflow: "hidden",
})

const $trendFill: ThemedStyle<ViewStyle> = ({ isDark }) => ({
  width: "100%",
  backgroundColor: isDark ? "#d064ff" : "#c084fc",
  borderRadius: 16,
})

const $trendRate: ThemedStyle<TextStyle> = ({ isDark }) => ({
  color: isDark ? "#FFFFFF" : "#2E1065",
  fontWeight: "700",
})

const $metricRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.xs,
})

const $metricPill: ThemedStyle<ViewStyle> = ({ isDark }) => ({
  flex: 1,
  borderRadius: 18,
  backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.72)",
  paddingHorizontal: 12,
  paddingVertical: 10,
})

const $metricValue: ThemedStyle<TextStyle> = ({ isDark }) => ({
  color: isDark ? "#FFFFFF" : "#2E1065",
  fontWeight: "700",
})