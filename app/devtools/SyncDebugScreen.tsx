import { useEffect, useMemo, useState } from "react"
import { Pressable, ScrollView, View, ViewStyle, TextStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AnimatedBackground } from "@/components/AnimatedBackground"
import { SyncHealthCard } from "@/components/charts/SyncHealthCard"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { SyncBadge } from "@/components/SyncBadge"
import { Text } from "@/components/Text"
import { goToConflictList } from "@/navigation/navigationActions"
import { useAuthSession } from "@/services/auth/session"
import { getDb } from "@/services/db/db"
import { queryAll } from "@/services/db/queries"
import {
  clearSentOps,
  countFailedOps,
  listFailedOps,
  listPendingOps,
  pruneSentOps,
  resetFailedToPending,
} from "@/services/db/repositories/changeLogRepository"
import type { ChangeLogEntry } from "@/services/db/types"
import { syncController } from "@/services/sync/SyncController"
import { describeSyncBehavior, useSyncPreferences } from "@/services/sync/syncPreferences"
import { refreshLocalCounts, useSyncStatus } from "@/services/sync/syncStore"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { resolveUserLabel } from "@/utils/userLabel"

type LookupRow = { id: string; name: string }

type OperationViewModel = {
  id: string
  title: string
  subject: string
  detail: string | null
  timestampLabel: string
  exactTimestamp: string
  entityBadge: string
  actionBadge: string
  rawEntityId: string
  rawOpId: string
  attempts?: number
}

type SyncMetrics = {
  pending: number
  failed: number
  sent: number
  total: number
  healthPercent: number
  trend: Array<{ key: string; label: string; total: number; successRate: number }>
}

