import { Pressable, ScrollView, View, ViewStyle } from "react-native"

import { useEffect, useState } from "react"

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

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screen)}>
      <View style={themed($header)}>
        <Text preset="heading" text="Sync debug" />
        <Text preset="formHelper" text="Inspect local change log and sync state" />
      </View>

      <GlassCard>
        <Text preset="formLabel" text="Pending operations" />
        <Text preset="formHelper" text={`${syncState.pendingCount} queued`} />
      </GlassCard>

      <GlassCard>
        <Text preset="formLabel" text="Sync cursor" />
        <Text preset="formHelper" text={cursor ?? "—"} />
        <Text preset="formHelper" text={`Last synced: ${syncState.lastSyncedAt ?? "—"}`} />
      </GlassCard>

      <GlassCard>
        <Text preset="formLabel" text="Conflicts" />
        <Text preset="formHelper" text={`${syncState.conflictCount} unresolved`} />
      </GlassCard>

      <GlassCard>
        <Text preset="formLabel" text="Failed ops" />
        <Text preset="formHelper" text={`${failedCount} failed`} />
      </GlassCard>

      <GlassCard>
        <Text preset="formLabel" text="Connection" />
        <Text preset="formHelper" text={syncState.isOnline ? "Online" : "Offline"} />
        <Text preset="formHelper" text={`Phase: ${syncState.phase}`} />
        {syncState.lastError ? <Text preset="formHelper" text={`Error: ${syncState.lastError}`} /> : null}
      </GlassCard>

      <GlassCard>
        <Text preset="formLabel" text="Pending ops" />
        <ScrollView style={themed($list)} nestedScrollEnabled>
          {pendingOps.length === 0 ? (
            <Text preset="formHelper" text="No pending ops." />
          ) : (
            pendingOps.map((op) => (
              <View key={op.opId} style={themed($row)}>
                <Text preset="formLabel" text={`${op.entityType} · ${op.opType}`} />
                <Text preset="formHelper" text={`${op.entityId}`} />
                <Text preset="formHelper" text={op.createdAt} />
              </View>
            ))
          )}
        </ScrollView>
      </GlassCard>

      <GlassCard>
        <Text preset="formLabel" text="Failed ops" />
        <ScrollView style={themed($list)} nestedScrollEnabled>
          {failedOps.length === 0 ? (
            <Text preset="formHelper" text="No failed ops." />
          ) : (
            failedOps.map((op) => (
              <View key={op.opId} style={themed($row)}>
                <Text preset="formLabel" text={`${op.entityType} · ${op.opType}`} />
                <Text preset="formHelper" text={`${op.entityId}`} />
                <Text preset="formHelper" text={`Attempts: ${op.attemptCount}`} />
              </View>
            ))
          )}
        </ScrollView>
      </GlassCard>

      <View style={themed($buttonRow)}>
        <Pressable style={themed($button)} onPress={() => syncController.triggerSync("manual").then(load)}>
          <Text preset="formLabel" text="Trigger sync" />
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
        style={themed($button)}
        onPress={async () => {
          const snapshot = await buildDebugSnapshot()
          console.log("[SYNC] Debug snapshot", snapshot)
        }}
      >
        <Text preset="formLabel" text="Export debug snapshot" />
      </Pressable>
    </Screen>
  )
}

const $screen: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.lg,
  gap: spacing.lg,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
})

const $list: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  maxHeight: 180,
  marginTop: spacing.sm,
})

const $row: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  paddingVertical: spacing.xs,
  borderBottomWidth: 1,
  borderBottomColor: colors.palette.neutral300,
  gap: spacing.xxs,
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
  borderRadius: 14,
  borderWidth: 1,
  borderColor: colors.palette.neutral300,
  backgroundColor: colors.palette.neutral100,
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
  const changeLog = await queryAll(db, "SELECT * FROM change_log ORDER BY createdAt DESC LIMIT 20")
  const conflicts = await queryAll(db, "SELECT * FROM conflicts ORDER BY createdAt DESC LIMIT 5")
  return { syncState, changeLog, conflicts }
}
