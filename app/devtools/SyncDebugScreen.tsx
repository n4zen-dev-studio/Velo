import React, { useEffect, useMemo, useState } from "react"
import { Pressable, ScrollView, View, ViewStyle, TextStyle } from "react-native"

import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import {
  clearSentOps,
  countFailedOps,
  listFailedOps,
  listPendingOps,
  pruneSentOps,
  resetFailedToPending,
} from "@/services/db/repositories/changeLogRepository"
import { syncController } from "@/services/sync/SyncController"
import { refreshLocalCounts, useSyncStatus } from "@/services/sync/syncStore"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export function SyncDebugScreen() {
  const { themed } = useAppTheme()
  const syncState = useSyncStatus()

  const [pendingOps, setPendingOps] = useState([] as Awaited<ReturnType<typeof listPendingOps>>)
  const [failedOps, setFailedOps] = useState([] as Awaited<ReturnType<typeof listFailedOps>>)
  const [failedCount, setFailedCount] = useState(0)
  const [cursor, setCursor] = useState<string | null>(null)

  const load = async () => {
    const [pending, failed, failedTotal, syncStateRow] = await Promise.all([
      listPendingOps(50),
      listFailedOps(50),
      countFailedOps(),
      getSyncStateRow(),
    ])
    setPendingOps(pending)
    setFailedOps(failed)
    setFailedCount(failedTotal)
    setCursor(syncStateRow?.lastCursor ?? null)
    await refreshLocalCounts()
  }

  useEffect(() => {
    void load()
  }, [])

  // UX niceties: small derived labels; no functional changes
  const isOnlineLabel = syncState.isOnline ? "Online" : "Offline"
  const phaseLabel = String(syncState.phase ?? "—")
  const lastSyncedLabel = syncState.lastSyncedAt ?? "—"
  const hasError = !!syncState.lastError

  const topStats = useMemo(
    () => [
      { label: "Pending", value: `${syncState.pendingCount} queued` },
      { label: "Failed", value: `${failedCount} failed` },
      { label: "Conflicts", value: `${syncState.conflictCount} open` },
    ],
    [syncState.pendingCount, syncState.conflictCount, failedCount],
  )

  return (
    <Screen preset="scroll" safeAreaEdges={["top", "bottom"]} contentContainerStyle={themed($screen)}>
      {/* Header */}
      <View style={themed($header)}>
        <View style={themed($headerTop)}>
          <View style={themed($headerTitles)}>
            <Text preset="heading" text="Sync debug" />
            <Text preset="formHelper" text="Inspect local change log and sync state" />
          </View>

          {/* Connection chip */}
          <View style={themed(syncState.isOnline ? $chipOnline : $chipOffline)}>
            <View style={themed(syncState.isOnline ? $chipDotOnline : $chipDotOffline)} />
            <Text preset="formHelper" text={isOnlineLabel} style={themed($chipText)} />
          </View>
        </View>

        {hasError ? (
          <View style={themed($errorBanner)}>
            <Text preset="formHelper" text={`Last error: ${syncState.lastError}`} style={themed($errorText)} />
          </View>
        ) : null}
      </View>

      {/* Quick stats row (glassy cards, compact) */}
      <View style={themed($statsGrid)}>
        {topStats.map((s) => (
          <View key={s.label} style={themed($statsCell)}>
            <GlassCard>
              <View style={themed($statCard)}>
                <Text preset="formHelper" text={s.label} style={themed($muted)} />
                <Text preset="subheading" text={s.value} />
              </View>
            </GlassCard>
          </View>
        ))}
      </View>


      {/* Sync state (cursor, phase, last synced) */}
      <GlassCard>
        <View style={themed($cardHeaderRow)}>
          <Text preset="formLabel" text="Sync state" />
          <Text preset="formHelper" text={`Phase: ${phaseLabel}`} style={themed($muted)} />
        </View>

        <View style={themed($kv)}>
          <Text preset="formHelper" text="Cursor" style={themed($muted)} />
          <Text preset="formHelper" text={cursor ?? "—"} />
        </View>

        <View style={themed($kv)}>
          <Text preset="formHelper" text="Last synced" style={themed($muted)} />
          <Text preset="formHelper" text={lastSyncedLabel} />
        </View>
      </GlassCard>

      {/* Lists */}
      <GlassCard>
        <View style={themed($cardHeaderRow)}>
          <Text preset="formLabel" text="Pending ops" />
          <Text preset="formHelper" text={`${pendingOps.length} shown`} style={themed($muted)} />
        </View>

        <ScrollView style={themed($list)} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {pendingOps.length === 0 ? (
            <Text preset="formHelper" text="No pending ops." />
          ) : (
            pendingOps.map((op) => (
              <View key={op.opId} style={themed($row)}>
                <View style={themed($rowTop)}>
                  <Text preset="formLabel" text={`${op.entityType} · ${op.opType}`} style={themed($rowTitle)} />
                  <Text preset="formHelper" text={op.createdAt} style={themed($muted)} />
                </View>
                <Text preset="formHelper" text={`${op.entityId}`} style={themed($muted)} />
              </View>
            ))
          )}
        </ScrollView>
      </GlassCard>

      <GlassCard>
        <View style={themed($cardHeaderRow)}>
          <Text preset="formLabel" text="Failed ops" />
          <Text preset="formHelper" text={`${failedOps.length} shown`} style={themed($muted)} />
        </View>

        <ScrollView style={themed($list)} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {failedOps.length === 0 ? (
            <Text preset="formHelper" text="No failed ops." />
          ) : (
            failedOps.map((op) => (
              <View key={op.opId} style={themed($row)}>
                <View style={themed($rowTop)}>
                  <Text preset="formLabel" text={`${op.entityType} · ${op.opType}`} style={themed($rowTitle)} />
                  <Text preset="formHelper" text={`Attempts: ${op.attemptCount}`} style={themed($muted)} />
                </View>
                <Text preset="formHelper" text={`${op.entityId}`} style={themed($muted)} />
              </View>
            ))
          )}
        </ScrollView>
      </GlassCard>

      {/* Primary actions (better UX grouping; same handlers) */}
      <View style={themed($actionsBlock)}>
        <Text preset="formLabel" text="Actions" style={themed($actionsTitle)} />

        <View style={themed($buttonRow)}>
          <Pressable style={themed($button)} onPress={() => syncController.triggerSync("manual").then(load)}>
            <Text preset="formLabel" text="Trigger sync" style={themed($buttonPrimaryText)} />
          </Pressable>

          <Pressable style={themed($button)} onPress={() => resetFailedToPending().then(load)}>
            <Text preset="formLabel" text="Retry failed → pending" />
          </Pressable>
        </View>

        {__DEV__ ? (
          <View style={themed($buttonRow)}>
            <Pressable style={themed($button)} onPress={() => clearSentOps().then(load)}>
              <Text preset="formLabel" text="Clear SENT ops" />
            </Pressable>

            <Pressable style={themed($button)} onPress={() => pruneSentOps(2000, 7).then(load)}>
              <Text preset="formLabel" text="Prune SENT ops" />
            </Pressable>
          </View>
        ) : null}

        <Pressable
          style={themed($buttonFull)}
          onPress={async () => {
            const snapshot = await buildDebugSnapshot()
            console.log("[SYNC] Debug snapshot", snapshot)
          }}
        >
          <Text preset="formLabel" text="Export debug snapshot" />
          <Text preset="formHelper" text="Logs a compact snapshot to console" style={themed($muted)} />
        </Pressable>
      </View>
    </Screen>
  )
}

