import { useEffect, useMemo, useState } from "react"
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
import { formatDateTime } from "@/utils/dateFormat"

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
  const lastSyncedLabel = formatDateTime(syncState.lastSyncedAt) ?? "—"
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
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={themed($screen)}
    >
      <View style={themed($header)}>
        <View style={themed($headerTop)}>
          <View style={themed($headerTitles)}>
            <Text preset="overline" text="Debug" />
            <Text preset="heading" text="Sync console" />
            <Text
              preset="caption"
              text="Inspect queued operations, sync state, and recovery tools."
              style={themed($muted)}
            />
          </View>
          <View style={themed(syncState.isOnline ? $chipOnline : $chipOffline)}>
            <View style={themed(syncState.isOnline ? $chipDotOnline : $chipDotOffline)} />
            <Text preset="caption" text={isOnlineLabel} style={themed($chipText)} />
          </View>
        </View>

        {hasError ? (
          <View style={themed($errorBanner)}>
            <Text
              preset="caption"
              text={`Last error: ${syncState.lastError}`}
              style={themed($errorText)}
            />
          </View>
        ) : null}
      </View>

      <View style={themed($statsGrid)}>
        {topStats.map((s) => (
          <CompactStatTile key={s.label} label={s.label} value={s.value} />
        ))}
      </View>

      <GlassCard>
        <View style={themed($cardHeaderRow)}>
          <Text preset="formLabel" text="Sync state" />
          <Text preset="caption" text={`Phase: ${phaseLabel}`} style={themed($muted)} />
        </View>

        <View style={themed($infoGrid)}>
          <CompactInfoRow label="Cursor" value={cursor ?? "—"} />
          <CompactInfoRow label="Last synced" value={lastSyncedLabel} />
        </View>
      </GlassCard>

      <GlassCard>
        <View style={themed($cardHeaderRow)}>
          <Text preset="formLabel" text="Pending ops" />
          <Text preset="caption" text={`${pendingOps.length} shown`} style={themed($muted)} />
        </View>

        <ScrollView style={themed($list)} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {pendingOps.length === 0 ? (
            <Text preset="caption" text="No pending ops." style={themed($muted)} />
          ) : (
            pendingOps.map((op) => (
              <CompactOpRow
                key={op.opId}
                title={`${op.entityType} · ${op.opType}`}
                meta={op.createdAt}
                detail={`${op.entityId}`}
              />
            ))
          )}
        </ScrollView>
      </GlassCard>

      <GlassCard>
        <View style={themed($cardHeaderRow)}>
          <Text preset="formLabel" text="Failed ops" />
          <Text preset="caption" text={`${failedOps.length} shown`} style={themed($muted)} />
        </View>

        <ScrollView style={themed($list)} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {failedOps.length === 0 ? (
            <Text preset="caption" text="No failed ops." style={themed($muted)} />
          ) : (
            failedOps.map((op) => (
              <CompactOpRow
                key={op.opId}
                title={`${op.entityType} · ${op.opType}`}
                meta={`Attempts: ${op.attemptCount}`}
                detail={`${op.entityId}`}
              />
            ))
          )}
        </ScrollView>
      </GlassCard>

      <GlassCard>
        <View style={themed($cardHeaderRow)}>
          <Text preset="formLabel" text="Actions" />
          <Text preset="caption" text="Recovery and diagnostics" style={themed($muted)} />
        </View>

        <View style={themed($actionGrid)}>
          <CompactActionTile
            label="Trigger sync"
            helper="Run a manual sync"
            onPress={() => syncController.triggerSync("manual").then(load)}
            emphasis="primary"
          />
          <CompactActionTile
            label="Retry failed"
            helper="Move failed ops back to pending"
            onPress={() => resetFailedToPending().then(load)}
          />
          {__DEV__ ? (
            <>
              <CompactActionTile
                label="Clear sent"
                helper="Remove SENT ops"
                onPress={() => clearSentOps().then(load)}
              />
              <CompactActionTile
                label="Prune sent"
                helper="Trim old SENT ops"
                onPress={() => pruneSentOps(2000, 7).then(load)}
              />
            </>
          ) : null}
          <CompactActionTile
            label="Export snapshot"
            helper="Log a compact snapshot to console"
            onPress={async () => {
              const snapshot = await buildDebugSnapshot()
              console.log("[SYNC] Debug snapshot", snapshot)
            }}
          />
        </View>
      </GlassCard>
    </Screen>
  )
}

function CompactStatTile({ label, value }: { label: string; value: string }) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($statsCell)}>
      <View style={themed($statTile)}>
        <Text preset="caption" text={label} style={themed($muted)} />
        <Text preset="caption" text={value} style={themed($statValue)} />
      </View>
    </View>
  )
}

