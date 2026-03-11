import { Pressable, View, ViewStyle } from "react-native"
import { goToConflictList } from "@/navigation/navigationActions"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { deriveSyncBadgeState, useSyncStatus } from "@/services/sync/syncStore"
export function SyncBadge() {
  const { themed } = useAppTheme()
  const syncState = useSyncStatus()
  const badgeState = deriveSyncBadgeState(syncState)

  const label = (() => {
    if (badgeState === "offline") return "Offline"
    if (badgeState === "syncing") return "Syncing"
    if (badgeState === "error") return "Error"
    if (badgeState === "conflicts") return "Conflicts"
    if (badgeState === "pending") return `Pending · ${syncState.pendingCount}`
    return "Idle"
  })()

  return (
    <Pressable onPress={goToConflictList}>
      <View style={themed($badge)}>
        <View style={themed($dot(badgeState))} />
        <Text preset="formLabel" text={label} />
      </View>
    </Pressable>
  )
}

const $badge: ThemedStyle<ViewStyle> = ({ colors, spacing, isDark }) => ({
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xxs,
  borderRadius: 999,
  backgroundColor: isDark ? colors.surfaceGlass : colors.surfaceElevated,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  gap: spacing.xs,
})

const $dot =
  (state: ReturnType<typeof deriveSyncBadgeState>): ThemedStyle<ViewStyle> =>
  ({ colors }) => {
    const tint =
      state === "offline"
        ? colors.palette.neutral500
        : state === "syncing"
          ? colors.palette.accent400
          : state === "error"
            ? colors.error
            : state === "conflicts"
              ? colors.palette.primary400
              : colors.palette.primary300

    return {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: tint,
    }
  }