export function SyncDebugScreen() {
  const { themed } = useAppTheme()
  const syncState = useSyncStatus()
  const syncPreferences = useSyncPreferences()
  const { workspaces } = useWorkspaceStore()
  const authSession = useAuthSession()

  const [pendingOps, setPendingOps] = useState([] as Awaited<ReturnType<typeof listPendingOps>>)
  const [failedOps, setFailedOps] = useState([] as Awaited<ReturnType<typeof listFailedOps>>)
  const [failedCount, setFailedCount] = useState(0)
  const [cursor, setCursor] = useState<string | null>(null)
  const [statusNameById, setStatusNameById] = useState<Record<string, string>>({})
  const [userLabelById, setUserLabelById] = useState<Record<string, string>>({})
  const [expandedOps, setExpandedOps] = useState<Set<string>>(new Set())
  const [syncMetrics, setSyncMetrics] = useState<SyncMetrics>({
    pending: 0,
    failed: 0,
    sent: 0,
    total: 0,
    healthPercent: 100,
    trend: [],
  })

  const load = async () => {
    const [pending, failed, failedTotal, syncStateRow, statusRows, metrics] = await Promise.all([
      listPendingOps(50),
      listFailedOps(50),
      countFailedOps(),
      getSyncStateRow(),
      loadStatusLookup(),
      getSyncMetrics(),
    ])
    setPendingOps(pending)
    setFailedOps(failed)
    setFailedCount(failedTotal)
    setCursor(syncStateRow?.lastCursor ?? null)
    setStatusNameById(Object.fromEntries(statusRows.map((row) => [row.id, row.name])))
    setSyncMetrics(metrics)

    const userIds = extractQueuedUserIds([...pending, ...failed])
    if (userIds.length > 0) {
      const labels = await Promise.all(
        userIds.map(async (userId) => [userId, await resolveUserLabel(userId)] as const),
      )
      setUserLabelById(Object.fromEntries(labels))
    } else {
      setUserLabelById({})
    }

    await refreshLocalCounts()
  }

  useEffect(() => {
    void load()
  }, [])

  const isOnlineLabel = syncState.isOnline ? "Online" : "Offline"
  const phaseLabel = String(syncState.phase ?? "—")
  const lastSyncedLabel = formatSyncTimestamp(syncState.lastSyncedAt)
  const hasError = !!syncState.lastError
  const isGuestMode = !authSession.isAuthenticated
  const behaviorLabel = describeSyncBehavior({
    preferences: syncPreferences,
    isOnline: syncState.isOnline,
    connectionType: syncState.networkType,
  })

  const workspaceLabelById = useMemo(
    () => Object.fromEntries(workspaces.map((workspace) => [workspace.id, workspace.label])),
    [workspaces],
  )

  const topStats = useMemo(
    () => [
      { label: "Pending", value: `${syncState.pendingCount} queued` },
      { label: "Failed", value: `${failedCount} failed` },
      { label: "Conflicts", value: `${syncState.conflictCount} open` },
    ],
    [syncState.pendingCount, syncState.conflictCount, failedCount],
  )
  const pendingViewModels = useMemo(
    () =>
      pendingOps.map((op) =>
        buildOperationViewModel(op, {
          statusNameById,
          workspaceLabelById,
          userLabelById,
          failed: false,
        }),
      ),
    [pendingOps, statusNameById, userLabelById, workspaceLabelById],
  )

  const failedViewModels = useMemo(
    () =>
      failedOps.map((op) =>
        buildOperationViewModel(op, {
          statusNameById,
          workspaceLabelById,
          userLabelById,
          failed: true,
        }),
      ),
    [failedOps, statusNameById, userLabelById, workspaceLabelById],
  )

  return (
    <AnimatedBackground>
      <Screen
        preset="scroll"
        backgroundColor="transparent"
        contentContainerStyle={themed([
          $screen,
          { paddingTop: useSafeAreaInsets().top, paddingBottom: useSafeAreaInsets().bottom+70 },
        ])}
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

        <View>
          <View style={themed($syncEntryRow)}>
            <View style={themed($syncEntryCopy)}>
              <Text preset="formLabel" text="Sync status" />
              {/* <Text
              preset="caption"
              text="Queue health, conflict review, and recovery tools now live here."
              style={themed($muted)}
            /> */}
            </View>
            <SyncBadge />
          </View>
          {syncState.conflictCount > 0 ? (
            <Pressable onPress={goToConflictList} style={themed($conflictEntryCard)}>
              <View>
                <Text preset="caption" text="Open conflicts" style={themed($rowTitle)} />
                <Text
                  preset="caption"
                  text={`${syncState.conflictCount} items need resolution`}
                  style={themed($muted)}
                />
              </View>
              <Text preset="caption" text="Review" style={themed($strongText)} />
            </Pressable>
          ) : null}
        </View>

        <SyncHealthCard
          healthPercent={syncMetrics.healthPercent}
          sent={syncMetrics.sent}
          pending={syncMetrics.pending}
          failed={syncMetrics.failed}
          trend={syncMetrics.trend}
        />

        <View style={themed($statsGrid)}>
          {topStats.map((stat) => (
            <CompactStatTile key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </View>

        {isGuestMode ? (
          <GlassCard>
            <View style={themed($guestNotice)}>
              <View style={themed($guestNoticeHeader)}>
                <OperationBadge label="Guest mode" tone="primary" />
              </View>
              <Text preset="formLabel" text="Sync unavailable in guest mode" />
              <Text
                preset="caption"
                text="You’re currently using Velo in guest mode. Changes are still saved locally and can be synced the next time you log in."
                style={themed($muted)}
              />
            </View>
          </GlassCard>
        ) : null}

        <GlassCard>
          <View style={themed($cardHeaderRow)}>
            <Text preset="formLabel" text="Actions" />
            <Text
              preset="caption"
              text={isGuestMode ? "Sign in to enable sync tools" : "Recovery and diagnostics"}
              style={themed($muted)}
            />
          </View>

          <View style={themed($actionGrid)}>
            <CompactActionTile
              label="Trigger sync"
              helper="Run a manual sync"
              onPress={() => syncController.triggerSync("manual").then(load)}
              emphasis="primary"
              disabled={isGuestMode}
            />
            <CompactActionTile
              label="Retry failed"
              helper="Move failed ops back to pending"
              onPress={() => resetFailedToPending().then(load)}
              disabled={isGuestMode}
            />
            {__DEV__ ? (
              <>
                <CompactActionTile
                  label="Clear sent"
                  helper="Remove SENT ops"
                  onPress={() => clearSentOps().then(load)}
                  disabled={isGuestMode}
                />
                <CompactActionTile
                  label="Prune sent"
                  helper="Trim old SENT ops"
                  onPress={() => pruneSentOps(2000, 7).then(load)}
                  disabled={isGuestMode}
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

        <GlassCard>
          <View style={themed($cardHeaderRow)}>
            <Text preset="formLabel" text="Sync state" />
            <Text preset="caption" text={`Phase: ${phaseLabel}`} style={themed($muted)} />
          </View>

          <View style={themed($infoGrid)}>
            <CompactInfoRow label="Cursor" value={cursor ?? "—"} />
            <CompactInfoRow label="Last synced" value={lastSyncedLabel} />
            <CompactInfoRow
              label="Mode"
              value={syncPreferences.syncMode === "manual" ? "Manual" : "Automatic"}
            />
            <CompactInfoRow
              label="Connection"
              value={
                syncPreferences.syncMode === "manual"
                  ? "Manual trigger"
                  : syncPreferences.syncNetworkPolicy === "wifi_only"
                    ? "Wi-Fi only"
                    : "Any internet"
              }
            />
          </View>
          <Text preset="caption" text={behaviorLabel} style={themed($muted)} />
        </GlassCard>

        <GlassCard>
          <View style={themed($cardHeaderRow)}>
            <Text preset="formLabel" text="Pending ops" />
            <Text
              preset="caption"
              text={`${pendingViewModels.length} shown`}
              style={themed($muted)}
            />
          </View>

          <ScrollView
            style={themed($list)}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {pendingViewModels.length === 0 ? (
              <Text preset="caption" text="No pending ops." style={themed($muted)} />
            ) : (
              pendingViewModels.map((item) => (
                <OperationRow
                  key={item.id}
                  item={item}
                  expanded={expandedOps.has(item.id)}
                  onToggle={() => {
                    setExpandedOps((prev) => {
                      const next = new Set(prev)
                      if (next.has(item.id)) next.delete(item.id)
                      else next.add(item.id)
                      return next
                    })
                  }}
                />
              ))
            )}
          </ScrollView>
        </GlassCard>

        <GlassCard>
          <View style={themed($cardHeaderRow)}>
            <Text preset="formLabel" text="Failed ops" />
            <Text
              preset="caption"
              text={`${failedViewModels.length} shown`}
              style={themed($muted)}
            />
          </View>

          <ScrollView
            style={themed($list)}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {failedViewModels.length === 0 ? (
              <Text preset="caption" text="No failed ops." style={themed($muted)} />
            ) : (
              failedViewModels.map((item) => (
                <OperationRow
                  key={item.id}
                  item={item}
                  expanded={expandedOps.has(item.id)}
                  onToggle={() => {
                    setExpandedOps((prev) => {
                      const next = new Set(prev)
                      if (next.has(item.id)) next.delete(item.id)
                      else next.add(item.id)
                      return next
                    })
                  }}
                />
              ))
            )}
          </ScrollView>
        </GlassCard>
      </Screen>
    </AnimatedBackground>
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

function OperationRow(props: {
  item: OperationViewModel
  expanded: boolean
  onToggle: () => void
}) {
  const { themed } = useAppTheme()
  return (
    <Pressable onPress={props.onToggle} style={themed($row)}>
      <View style={themed($rowTop)}>
        <Text preset="caption" text={props.item.title} style={themed($rowTitle)} />
        <Text preset="caption" text={props.item.timestampLabel} style={themed($muted)} />
      </View>
      <Text
        preset="caption"
        text={props.item.subject}
        style={themed($strongText)}
        numberOfLines={1}
      />
      {props.item.detail ? (
        <Text preset="caption" text={props.item.detail} style={themed($muted)} numberOfLines={2} />
      ) : null}
      <View style={themed($opMetaRow)}>
        <OperationBadge label={props.item.entityBadge} />
        <OperationBadge label={props.item.actionBadge} tone="primary" />
        {props.item.attempts && props.item.attempts > 0 ? (
          <OperationBadge label={`${props.item.attempts} attempts`} tone="danger" />
        ) : null}
      </View>
      {props.expanded ? (
        <View style={themed($expandedMeta)}>
          <Text
            preset="caption"
            text={`Entity ${shortId(props.item.rawEntityId)}`}
            style={themed($muted)}
          />
          <Text
            preset="caption"
            text={`Op ${shortId(props.item.rawOpId)}`}
            style={themed($muted)}
          />
          <Text preset="caption" text={props.item.exactTimestamp} style={themed($muted)} />
        </View>
      ) : null}
    </Pressable>
  )
}

function OperationBadge({
  label,
  tone = "default",
}: {
  label: string
  tone?: "default" | "primary" | "danger"
}) {
  const { themed } = useAppTheme()
  return (
    <View
      style={[
        themed($badgePill),
        tone === "primary" ? themed($badgePillPrimary) : null,
        tone === "danger" ? themed($badgePillDanger) : null,
      ]}
    >
      <Text preset="caption" text={label} style={themed($badgeText)} />
    </View>
  )
}

function CompactActionTile(props: {
  label: string
  helper: string
  onPress: () => void | Promise<void>
  emphasis?: "primary" | "default"
  disabled?: boolean
}) {
  const { themed } = useAppTheme()
  return (
    <Pressable
      style={[
        themed($actionTile),
        props.emphasis === "primary" ? themed($actionTilePrimary) : null,
        props.disabled ? themed($actionTileDisabled) : null,
      ]}
      disabled={props.disabled}
      onPress={props.onPress}
    >
      <Text
        preset="caption"
        text={props.label}
        style={
          props.disabled
            ? themed($muted)
            : props.emphasis === "primary"
              ? themed($actionTileTextPrimary)
              : themed($actionTileText)
        }
      />
      <Text
        preset="caption"
        text={props.disabled ? "Unavailable while signed out" : props.helper}
        style={themed($muted)}
      />
    </Pressable>
  )
}

const $screen: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.screenHorizontal,
  paddingTop: spacing.md,
  gap: spacing.md,
  paddingBottom: 70,
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
  minHeight: 52,
  borderRadius: radius.pill,
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

const $strongText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
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
  marginBottom: spacing.xs,
})

const $kv: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: spacing.sm,
  paddingVertical: spacing.xxxs,
})

const $list: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  maxHeight: 220,
  marginTop: spacing.xs,
})

const $row: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
  marginBottom: spacing.xs,
  gap: spacing.xs,
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

const $opMetaRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xs,
})