function CompactInfoRow({ label, value }: { label: string; value: string }) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($kv)}>
      <Text preset="caption" text={label} style={themed($muted)} />
      <Text preset="caption" text={value} numberOfLines={2} style={themed($rowTitle)} />
    </View>
  )
}

function CompactOpRow({ title, meta, detail }: { title: string; meta: string; detail: string }) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($row)}>
      <View style={themed($rowTop)}>
        <Text preset="caption" text={title} style={themed($rowTitle)} />
        <Text preset="caption" text={meta} style={themed($muted)} />
      </View>
      <Text preset="caption" text={detail} style={themed($muted)} numberOfLines={2} />
    </View>
  )
}

function CompactActionTile(props: {
  label: string
  helper: string
  onPress: () => void | Promise<void>
  emphasis?: "primary" | "default"
}) {
  const { themed } = useAppTheme()
  return (
    <Pressable
      style={[
        themed($actionTile),
        props.emphasis === "primary" ? themed($actionTilePrimary) : null,
      ]}
      onPress={props.onPress}
    >
      <Text
        preset="caption"
        text={props.label}
        style={
          props.emphasis === "primary" ? themed($actionTileTextPrimary) : themed($actionTileText)
        }
      />
      <Text preset="caption" text={props.helper} style={themed($muted)} />
    </Pressable>
  )
}

const $screen: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.screenHorizontal,
  paddingTop: spacing.md,
  gap: spacing.md,
  paddingBottom: 50,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $headerTop: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: spacing.sm,
})

const $headerTitles: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxxs,
})

const $statsGrid: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xs,
})

const $statsCell: ThemedStyle<ViewStyle> = () => ({
  flexGrow: 1,
  flexBasis: "31%",
  minWidth: 104,
})

const $statTile: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  minHeight: 72,
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  justifyContent: "center",
  gap: spacing.xxxs,
})

const $statValue: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
})

const $muted: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $cardHeaderRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: spacing.xs,
  marginBottom: spacing.xs,
})

const $infoGrid: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xxxs,
})

const $kv: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: spacing.sm,
  paddingVertical: spacing.xxxs,
})

const $list: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  maxHeight: 176,
  marginTop: spacing.xs,
})

const $row: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  paddingVertical: spacing.xs,
  borderBottomWidth: 1,
  borderBottomColor: colors.borderSubtle,
  gap: spacing.xxxs,
})

const $rowTop: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: spacing.xs,
})

const $rowTitle: ThemedStyle<TextStyle> = () => ({
  flex: 1,
})

const $chipOnline: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surfaceGlass,
})

const $chipOffline: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surfaceGlass,
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

const $errorBanner: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.danger,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
})

const $errorText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.danger,
})

const $actionGrid: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xs,
})

const $actionTile: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  flexBasis: "48%",
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  borderRadius: radius.medium,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
  gap: spacing.xxxs,
  minHeight: 72,
})

const $actionTilePrimary: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.primary,
  backgroundColor: colors.glowSoft,
})

const $actionTileText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
})

const $actionTileTextPrimary: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
})

async function getSyncStateRow() {
  const { getDb } = await import("@/services/db/db")
  const { queryFirst } = await import("@/services/db/queries")
  const { getActiveScopeKey } = await import("@/services/session/scope")
  const db = await getDb()
  const scopeKey = await getActiveScopeKey()
  return queryFirst<{ lastCursor: string | null }>(
    db,
    "SELECT lastCursor FROM sync_state WHERE scopeKey = ?",
    [scopeKey],
  )
}

async function buildDebugSnapshot() {
  const { getDb } = await import("@/services/db/db")
  const { queryAll, queryFirst } = await import("@/services/db/queries")
  const { getActiveScopeKey } = await import("@/services/session/scope")
  const db = await getDb()
  const scopeKey = await getActiveScopeKey()
  const syncState = await queryFirst(db, "SELECT * FROM sync_state WHERE scopeKey = ?", [scopeKey])
  const pendingCount = await queryFirst<{ count: number }>(
    db,
    "SELECT COUNT(1) as count FROM change_log WHERE scopeKey = ? AND status = 'PENDING'",
    [scopeKey],
  )
  const failedCount = await queryFirst<{ count: number }>(
    db,
    "SELECT COUNT(1) as count FROM change_log WHERE scopeKey = ? AND status = 'FAILED'",
    [scopeKey],
  )
  const conflictCount = await queryFirst<{ count: number }>(
    db,
    "SELECT COUNT(1) as count FROM conflicts WHERE scopeKey = ? AND status = 'OPEN'",
    [scopeKey],
  )
  const changeLog = await queryAll(
    db,
    "SELECT * FROM change_log WHERE scopeKey = ? ORDER BY createdAt DESC LIMIT 20",
    [scopeKey],
  )
  const conflicts = await queryAll(
    db,
    "SELECT * FROM conflicts WHERE scopeKey = ? ORDER BY createdAt DESC LIMIT 5",
    [scopeKey],
  )
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
