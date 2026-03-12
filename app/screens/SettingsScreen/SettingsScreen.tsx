import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Modal, Pressable, View, ViewStyle, TextStyle } from "react-native"
import { useFocusEffect } from "@react-navigation/native"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { HeaderAvatar } from "@/components/HeaderAvatar"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { Switch } from "@/components/Toggle/Switch"
import { BASE_URL } from "@/config/api"
import { goToAuth, goToProfile } from "@/navigation/navigationActions"
import { goToInvites } from "@/navigation/navigationActions"
import { useAuthViewModel } from "@/screens/AuthScreen/useAuthViewModel"
import { createHttpClient } from "@/services/api/httpClient"
import {
  deleteWorkspace as deleteWorkspaceApi,
  inviteToWorkspace,
  listWorkspaceInvites,
  removeWorkspaceMember,
  revokeWorkspaceInvite,
  type WorkspaceInvite,
} from "@/services/api/invitesApi"
import { clearTokens } from "@/services/api/tokenStore"
import { clearAuthSession, refreshAuthSession, useAuthSession } from "@/services/auth/session"
import { listByWorkspaceId as listMembers } from "@/services/db/repositories/workspaceMembersRepository"
import { logoutCleanup } from "@/services/session/logoutCleanup"
import { setLoggingOut } from "@/services/session/logoutState"
import { GUEST_SCOPE_KEY } from "@/services/session/scope"
import { logScopeAction, withScopeTransitionLock } from "@/services/session/scopeTransition"
import { clearOfflineMode } from "@/services/storage/session"
import { clearCurrentUserId, getCurrentUserId, setSessionMode } from "@/services/sync/identity"
import { resetOfflineClaimHandled } from "@/services/sync/offlineClaim"
import { syncController } from "@/services/sync/SyncController"
import { useSyncStatus } from "@/services/sync/syncStore"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { formatDateTime } from "@/utils/dateFormat"
import { resolveUserLabel } from "@/utils/userLabel"

import { useSettingsViewModel } from "./useSettingsViewModel"