const $expandedMeta: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xxxs,
})

const $badgePill: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surfaceGlass,
  paddingHorizontal: spacing.xs,
  paddingVertical: spacing.xxxs,
})

const $badgePillPrimary: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.primary,
  backgroundColor: colors.glowSoft,
})

const $badgePillDanger: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.danger,
})

const $badgeText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
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

const $syncEntryRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
})

const $syncEntryCopy: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxxs,
})

const $conflictEntryCard: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  marginTop: spacing.sm,
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
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

const $actionTileDisabled: ThemedStyle<ViewStyle> = ({ colors }) => ({
  opacity: 0.55,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
})

const $actionTileText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
})

const $actionTileTextPrimary: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
})

const $guestNotice: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
})

const $guestNoticeHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "flex-start",
  gap: spacing.xs,
})

async function getSyncStateRow() {
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

async function getSyncMetrics(): Promise<SyncMetrics> {
  const { queryFirst } = await import("@/services/db/queries")
  const { getActiveScopeKey } = await import("@/services/session/scope")
  const db = await getDb()
  const scopeKey = await getActiveScopeKey()
  const [pending, failed, sent] = await Promise.all([
    queryFirst<{ count: number }>(
      db,
      "SELECT COUNT(1) as count FROM change_log WHERE scopeKey = ? AND status = 'PENDING'",
      [scopeKey],
    ),
    queryFirst<{ count: number }>(
      db,
      "SELECT COUNT(1) as count FROM change_log WHERE scopeKey = ? AND status = 'FAILED'",
      [scopeKey],
    ),
    queryFirst<{ count: number }>(
      db,
      "SELECT COUNT(1) as count FROM change_log WHERE scopeKey = ? AND status = 'SENT'",
      [scopeKey],
    ),
  ])

  const pendingCount = pending?.count ?? 0
  const failedCount = failed?.count ?? 0
  const sentCount = sent?.count ?? 0
  const total = pendingCount + failedCount + sentCount
  const healthPercent = total === 0 ? 100 : Math.round((sentCount / total) * 100)
  const now = new Date()
  const trend = await Promise.all(
    Array.from({ length: 7 }).map(async (_, index) => {
      const day = new Date(now)
      day.setDate(now.getDate() - (6 - index))
      const key = day.toISOString().slice(0, 10)
      const rows = await queryAll<{ status: string; count: number }>(
        db,
        `SELECT status, COUNT(1) as count
         FROM change_log
         WHERE scopeKey = ? AND substr(createdAt, 1, 10) = ?
         GROUP BY status`,
        [scopeKey, key],
      )
      const totalForDay = rows.reduce((sum, row) => sum + row.count, 0)
      const sentForDay = rows.find((row) => row.status === "SENT")?.count ?? 0
      return {
        key,
        label: day.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1),
        total: totalForDay,
        successRate: totalForDay === 0 ? 100 : Math.round((sentForDay / totalForDay) * 100),
      }
    }),
  )

  return {
    pending: pendingCount,
    failed: failedCount,
    sent: sentCount,
    total,
    healthPercent,
    trend,
  }
}

