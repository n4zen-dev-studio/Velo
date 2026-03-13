import { View, ViewStyle, TextStyle } from "react-native"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type TimelineDay = {
  key: string
  label: string
}

type TimelineItem = {
  id: string
  title: string
  subtitle: string
  tone: string
  startIndex: number
  span: number
}

export function DashboardTimelineGraph(props: {
  days: TimelineDay[]
  items: TimelineItem[]
  emptyLabel: string
}) {
  const { themed } = useAppTheme()

  if (props.items.length === 0) {
    return (
      <View style={themed($emptyState)}>
        <Text preset="caption" text={props.emptyLabel} style={themed($muted)} />
      </View>
    )
  }

  return (
    <View style={themed($wrap)}>
      <View style={themed($headerRow)}>
        {props.days.map((day) => (
          <View key={day.key} style={themed($dayCell)}>
            <Text preset="caption" text={day.label} style={themed($muted)} />
          </View>
        ))}
      </View>

      <View style={themed($rows)}>
        {props.items.map((item) => (
          <View key={item.id} style={themed($itemRow)}>
            <View style={themed($itemCopy)}>
              <Text
                preset="caption"
                text={item.title}
                numberOfLines={1}
                style={themed($itemTitle)}
              />
              <Text
                preset="caption"
                text={item.subtitle}
                numberOfLines={1}
                style={themed($muted)}
              />
            </View>
            <View style={themed($track)}>
              <View
                style={[
                  themed($rangePill(item.tone)),
                  {
                    left: `${(item.startIndex / props.days.length) * 100}%`,
                    width: `${(item.span / props.days.length) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

const $wrap: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $headerRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.xxs,
  marginLeft: 112,
})

const $dayCell: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  alignItems: "center",
})

const $rows: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $itemRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
})

const $itemCopy: ThemedStyle<ViewStyle> = () => ({
  width: 104,
})

const $itemTitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  fontWeight: "600",
})

const $muted: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $track: ThemedStyle<ViewStyle> = ({ colors, radius }) => ({
  flex: 1,
  height: 38,
  borderRadius: radius.large,
  backgroundColor: colors.backgroundSecondary,
  position: "relative",
  overflow: "hidden",
})

const $rangePill =
  (backgroundColor: string): ThemedStyle<ViewStyle> =>
  ({ radius }) => ({
    position: "absolute",
    top: 5,
    bottom: 5,
    borderRadius: radius.large,
    backgroundColor,
    opacity: 0.9,
  })

const $emptyState: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.large,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.md,
})