export function SettingsScreen() {
  const { themed, toggleTheme } = useAppTheme()

  const { options, setOption } = useSettingsViewModel()
  // NOTE: setOption is expected to exist now for functionality.
  // If your hook currently doesn't expose it, add:
  //   const setOption = (id: string, value: boolean) => update state + persist
  // so this screen can remain dumb UI.

  const { logoutUser } = useAuthViewModel()
  const { workspaces, activeWorkspace, createWorkspace, renameWorkspace, deleteWorkspace } =
    useWorkspaceStore()
  const syncStatus = useSyncStatus()
  const authSession = useAuthSession()

  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const [createExpanded, setCreateExpanded] = useState(false)
  const [newWorkspaceLabel, setNewWorkspaceLabel] = useState("")
  const [createError, setCreateError] = useState<string | null>(null)

  const [renameWorkspaceId, setRenameWorkspaceId] = useState<string | null>(null)
  const [renameLabel, setRenameLabel] = useState("")
  const [renameError, setRenameError] = useState<string | null>(null)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = useState<Set<string>>(new Set())
  const [inviteEmailByWorkspaceId, setInviteEmailByWorkspaceId] = useState<Record<string, string>>(
    {},
  )
  const [inviteStatusByWorkspaceId, setInviteStatusByWorkspaceId] = useState<
    Record<string, { error?: string; success?: string; isInviting?: boolean }>
  >({})
  const [membersByWorkspaceId, setMembersByWorkspaceId] = useState<
    Record<string, Array<{ id: string; label: string; role: string; userId: string }>>
  >({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [sentInvitesByWorkspaceId, setSentInvitesByWorkspaceId] = useState<
    Record<string, WorkspaceInvite[]>
  >({})
  const [inviteListStatusByWorkspaceId, setInviteListStatusByWorkspaceId] = useState<
    Record<string, { isLoading?: boolean; error?: string }>
  >({})
  const [confirmRemove, setConfirmRemove] = useState<{
    workspaceId: string
    userId: string
    label: string
  } | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState<{
    workspaceId: string
    inviteId: string
    email: string
  } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{
    workspaceId: string
    label: string
  } | null>(null)

  const validateWorkspaceLabel = (label: string, excludeId?: string | null) => {
    const trimmed = label.trim()
    if (trimmed.length < 2 || trimmed.length > 40) return "Project name must be 2-40 characters."
    const normalized = trimmed.toLowerCase()
    const conflicts = workspaces.some(
      (w) => w.id !== excludeId && w.label.trim().toLowerCase() === normalized,
    )
    if (conflicts) return "A project with that name already exists."
    return null
  }

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

  const handleCreateWorkspace = async () => {
    const error = validateWorkspaceLabel(newWorkspaceLabel)
    setCreateError(error)
    if (error) return
    try {
      await createWorkspace(newWorkspaceLabel.trim(), true)
      setNewWorkspaceLabel("")
      setCreateError(null)
      setCreateExpanded(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create project"
      setCreateError(message)
    }
  }

  const openRenameModal = (workspaceId: string, currentLabel: string) => {
    setRenameWorkspaceId(workspaceId)
    setRenameLabel(currentLabel)
    setRenameError(null)
    setShowRenameModal(true)
  }

  const handleRenameWorkspace = async () => {
    if (!renameWorkspaceId) return
    const error = validateWorkspaceLabel(renameLabel, renameWorkspaceId)
    setRenameError(error)
    if (error) return
    await renameWorkspace(renameWorkspaceId, renameLabel.trim())
    setShowRenameModal(false)
    setRenameWorkspaceId(null)
  }

  useEffect(() => {
    void (async () => {
      const userId = await getCurrentUserId()
      setCurrentUserId(userId)
    })()
  }, [authSession.currentUserId])

  const loadMembersForWorkspace = useCallback(async (workspaceId: string) => {
    const rows = await listMembers(workspaceId)
    const labeled = await Promise.all(
      rows.map(async (member) => {
        const label = await resolveUserLabel(member.userId)
        return {
          id: member.id,
          userId: member.userId,
          role: member.role,
          label,
        }
      }),
    )
    setMembersByWorkspaceId((prev) => ({ ...prev, [workspaceId]: labeled }))
  }, [])

  const loadInvitesForWorkspace = useCallback(async (workspaceId: string) => {
    setInviteListStatusByWorkspaceId((prev) => ({
      ...prev,
      [workspaceId]: { ...prev[workspaceId], isLoading: true, error: undefined },
    }))
    try {
      const client = createHttpClient(BASE_URL)
      const invites = await listWorkspaceInvites(client, workspaceId)
      setSentInvitesByWorkspaceId((prev) => ({ ...prev, [workspaceId]: invites }))
    } catch (err) {
      const message =
        (err as any)?.response?.data?.error?.message ??
        (err instanceof Error ? err.message : "Failed to load invites")
      setInviteListStatusByWorkspaceId((prev) => ({
        ...prev,
        [workspaceId]: { ...prev[workspaceId], error: message },
      }))
    } finally {
      setInviteListStatusByWorkspaceId((prev) => ({
        ...prev,
        [workspaceId]: { ...prev[workspaceId], isLoading: false },
      }))
    }
  }, [])

  const toggleWorkspaceExpanded = useCallback(
    (workspaceId: string) => {
      setExpandedWorkspaceIds((prev) => {
        const next = new Set(prev)
        if (next.has(workspaceId)) {
          next.delete(workspaceId)
        } else {
          next.add(workspaceId)
          void loadMembersForWorkspace(workspaceId)
          void loadInvitesForWorkspace(workspaceId)
        }
        return next
      })
    },
    [loadMembersForWorkspace, loadInvitesForWorkspace],
  )

  useEffect(() => {
    workspaces.forEach((workspace) => {
      void loadMembersForWorkspace(workspace.id)
    })
  }, [loadMembersForWorkspace, workspaces, syncStatus.lastSyncedAt])

  useFocusEffect(
    useCallback(() => {
      workspaces.forEach((workspace) => {
        void loadMembersForWorkspace(workspace.id)
        if (expandedWorkspaceIds.has(workspace.id)) {
          void loadInvitesForWorkspace(workspace.id)
        }
      })
    }, [expandedWorkspaceIds, loadInvitesForWorkspace, loadMembersForWorkspace, workspaces]),
  )

  const updateInviteEmail = useCallback((workspaceId: string, value: string) => {
    setInviteEmailByWorkspaceId((prev) => ({ ...prev, [workspaceId]: value }))
    setInviteStatusByWorkspaceId((prev) => ({
      ...prev,
      [workspaceId]: { ...prev[workspaceId], error: undefined, success: undefined },
    }))
  }, [])

  const handleInvite = useCallback(
    async (workspaceId: string, workspaceLabel: string) => {
      const trimmed = (inviteEmailByWorkspaceId[workspaceId] ?? "").trim().toLowerCase()
      if (!trimmed) {
        setInviteStatusByWorkspaceId((prev) => ({
          ...prev,
          [workspaceId]: { ...prev[workspaceId], error: "Email is required." },
        }))
        return
      }
      setInviteStatusByWorkspaceId((prev) => ({
        ...prev,
        [workspaceId]: {
          ...prev[workspaceId],
          error: undefined,
          success: undefined,
          isInviting: true,
        },
      }))
      try {
        const client = createHttpClient(BASE_URL)
        await inviteToWorkspace(client, workspaceId, trimmed, workspaceLabel)
        setInviteEmailByWorkspaceId((prev) => ({ ...prev, [workspaceId]: "" }))
        setInviteStatusByWorkspaceId((prev) => ({
          ...prev,
          [workspaceId]: { ...prev[workspaceId], success: "Invite sent.", isInviting: false },
        }))
        void loadInvitesForWorkspace(workspaceId)
      } catch (err) {
        const message =
          (err as any)?.response?.data?.error?.message ??
          (err instanceof Error ? err.message : "Failed to send invite")
        setInviteStatusByWorkspaceId((prev) => ({
          ...prev,
          [workspaceId]: { ...prev[workspaceId], error: message, isInviting: false },
        }))
      }
    },
    [inviteEmailByWorkspaceId, loadInvitesForWorkspace],
  )

  const workspaceSubtitle = useMemo(() => {
    const customCount = workspaces.filter((w) => w.kind !== "personal").length
    return customCount === 0 ? "Personal only" : `${customCount} shared projects`
  }, [workspaces])

  const handleRemoveMember = useCallback(async () => {
    if (!confirmRemove) return
    try {
      const client = createHttpClient(BASE_URL)
      await removeWorkspaceMember(client, confirmRemove.workspaceId, confirmRemove.userId)
      await syncController.triggerSync("manual")
      await loadMembersForWorkspace(confirmRemove.workspaceId)
    } catch (err) {
      const message =
        (err as any)?.response?.data?.error?.message ??
        (err instanceof Error ? err.message : "Failed to remove member")
      setInviteStatusByWorkspaceId((prev) => ({
        ...prev,
        [confirmRemove.workspaceId]: { ...prev[confirmRemove.workspaceId], error: message },
      }))
    } finally {
      setConfirmRemove(null)
    }
  }, [confirmRemove, loadMembersForWorkspace])

  const handleRevokeInvite = useCallback(async () => {
    if (!confirmRevoke) return
    try {
      const client = createHttpClient(BASE_URL)
      await revokeWorkspaceInvite(client, confirmRevoke.workspaceId, confirmRevoke.inviteId)
      await loadInvitesForWorkspace(confirmRevoke.workspaceId)
    } catch (err) {
      const message =
        (err as any)?.response?.data?.error?.message ??
        (err instanceof Error ? err.message : "Failed to revoke invite")
      setInviteListStatusByWorkspaceId((prev) => ({
        ...prev,
        [confirmRevoke.workspaceId]: { ...prev[confirmRevoke.workspaceId], error: message },
      }))
    } finally {
      setConfirmRevoke(null)
    }
  }, [confirmRevoke, loadInvitesForWorkspace])

  const handleDeleteWorkspace = useCallback(async () => {
    if (!confirmDelete) return
    try {
      const client = createHttpClient(BASE_URL)
      await deleteWorkspaceApi(client, confirmDelete.workspaceId)
      await deleteWorkspace(confirmDelete.workspaceId)
      await syncController.triggerSync("manual")
    } catch (err) {
      const message =
        (err as any)?.response?.data?.error?.message ??
        (err instanceof Error ? err.message : "Failed to delete workspace")
      setCreateError(message)
    } finally {
      setConfirmDelete(null)
    }
  }, [confirmDelete, deleteWorkspace])

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
              text="Sync, theme, projects, and account controls in a tighter mobile layout."
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
            <Text preset="caption" text={workspaceSubtitle} style={themed($muted)} />
          </View>
          <View style={themed($headerActionsRow)}>
            <Pressable
              accessibilityRole="button"
              style={themed($compactActionChip)}
              onPress={goToInvites}
              hitSlop={10}
            >
              <Text preset="caption" text="Invites" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={themed($compactActionChipPrimary)}
              onPress={() => setCreateExpanded((v) => !v)}
              hitSlop={10}
            >
              <Text preset="caption" text={createExpanded ? "Close" : "Create"} />
            </Pressable>
          </View>
        </View>

        {activeWorkspace ? (
          <View style={themed($currentProjectRow)}>
            <View style={themed($rowLeft)}>
              <Text preset="caption" text="Current project" style={themed($muted)} />
              <Text preset="formLabel" text={activeWorkspace.label} />
            </View>
            <Text
              preset="caption"
              text={activeWorkspace.kind === "personal" ? "Personal" : "Shared"}
              style={themed($muted)}
            />
          </View>
        ) : null}

        <View style={themed($projectList)}>
          {workspaces.map((workspace) => {
            const isExpanded = expandedWorkspaceIds.has(workspace.id)
            const members = membersByWorkspaceId[workspace.id] ?? []
            const ownerCount = members.filter((member) => member.role === "OWNER").length
            const isOwner =
              !!currentUserId &&
              members.some((member) => member.userId === currentUserId && member.role === "OWNER")
            const inviteStatus = inviteStatusByWorkspaceId[workspace.id]
            const inviteEmail = inviteEmailByWorkspaceId[workspace.id] ?? ""
            const sentInvites = sentInvitesByWorkspaceId[workspace.id] ?? []
            const inviteListStatus = inviteListStatusByWorkspaceId[workspace.id]
            return (
              <View key={workspace.id} style={themed($accordionCard)}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => toggleWorkspaceExpanded(workspace.id)}
                  style={themed($accordionHeader)}
                >
                  <View style={themed($rowLeft)}>
                    <View style={themed($accordionTitleRow)}>
                      <Text preset="formLabel" text={workspace.label} />
                      {activeWorkspace?.id === workspace.id ? (
                        <Text preset="caption" text="Current" style={themed($accentText)} />
                      ) : null}
                    </View>
                    <View style={themed($projectMetaLine)}>
                      <Text
                        preset="caption"
                        text={workspace.kind === "personal" ? "Personal" : "Project"}
                        style={themed($muted)}
                      />
                      <Text
                        preset="caption"
                        text={`${members.length} members`}
                        style={themed($muted)}
                      />
                    </View>
                  </View>
                  <View style={themed($accordionMeta)}>
                    <Text
                      preset="caption"
                      text={isExpanded ? "Hide" : "Manage"}
                      style={themed($muted)}
                    />
                  </View>
                </Pressable>

                {isExpanded ? (
                  <View style={themed($accordionBody)}>
                    <CompactSubsectionLabel text="Members" />
                    {members.length === 0 ? (
                      <Text preset="caption" text="No members synced yet." style={themed($muted)} />
                    ) : (
                      members.map((member) => (
                        <View key={member.id} style={themed($memberRow)}>
                          <View style={themed($rowLeft)}>
                            <Text
                              preset="caption"
                              text={member.label}
                              style={themed($strongText)}
                            />
                            <Text preset="caption" text={member.role} style={themed($muted)} />
                          </View>
                          {isOwner &&
                          member.userId !== currentUserId &&
                          !(member.role === "OWNER" && ownerCount <= 1) ? (
                            <Button
                              text="Remove"
                              preset="glass"
                              style={themed($compactDangerButton)}
                              onPress={() =>
                                setConfirmRemove({
                                  workspaceId: workspace.id,
                                  userId: member.userId,
                                  label: member.label,
                                })
                              }
                            />
                          ) : null}
                        </View>
                      ))
                    )}

                    <View style={themed($divider)} />
                    {workspace.kind === "personal" || !isOwner ? null : (
                      <View style={themed($stack)}>
                        <CompactSubsectionLabel text="Sent invites" />
                        {inviteListStatus?.isLoading ? (
                          <Text preset="caption" text="Loading invites..." style={themed($muted)} />
                        ) : inviteListStatus?.error ? (
                          <Text
                            preset="caption"
                            text={inviteListStatus.error}
                            style={themed($errorText)}
                          />
                        ) : sentInvites.length === 0 ? (
                          <Text preset="caption" text="No invites yet." style={themed($muted)} />
                        ) : (
                          sentInvites.map((invite) => (
                            <View key={invite.id} style={themed($inviteRow)}>
                              <View style={themed($rowLeft)}>
                                <Text
                                  preset="caption"
                                  text={invite.email}
                                  style={themed($strongText)}
                                />
                                <Text
                                  preset="caption"
                                  text={`${invite.status} · Expires ${formatDateTime(invite.expiresAt)}`}
                                  style={themed($muted)}
                                />
                              </View>
                              {invite.status === "PENDING" ? (
                                <Button
                                  text="Revoke"
                                  preset="glass"
                                  style={themed($compactDangerButton)}
                                  onPress={() =>
                                    setConfirmRevoke({
                                      workspaceId: workspace.id,
                                      inviteId: invite.id,
                                      email: invite.email,
                                    })
                                  }
                                />
                              ) : null}
                            </View>
                          ))
                        )}
                        <View style={themed($divider)} />
                      </View>
                    )}

                    <CompactSubsectionLabel text="Invite member" />
                    {workspace.kind === "personal" ? (
                      <Text
                        preset="caption"
                        text="Personal projects cannot be shared."
                        style={themed($muted)}
                      />
                    ) : !isOwner ? (
                      <Text
                        preset="caption"
                        text="Owner permission required to invite members."
                        style={themed($muted)}
                      />
                    ) : (
                      <>
                        <TextField
                          value={inviteEmail}
                          onChangeText={(value) => updateInviteEmail(workspace.id, value)}
                          placeholder="Email address"
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                        {inviteStatus?.error ? (
                          <Text
                            preset="caption"
                            text={inviteStatus.error}
                            style={themed($errorText)}
                          />
                        ) : inviteStatus?.success ? (
                          <Text
                            preset="caption"
                            text={inviteStatus.success}
                            style={themed($successText)}
                          />
                        ) : null}
                        <View style={themed($actionsRow)}>
                          <Button
                            text={inviteStatus?.isInviting ? "Sending..." : "Send invite"}
                            preset="glass"
                            onPress={() => handleInvite(workspace.id, workspace.label)}
                            disabled={!!inviteStatus?.isInviting}
                          />
                        </View>
                      </>
                    )}

                    <View style={themed($divider)} />
                    <CompactSubsectionLabel text="Project actions" />
                    <View style={themed($actionsRow)}>
                      {workspace.kind === "personal" ? null : (
                        <Button
                          text="Rename"
                          preset="glass"
                          onPress={() => openRenameModal(workspace.id, workspace.label)}
                          style={themed($compactActionButton)}
                        />
                      )}
                      {workspace.kind !== "personal" && isOwner ? (
                        <Button
                          text="Delete"
                          preset="glass"
                          style={themed($compactDangerButton)}
                          onPress={() =>
                            setConfirmDelete({ workspaceId: workspace.id, label: workspace.label })
                          }
                        />
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </View>
            )
          })}

          {/* Expandable create project */}
          {createExpanded ? (
            <View style={themed($expandArea)}>
              <View style={themed($divider)} />
              <CompactSubsectionLabel text="New project" />
              <TextField
                value={newWorkspaceLabel}
                onChangeText={(value) => {
                  setNewWorkspaceLabel(value)
                  if (createError) setCreateError(null)
                }}
                placeholder="Project name"
              />
              {createError ? (
                <Text preset="formHelper" text={createError} style={themed($errorText)} />
              ) : null}

              <View style={themed($actionsRow)}>
                <Button
                  text="Cancel"
                  preset="glass"
                  style={themed($compactActionButton)}
                  onPress={() => {
                    setCreateExpanded(false)
                    setCreateError(null)
                    setNewWorkspaceLabel("")
                  }}
                />
                <Button
                  text="Create"
                  preset="glass"
                  style={themed($compactActionButton)}
                  onPress={handleCreateWorkspace}
                />
              </View>
            </View>
          ) : null}
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

      {/* Rename modal */}
      <Modal
        visible={showRenameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRenameModal(false)}
      >
        <View style={themed($backdrop)}>
          <GlassCard style={themed($modalCard)}>
            <Text preset="heading" text="Rename project" />
            <TextField
              value={renameLabel}
              onChangeText={(value) => {
                setRenameLabel(value)
                if (renameError) setRenameError(null)
              }}
              placeholder="Project name"
            />
            {renameError ? (
              <Text preset="formHelper" text={renameError} style={themed($errorText)} />
            ) : null}

            <View style={themed($actionsRow)}>
              <Button
                text="Cancel"
                preset="glass"
                onPress={() => {
                  setShowRenameModal(false)
                  setRenameWorkspaceId(null)
                  setRenameLabel("")
                  setRenameError(null)
                }}
              />
              <Button text="Save" preset="glass" onPress={handleRenameWorkspace} />
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Remove member confirm */}
      <Modal visible={!!confirmRemove} transparent animationType="fade">
        <View style={themed($backdrop)}>
          <GlassCard style={themed($modalCard)}>
            <Text preset="heading" text="Remove member?" />
            <Text
              preset="formHelper"
              text={confirmRemove ? `Remove ${confirmRemove.label} from this project?` : ""}
            />
            <View style={themed($actionsRow)}>
              <Button text="Cancel" preset="glass" onPress={() => setConfirmRemove(null)} />
              <Button
                text="Remove"
                preset="glass"
                style={themed($compactDangerButton)}
                onPress={handleRemoveMember}
              />
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Revoke invite confirm */}
      <Modal visible={!!confirmRevoke} transparent animationType="fade">
        <View style={themed($backdrop)}>
          <GlassCard style={themed($modalCard)}>
            <Text preset="heading" text="Revoke invite?" />
            <Text
              preset="formHelper"
              text={confirmRevoke ? `Revoke invite for ${confirmRevoke.email}?` : ""}
            />
            <View style={themed($actionsRow)}>
              <Button text="Cancel" preset="glass" onPress={() => setConfirmRevoke(null)} />
              <Button
                text="Revoke"
                preset="glass"
                style={themed($compactDangerButton)}
                onPress={handleRevokeInvite}
              />
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Delete project confirm */}
      <Modal visible={!!confirmDelete} transparent animationType="fade">
        <View style={themed($backdrop)}>
          <GlassCard style={themed($modalCard)}>
            <Text preset="heading" text="Delete project?" />
            <Text
              preset="formHelper"
              text={confirmDelete ? `Delete ${confirmDelete.label}? This cannot be undone.` : ""}
            />
            <View style={themed($actionsRow)}>
              <Button text="Cancel" preset="glass" onPress={() => setConfirmDelete(null)} />
              <Button
                text="Delete"
                preset="glass"
                style={themed($compactDangerButton)}
                onPress={handleDeleteWorkspace}
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

function CompactSubsectionLabel({ text }: { text: string }) {
  const { themed } = useAppTheme()
  return <Text preset="caption" text={text} style={themed($subsectionLabel)} />
}

const $screen: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.screenHorizontal,
  paddingTop: spacing.md,
  gap: spacing.md,
  paddingBottom: spacing.xxxl,
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

const $headerActionsRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
})

const $stack: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
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

const $rowLeft: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxxs,
})

const $projectList: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
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

const $accordionCard: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  borderRadius: radius.large,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
  gap: spacing.sm,
})

const $accordionHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  gap: spacing.sm,
})

const $accordionTitleRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
})

const $projectMetaLine: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xs,
})

const $accordionMeta: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
})

const $accordionBody: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $memberRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
  minHeight: 42,
})

const $inviteRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
  minHeight: 42,
})

const $divider: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  height: 1,
  backgroundColor: colors.borderSubtle,
  marginVertical: spacing.xs,
})

const $expandArea: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $actionsRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xs,
})

const $compactActionButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.sm,
})

const $compactActionChip: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surfaceGlass,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
})

const $compactActionChipPrimary: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.primary,
  backgroundColor: colors.glowSoft,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
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

const $accentText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.primary,
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

const $compactDangerButton: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  borderColor: colors.danger,
  paddingHorizontal: spacing.sm,
})

const $successText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.success,
})
