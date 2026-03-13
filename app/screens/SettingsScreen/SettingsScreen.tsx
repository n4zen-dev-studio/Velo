import { useState, type ReactNode } from "react"
import { Modal, Pressable, View, ViewStyle, TextStyle } from "react-native"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { HeaderAvatar } from "@/components/HeaderAvatar"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Switch } from "@/components/Toggle/Switch"
import { goToAuth, goToProfile, goToProjectsTab } from "@/navigation/navigationActions"
import { useAuthViewModel } from "@/screens/AuthScreen/useAuthViewModel"
import { clearTokens } from "@/services/api/tokenStore"
import { clearAuthSession, refreshAuthSession, useAuthSession } from "@/services/auth/session"
import { logoutCleanup } from "@/services/session/logoutCleanup"
import { setLoggingOut } from "@/services/session/logoutState"
import { GUEST_SCOPE_KEY } from "@/services/session/scope"
import { logScopeAction, withScopeTransitionLock } from "@/services/session/scopeTransition"
import { clearOfflineMode } from "@/services/storage/session"
import { clearCurrentUserId, setSessionMode } from "@/services/sync/identity"
import { resetOfflineClaimHandled } from "@/services/sync/offlineClaim"
import { syncController } from "@/services/sync/SyncController"
import {
  describeSyncBehavior,
  setSyncMode,
  setSyncNetworkPolicy,
  useSyncPreferences,
} from "@/services/sync/syncPreferences"
import { useSyncStatus } from "@/services/sync/syncStore"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

import { useSettingsViewModel } from "./useSettingsViewModel"