const $screen: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.lg,
  gap: spacing.lg,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $headerTop: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: spacing.md,
})

const $headerTitles: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xs,
})

const $statsRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
})

const $statsGrid: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.sm,
})

/**
 * 2 columns on most phones:
 * - each cell takes ~half width
 * - uses flexBasis to ensure wrapping
 */
const $statsCell: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexGrow: 1,
  flexBasis: "48%", // ~2 per row
  minWidth: 140, // prevents tiny cards on very narrow screens
})

const $statCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xxs,
})


const $muted: ThemedStyle<TextStyle> = () => ({
  opacity: 0.85,
})

const $cardHeaderRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: spacing.sm,
  marginBottom: spacing.xs,
})

const $kv: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  gap: spacing.md,
  paddingVertical: spacing.xs,
})

const $list: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  maxHeight: 200,
  marginTop: spacing.sm,
})

const $row: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  paddingVertical: spacing.sm,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
  gap: spacing.xxs,
})

const $rowTop: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: spacing.sm,
})

const $rowTitle: ThemedStyle<TextStyle> = () => ({
  flex: 1,
})

const $chipOnline: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.background,
})

const $chipOffline: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.background,
  opacity: 0.9,
})

const $chipDotOnline: ThemedStyle<ViewStyle> = () => ({
  width: 8,
  height: 8,
  borderRadius: 4,
  // no hard-coded colors; keeps theme-driven look via opacity only
  backgroundColor: "rgba(255,255,255,0.85)",
  opacity: 0.9,
})