async function loadStatusLookup() {
  const db = await getDb()
  return queryAll<LookupRow>(db, "SELECT id, name FROM statuses ORDER BY name ASC")
}

function extractQueuedUserIds(ops: ChangeLogEntry[]) {
  const ids = new Set<string>()
  ops.forEach((op) => {
    const patch = parsePatch(op.patch)
    const assigneeUserId =
      typeof patch.assigneeUserId === "string" ? patch.assigneeUserId : undefined
    if (assigneeUserId) ids.add(assigneeUserId)
  })
  return Array.from(ids)
}

function parsePatch(raw: string) {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

function buildOperationViewModel(
  op: ChangeLogEntry,
  context: {
    statusNameById: Record<string, string>
    workspaceLabelById: Record<string, string>
    userLabelById: Record<string, string>
    failed: boolean
  },
): OperationViewModel {
  const patch = parsePatch(op.patch)
  const isDelete = op.opType === "DELETE"
  const isCreate = op.opType === "UPSERT" && !op.baseRevision
  const entityBadge = formatEntityLabel(op.entityType)
  const actionBadge = isDelete ? "Deleted" : isCreate ? "Created" : "Updated"
  const timestamp = context.failed ? (op.lastAttemptAt ?? op.createdAt) : op.createdAt
  const workspaceId = typeof patch.workspaceId === "string" ? patch.workspaceId : op.workspaceId
  const workspaceLabel = context.workspaceLabelById[workspaceId] ?? null
  const statusId = typeof patch.statusId === "string" ? patch.statusId : null
  const assigneeUserId = typeof patch.assigneeUserId === "string" ? patch.assigneeUserId : null
  const assigneeLabel = assigneeUserId
    ? (context.userLabelById[assigneeUserId] ?? "Assigned")
    : null
  const detailParts: string[] = []
  if (workspaceLabel) detailParts.push(workspaceLabel)
  if (statusId) detailParts.push(context.statusNameById[statusId] ?? shortId(statusId))
  if (assigneeLabel) detailParts.push(assigneeLabel)

  return {
    id: op.opId,
    title: `${entityBadge} ${actionBadge.toLowerCase()}`,
    subject: getOperationSubject(op.entityType, patch),
    detail: detailParts.length > 0 ? detailParts.join(" · ") : shortId(op.entityId),
    timestampLabel: formatSyncTimestamp(timestamp),
    exactTimestamp: formatExactTimestamp(timestamp),
    entityBadge,
    actionBadge,
    rawEntityId: op.entityId,
    rawOpId: op.opId,
    attempts: context.failed ? op.attemptCount : undefined,
  }
}

function getOperationSubject(entityType: string, patch: Record<string, unknown>) {
  if (entityType === "task") {
    return typeof patch.title === "string" && patch.title.trim().length > 0
      ? patch.title
      : "Untitled task"
  }
  if (entityType === "comment") {
    const body = typeof patch.body === "string" ? patch.body.trim() : ""
    return body.length > 0 ? trimPreview(body, 56) : "Comment change"
  }
  if (entityType === "workspace_member") {
    const label =
      typeof patch.workspaceLabel === "string" && patch.workspaceLabel.trim().length > 0
        ? patch.workspaceLabel
        : "Project member"
    const role = typeof patch.role === "string" ? patch.role : null
    return role ? `${label} · ${role}` : label
  }
  if (entityType === "user") {
    return typeof patch.displayName === "string" && patch.displayName.trim().length > 0
      ? patch.displayName
      : typeof patch.email === "string" && patch.email.trim().length > 0
        ? patch.email
        : "Profile record"
  }
  return shortId(typeof patch.id === "string" ? patch.id : "")
}

function formatEntityLabel(entityType: string) {
  if (entityType === "task") return "Task"
  if (entityType === "comment") return "Comment"
  if (entityType === "workspace_member") return "Member"
  if (entityType === "user") return "User"
  return entityType
}

function formatSyncTimestamp(input: string | null | undefined) {
  if (!input) return "—"
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return "—"
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
  if (sameDay) return `Today, ${time}`
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function formatExactTimestamp(input: string | null | undefined) {
  if (!input) return "—"
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date)
}

function shortId(value: string) {
  if (!value) return "—"
  if (value.length <= 12) return value
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

function trimPreview(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}…`
}

async function buildDebugSnapshot() {
  const { queryFirst } = await import("@/services/db/queries")
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