export function SettingsScreen() {
  const { themed, toggleTheme } = useAppTheme()

  const { options, setOption } = useSettingsViewModel()
  // NOTE: setOption is expected to exist now for functionality.
  // If your hook currently doesn't expose it, add:
  //   const setOption = (id: string, value: boolean) => update state + persist
  // so this screen can remain dumb UI.

  const { logoutUser } = useAuthViewModel()
  const { workspaces, activeWorkspace } = useWorkspaceStore()
  const syncStatus = useSyncStatus()
  const syncPreferences = useSyncPreferences()
  const authSession = useAuthSession()

  const syncBehaviorText = describeSyncBehavior({
    preferences: syncPreferences,
    isOnline: syncStatus.isOnline,
    connectionType: syncStatus.networkType,
  })

  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const projectSummary =
    workspaces.filter((workspace) => workspace.kind !== "personal").length === 0
      ? "Project admin lives in the Projects tab."
      : `${workspaces.filter((workspace) => workspace.kind !== "personal").length} shared projects managed from Projects.`

  const handleLogout = async () => {
    setLogoutError(null)
    await refreshAuthSession()
    setShowLogoutModal(true)
  }

  const handleOnlineSyncAndWipe = async () => {
    setLogoutError(null)
    setIsLoggingOut(true)
    try {
      if (!authSession.currentUserId) {
        throw new Error("No authenticated user session.")
      }
      if (!syncStatus.isOnline) {
        throw new Error("You are offline. Sync cannot run right now.")
      }
      if (syncStatus.pendingCount > 0) {
        await syncController.triggerSync("manual")
      }
      await withScopeTransitionLock(async () => {
        setLoggingOut(true)
        syncController.pause()
        try {
          logScopeAction("logout_sync_wipe", GUEST_SCOPE_KEY, authSession.currentUserId)
          await logoutUser()
          await logoutCleanup({ mode: "user_sync_logout", userId: authSession.currentUserId })
          await clearCurrentUserId()
          await setSessionMode("local")
          await clearOfflineMode()
          clearAuthSession()
          resetOfflineClaimHandled()
          setShowLogoutModal(false)
          goToAuth()
        } finally {
          syncController.resume()
          setLoggingOut(false)
        }
      }, "logout_sync_wipe")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed. Please try again."
      setLogoutError(message)
    } finally {
      setIsLoggingOut(false)
    }
  }

  // const handleOnlineWipe = async () => {
  //   setLogoutError(null)
  //   setIsLoggingOut(true)
  //   try {
  //     if (!authSession.currentUserId) {
  //       throw new Error("No authenticated user session.")
  //     }
  //     await withScopeTransitionLock(async () => {
  //       setLoggingOut(true)
  //       syncController.pause()
  //       try {
  //         logScopeAction("logout_wipe_unsynced", GUEST_SCOPE_KEY, authSession.currentUserId)
  //         await logoutCleanup({ mode: "user_wipe_logout", userId: authSession.currentUserId })
  //         await logoutUser()
  //         await clearCurrentUserId()
  //         await setSessionMode("local")
  //         await clearOfflineMode()
  //         clearAuthSession()
  //         resetOfflineClaimHandled()
  //         setShowLogoutModal(false)
  //         goToAuth()
  //       } finally {
  //         syncController.resume()
  //         setLoggingOut(false)
  //       }
  //     }, "logout_wipe_unsynced")
  //   } catch (err) {
  //     const message = err instanceof Error ? err.message : "Sign out failed. Please try again."
  //     setLogoutError(message)
  //   } finally {
  //     setIsLoggingOut(false)
  //   }
  // }
  const handleOnlineWipe = async () => {
    setLogoutError(null)
    setIsLoggingOut(true)
    let didWipe = false

    try {
      if (!authSession.currentUserId) throw new Error("No authenticated user session.")

      await withScopeTransitionLock(async () => {
        setLoggingOut(true)

        // HARD STOP sync (abort if possible)
        syncController.abortAndPause?.("logout_wipe_unsynced")
        syncController.pause()

        didWipe = true

        logScopeAction("logout_wipe_unsynced", GUEST_SCOPE_KEY, authSession.currentUserId)

        // IMPORTANT: wipe pending ops BEFORE any auth clearing effects
        await logoutCleanup({ mode: "user_wipe_logout", userId: authSession.currentUserId })

        // For wipe-logout: DO NOT call network logout if it can trigger sync
        // await logoutUser()   // <-- remove or guard with "no sync" mode

        await clearCurrentUserId()
        await setSessionMode("local")
        await clearOfflineMode()

        clearAuthSession()
        resetOfflineClaimHandled()

        setShowLogoutModal(false)
        goToAuth()
      }, "logout_wipe_unsynced")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign out failed. Please try again."
      setLogoutError(message)
    } finally {
      // DO NOT resume on wipe
      if (!didWipe) syncController.resume()
      setLoggingOut(false)
      setIsLoggingOut(false)
    }
  }

  const handleOfflineKeepLocal = async () => {
    setLogoutError(null)
    setIsLoggingOut(true)
    try {
      await withScopeTransitionLock(async () => {
        setLoggingOut(true)
        syncController.pause()
        try {
          logScopeAction("logout_offline_keep", GUEST_SCOPE_KEY, authSession.currentUserId)
          await clearTokens()
          await setSessionMode("local")
          await clearOfflineMode()
          clearAuthSession()
          resetOfflineClaimHandled()
          setShowLogoutModal(false)
          goToAuth()
        } finally {
          syncController.resume()
          setLoggingOut(false)
        }
      }, "logout_offline_keep")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign out failed. Please try again."
      setLogoutError(message)
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleOfflineWipe = async () => {
    setLogoutError(null)
    setIsLoggingOut(true)
    try {
      await withScopeTransitionLock(async () => {
        setLoggingOut(true)
        syncController.pause()
        try {
          logScopeAction("logout_offline_wipe", GUEST_SCOPE_KEY, authSession.currentUserId)
          await logoutCleanup({ mode: "guest_wipe" })
          await clearTokens()
          await clearCurrentUserId()
          await setSessionMode("local")
          await clearOfflineMode()
          clearAuthSession()
          resetOfflineClaimHandled()
          setShowLogoutModal(false)
          goToAuth()
        } finally {
          syncController.resume()
          setLoggingOut(false)
        }
      }, "logout_offline_wipe")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign out failed. Please try again."
      setLogoutError(message)
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={themed($screen)}
    >
      <View style={themed($header)}>
        <View style={themed($headerRow)}>
          <View style={themed($headerText)}>
            <Text preset="overline" text="Settings" />
            <Text preset="heading" text="Preferences" />
            <Text
              preset="caption"
              text="Sync, theme, projects, and account controls."
              style={themed($muted)}
            />
          </View>
          <HeaderAvatar onPress={goToProfile} />
        </View>
        <View style={themed($headerMetaRow)}>
          <CompactMetaPill
            label={syncStatus.isOnline ? "Online" : "Offline"}
            value={syncStatus.pendingCount > 0 ? `${syncStatus.pendingCount} queued` : "Ready"}
          />
          <CompactMetaPill label="Projects" value={`${workspaces.length}`} />
          <CompactMetaPill label="Current" value={activeWorkspace?.label ?? "Personal"} />
        </View>
      </View>

      <GlassCard>
        <CompactSectionHeader
          title="Sync"
          subtitle={syncPreferences.syncMode === "manual" ? "Manual mode" : "Automatic mode"}
        />
        <View style={themed($syncStack)}>
          <View style={themed($syncBlock)}>
            <Text preset="caption" text="Sync mode" style={themed($subsectionLabel)} />
            <View style={themed($segmentedRow)}>
              <SegmentOption
                label="Manual"
                selected={syncPreferences.syncMode === "manual"}
                onPress={() => void setSyncMode("manual")}
              />
              <SegmentOption
                label="Automatic"
                selected={syncPreferences.syncMode === "automatic"}
                onPress={() => void setSyncMode("automatic")}
              />
            </View>
          </View>

          <View
            style={[
              themed($syncBlock),
              syncPreferences.syncMode === "manual" ? themed($disabledSection) : null,
            ]}
          >
            <Text preset="caption" text="Connection preference" style={themed($subsectionLabel)} />
            <View style={themed($segmentedRow)}>
              <SegmentOption
                label="Wi-Fi only"
                selected={syncPreferences.syncNetworkPolicy === "wifi_only"}
                onPress={() => void setSyncNetworkPolicy("wifi_only")}
                disabled={syncPreferences.syncMode === "manual"}
              />
              <SegmentOption
                label="Any internet"
                selected={syncPreferences.syncNetworkPolicy === "any"}
                onPress={() => void setSyncNetworkPolicy("any")}
                disabled={syncPreferences.syncMode === "manual"}
              />
            </View>
          </View>

          <View style={themed($syncHintCard)}>
            <Text preset="caption" text={syncBehaviorText} style={themed($muted)} />
            <View style={themed($syncMetaRow)}>
              <Text
                preset="caption"
                text={`Connection: ${formatConnectionLabel(syncStatus.networkType)}`}
                style={themed($muted)}
              />
              <Text
                preset="caption"
                text={
                  syncStatus.pendingCount > 0 ? `${syncStatus.pendingCount} queued` : "Queue clear"
                }
                style={themed($strongText)}
              />
            </View>
          </View>
        </View>
      </GlassCard>

      <GlassCard>
        <CompactSectionHeader title="Preferences" subtitle={`${options.length} controls`} />
        <View style={themed($groupedList)}>
          {options.map((option: any, index: number) => (
            <CompactSettingRow
              key={option.id}
              label={option.label}
              helperText={option.helperText}
              withDivider={index < options.length - 1}
              control={
                <Switch
                  value={!!option.value}
                  onValueChange={(value) => setOption(option.id, value)}
                />
              }
            />
          ))}
        </View>
      </GlassCard>

      <GlassCard>
        <CompactSectionHeader title="Theme" subtitle="Appearance" />
        <View style={themed($compactActionRow)}>
          <View style={themed($compactActionCopy)}>
            <Text preset="caption" text="Current mode" style={themed($muted)} />
            <Text preset="formLabel" text="Switch light or dark theme" />
          </View>
          <View style={themed($inlineActions)}>
            <Button text="Switch theme" onPress={toggleTheme} preset="glass" />
          </View>
        </View>
      </GlassCard>

      <GlassCard>
        <View style={themed($cardHeaderRow)}>
          <View style={themed($titleBlock)}>
            <Text preset="subheading" text="Projects" />
            <Text preset="caption" text={projectSummary} style={themed($muted)} />
          </View>
        </View>

        <View style={themed($currentProjectRow)}>
          <View style={themed($rowLeft)}>
            <Text preset="caption" text="Current project" style={themed($muted)} />
            <Text preset="formLabel" text={activeWorkspace?.label ?? "Personal"} />
          </View>
          <Text preset="caption" text={`${workspaces.length} total`} style={themed($muted)} />
        </View>

        <View style={themed($compactActionRow)}>
          <View style={themed($compactActionCopy)}>
            <Text preset="caption" text="Project admin" style={themed($muted)} />
            <Text
              preset="formLabel"
              text="Manage Projects"
            />
          </View>
          <View style={themed($inlineActions)}>
            <Button text="Open projects" preset="glass" onPress={goToProjectsTab} />
          </View>
        </View>
      </GlassCard>

      <GlassCard>
        <CompactSectionHeader title="Account" subtitle="Session actions" />
        <View style={themed($compactActionRow)}>
          <View style={themed($compactActionCopy)}>
            <Text preset="caption" text="Session" style={themed($muted)} />
            <Text preset="formLabel" text="Sign out or clear local session state" />
          </View>
          <View style={themed($inlineActions)}>
            <Button text="Logout" preset="glass" onPress={handleLogout} />
          </View>
        </View>
      </GlassCard>

      {/* Logout modal */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={themed($backdrop)}>
          <GlassCard style={themed($modalCard)}>
            <Text preset="heading" text="Sign out" />
            <Text
              preset="formHelper"
              text={
                authSession.isAuthenticated
                  ? syncStatus.isOnline
                    ? syncStatus.pendingCount > 0
                      ? `You have ${syncStatus.pendingCount} pending changes. Syncing will push them before logout.`
                      : "No pending changes. You can logout safely."
                    : "You are offline. Sync can’t run right now."
                  : "You’re not signed in. Keeping local data lets you continue offline."
              }
            />
            {logoutError ? (
              <Text preset="formHelper" text={logoutError} style={themed($errorText)} />
            ) : null}

            <View style={themed($modalButtons)}>
              {authSession.isAuthenticated ? (
                <>
                  <Button
                    text={isLoggingOut ? "Syncing..." : "Sync & logout"}
                    preset="glass"
                    onPress={handleOnlineSyncAndWipe}
                    disabled={isLoggingOut || !syncStatus.isOnline}
                  />
                  <Button
                    text={isLoggingOut ? "Signing out..." : "Wipe unsynced ops & logout"}
                    preset="glass"
                    onPress={handleOnlineWipe}
                    disabled={isLoggingOut}
                  />
                </>
              ) : (
                <>
                  <Button
                    text={isLoggingOut ? "Signing out..." : "Keep local data & continue"}
                    preset="glass"
                    onPress={handleOfflineKeepLocal}
                    disabled={isLoggingOut}
                  />
                  <Button
                    text={isLoggingOut ? "Signing out..." : "Wipe local data & continue"}
                    preset="glass"
                    onPress={handleOfflineWipe}
                    disabled={isLoggingOut}
                  />
                </>
              )}
              <Button
                text="Cancel"
                preset="glass"
                onPress={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
              />
            </View>
          </GlassCard>
        </View>
      </Modal>
    </Screen>
  )
}

function CompactSectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($cardHeaderRow)}>
      <Text preset="subheading" text={title} />
      {subtitle ? <Text preset="caption" text={subtitle} style={themed($muted)} /> : null}
    </View>
  )
}

function CompactSettingRow(props: {
  label: string
  helperText?: string
  control: ReactNode
  withDivider?: boolean
}) {
  const { themed } = useAppTheme()
  return (
    <View>
      <View style={themed($toggleRow)}>
        <View style={themed($toggleLeft)}>
          <Text preset="formLabel" text={props.label} />
          {props.helperText ? (
            <Text preset="caption" text={props.helperText} style={themed($muted)} />
          ) : null}
        </View>
        {props.control}
      </View>
      {props.withDivider ? <View style={themed($inlineDivider)} /> : null}
    </View>
  )
}

function CompactMetaPill({ label, value }: { label: string; value: string }) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($metaPill)}>
      <Text preset="caption" text={label} style={themed($muted)} />
      <Text preset="caption" text={value} style={themed($strongText)} numberOfLines={1} />
    </View>
  )
}

