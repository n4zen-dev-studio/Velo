import { View, ViewStyle, TextStyle } from "react-native"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type StatusItem = {
  label: string
  value: number
  tone: string
}

export function DashboardTaskStatusChart(props: {
  items: StatusItem[]
  total: number
  completionLabel: string
}) {
  const { themed } = useAppTheme()
  const maxValue = Math.max(...props.items.map((item) => item.value), 1)

  return (
    <View style={themed($wrap)}>
      <View style={themed($overviewRow)}>
        <View style={themed($overviewCopy)}>
          <Text preset="caption" text="Execution mix" style={themed($muted)} />
          <Text preset="subheading" text={props.completionLabel} />
        </View>
        <Text preset="caption" text={`${props.total} total`} style={themed($summaryPill)} />
      </View>

      <View style={themed($stackedTrack)}>
        {props.items.map((item) => (
          <View
            key={item.label}
            style={[
              themed($stackedSlice(item.tone)),
              { flex: Math.max(item.value, item.value === 0 ? 0.35 : item.value) },
            ]}
          />
        ))}
      </View>

      <View style={themed($chartColumns)}>
        {props.items.map((item) => {
          const percent = props.total === 0 ? 0 : Math.round((item.value / props.total) * 100)
          return (
            <View key={item.label} style={themed($chartColumn)}>
              <View style={themed($columnHeader)}>
                <View style={[themed($legendDot), { backgroundColor: item.tone }]} />
                <Text preset="caption" text={item.label} style={themed($muted)} />
              </View>
              <Text preset="caption" text={`${item.value}`} style={themed($valueText)} />
              <View style={themed($barTrack)}>
                <View
                  style={[
                    themed($barFill(item.tone)),
                    {
                      height: `${Math.max((item.value / maxValue) * 100, item.value > 0 ? 18 : 0)}%`,
                    },
                  ]}
                />
              </View>
              <Text preset="caption" text={`${percent}%`} style={themed($muted)} />
            </View>
          )
        })}
      </View>
    </View>
  )
}

const $wrap: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $overviewRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
})

const $overviewCopy: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xxxs,
})

const $muted: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $summaryPill: ThemedStyle<TextStyle> = ({ colors, spacing, radius }) => ({
  color: colors.textMuted,
  overflow: "hidden",
  borderRadius: radius.pill,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xxxs,
})

const $stackedTrack: ThemedStyle<ViewStyle> = ({ colors, radius }) => ({
  flexDirection: "row",
  height: 14,
  borderRadius: radius.pill,
  backgroundColor: colors.backgroundSecondary,
  overflow: "hidden",
})

const $stackedSlice =
  (backgroundColor: string): ThemedStyle<ViewStyle> =>
  () => ({
    height: "100%",
    backgroundColor,
  })

const $chartColumns: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
})

const $chartColumn: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xs,
  alignItems: "center",
})

const $columnHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xxs,
})

const $legendDot: ThemedStyle<ViewStyle> = ({ radius }) => ({
  width: 8,
  height: 8,
  borderRadius: radius.pill,
})

const $valueText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  fontWeight: "700",
})

const $barTrack: ThemedStyle<ViewStyle> = ({ colors, radius }) => ({
  width: "100%",
  height: 22,
  borderRadius: radius.large,
  backgroundColor: colors.backgroundSecondary,
  overflow: "hidden",
  justifyContent: "flex-end",
})

const $barFill =
  (backgroundColor: string): ThemedStyle<ViewStyle> =>
  ({ radius }) => ({
    width: "100%",
    borderRadius: radius.large,
    backgroundColor,
  })