const $chipDotOffline: ThemedStyle<ViewStyle> = () => ({
  width: 8,
  height: 8,
  borderRadius: 4,
  backgroundColor: "rgba(255,255,255,0.55)",
  opacity: 0.7,
})

const $chipText: ThemedStyle<TextStyle> = () => ({
  opacity: 0.9,
})

const $errorBanner: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  borderRadius: 16,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.background,
  padding: spacing.sm,
})

const $errorText: ThemedStyle<TextStyle> = () => ({
  opacity: 0.95,
})

const $actionsBlock: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $actionsTitle: ThemedStyle<TextStyle> = () => ({
  opacity: 0.9,
})

const $buttonRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
})

const $button: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.sm,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.background,
})

const $buttonPrimary: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.sm,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: colors.palette.primary500,
  backgroundColor: colors.palette.primary500,
})

const $buttonPrimaryText: ThemedStyle<TextStyle> = () => ({
  opacity: 1,
})

const $buttonFull: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: spacing.md,
  paddingHorizontal: spacing.md,
  borderRadius: 18,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.background,
  gap: spacing.xxs,
})

async function getSyncStateRow() {
  const { getDb } = await import("@/services/db/db")
  const { queryFirst } = await import("@/services/db/queries")
  const db = await getDb()
  return queryFirst<{ lastCursor: string | null }>(db, "SELECT lastCursor FROM sync_state WHERE id = ?", ["singleton"])
}

async function buildDebugSnapshot() {
  const { getDb } = await import("@/services/db/db")
  const { queryAll, queryFirst } = await import("@/services/db/queries")
  const db = await getDb()
  const syncState = await queryFirst(db, "SELECT * FROM sync_state WHERE id = ?", ["singleton"])
  const pendingCount = await queryFirst<{ count: number }>(
    db,
    "SELECT COUNT(1) as count FROM change_log WHERE status = 'PENDING'",
  )
  const failedCount = await queryFirst<{ count: number }>(
    db,
    "SELECT COUNT(1) as count FROM change_log WHERE status = 'FAILED'",
  )
  const conflictCount = await queryFirst<{ count: number }>(
    db,
    "SELECT COUNT(1) as count FROM conflicts WHERE status = 'OPEN'",
  )
  const changeLog = await queryAll(db, "SELECT * FROM change_log ORDER BY createdAt DESC LIMIT 20")
  const conflicts = await queryAll(db, "SELECT * FROM conflicts ORDER BY createdAt DESC LIMIT 5")
  return {
    syncState,
    counts: {
      pending: pendingCount?.count ?? 0,
      failed: failedCount?.count ?? 0,
      conflicts: conflictCount?.count ?? 0,
    },
    changeLog,
    conflicts,
  }
}