function SegmentOption(props: {
  label: string
  selected: boolean
  onPress: () => void
  disabled?: boolean
}) {
  const { themed } = useAppTheme()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      disabled={props.disabled}
      style={[
        themed($segmentOption),
        props.selected ? themed($segmentOptionActive) : null,
        props.disabled ? themed($segmentOptionDisabled) : null,
      ]}
    >
      <Text preset="caption" text={props.label} style={themed($strongText)} />
    </Pressable>
  )
}

function formatConnectionLabel(type: string) {
  if (type === "wifi") return "Wi-Fi"
  if (type === "cellular") return "Cellular"
  if (type === "ethernet") return "Ethernet"
  if (type === "none") return "Offline"
  if (type === "other") return "Connected"
  return "Unknown"
}

const $screen: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.screenHorizontal,
  paddingTop: spacing.md,
  gap: spacing.md,
  paddingBottom: spacing.xxxl + 30,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $headerRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
})

const $headerText: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxxs,
})

const $headerMetaRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xs,
})

const $metaPill: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surfaceGlass,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
})

const $cardHeaderRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: spacing.sm,
  marginBottom: spacing.xs,
})

const $titleBlock: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxxs,
})

const $toggleRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  gap: spacing.sm,
  minHeight: 52,
})

const $toggleLeft: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxxs,
})

