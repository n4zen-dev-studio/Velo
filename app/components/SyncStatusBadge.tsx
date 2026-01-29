import { View, ViewStyle } from "react-native"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export type SyncStatus = "synced" | "syncing" | "offline" | "error"

interface SyncStatusBadgeProps {
  status: SyncStatus
}

const statusLabel: Record<SyncStatus, string> = {
  synced: "Synced",
  syncing: "Syncing",
  offline: "Offline",
  error: "Error",
}

export function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
  const { themed } = useAppTheme()

  return (
    <View style={themed($badge)}>
      <View style={themed($dot(status))} />
      <Text preset="formLabel" text={statusLabel[status]} />
    </View>
  )
}

const $badge: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xxs,
  borderRadius: 999,
  backgroundColor: colors.palette.neutral100,
  borderWidth: 1,
  borderColor: colors.palette.neutral300,
  gap: spacing.xs,
})

const $dot = (status: SyncStatus): ThemedStyle<ViewStyle> => ({ colors }) => {
  const tint =
    status === "synced"
      ? colors.palette.primary400
      : status === "syncing"
        ? colors.palette.accent400
        : status === "offline"
          ? colors.palette.neutral500
          : colors.error

  return {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tint,
  }
}