const $groupedList: ThemedStyle<ViewStyle> = ({ colors, radius }) => ({
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  borderRadius: radius.large,
  overflow: "hidden",
})

const $inlineDivider: ThemedStyle<ViewStyle> = ({ colors }) => ({
  height: 1,
  backgroundColor: colors.borderSubtle,
})

const $syncStack: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $syncBlock: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
})

const $segmentedRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.xs,
})

const $segmentOption: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  flex: 1,
  minHeight: 42,
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
})

const $segmentOptionActive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.primary,
  backgroundColor: colors.glowSoft,
})

const $segmentOptionDisabled: ThemedStyle<ViewStyle> = () => ({
  opacity: 0.5,
})

const $disabledSection: ThemedStyle<ViewStyle> = () => ({
  opacity: 0.6,
})

const $syncHintCard: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surfaceGlass,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
  gap: spacing.xs,
})

const $syncMetaRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  gap: spacing.sm,
})

const $rowLeft: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxxs,
})

const $currentProjectRow: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  borderRadius: radius.medium,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
})

const $compactActionRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
})

const $compactActionCopy: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxxs,
})

const $inlineActions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
})

const $muted: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $strongText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
})

const $subsectionLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
  textTransform: "uppercase",
})

const $backdrop: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  padding: 24,
  backgroundColor: colors.palette.overlay50,
})

const $modalCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  width: "100%",
  gap: spacing.sm,
})

const $modalButtons: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $errorText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.danger,
})
