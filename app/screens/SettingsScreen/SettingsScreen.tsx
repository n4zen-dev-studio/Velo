import { useCallback, useEffect, useMemo, useState } from "react"
import { Modal, Pressable, View, ViewStyle, TextStyle } from "react-native"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { Switch } from "@/components/Toggle/Switch"
import { clearLocalData } from "@/services/db"
import { clearCurrentUserId, getCurrentUserId, setSessionMode } from "@/services/sync/identity"
import { clearOfflineMode } from "@/services/storage/session"
import { goToAuth } from "@/navigation/navigationActions"
import { goToInvites } from "@/navigation/navigationActions"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { useAuthViewModel } from "@/screens/AuthScreen/useAuthViewModel"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { createHttpClient } from "@/services/api/httpClient"
import { inviteToWorkspace } from "@/services/api/invitesApi"
import { BASE_URL } from "@/config/api"
import { listByWorkspaceId as listMembers } from "@/services/db/repositories/workspaceMembersRepository"
import { getUserLabelById } from "@/services/db/repositories/usersRepository"

import { useSettingsViewModel } from "./useSettingsViewModel"

export function SettingsScreen() {
  const { themed, toggleTheme } = useAppTheme()

  const { options, setOption } = useSettingsViewModel()
  // NOTE: setOption is expected to exist now for functionality.
  // If your hook currently doesn't expose it, add:
  //   const setOption = (id: string, value: boolean) => update state + persist
  // so this screen can remain dumb UI.

  const { logoutUser } = useAuthViewModel()
  const { workspaces, createWorkspace, renameWorkspace } = useWorkspaceStore()

  const [showLogoutModal, setShowLogoutModal] = useState(false)

  const [createExpanded, setCreateExpanded] = useState(false)
  const [newWorkspaceLabel, setNewWorkspaceLabel] = useState("")
  const [createError, setCreateError] = useState<string | null>(null)

  const [renameWorkspaceId, setRenameWorkspaceId] = useState<string | null>(null)
  const [renameLabel, setRenameLabel] = useState("")
  const [renameError, setRenameError] = useState<string | null>(null)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = useState<Set<string>>(new Set())
  const [inviteEmailByWorkspaceId, setInviteEmailByWorkspaceId] = useState<Record<string, string>>({})
  const [inviteStatusByWorkspaceId, setInviteStatusByWorkspaceId] = useState<
    Record<string, { error?: string; success?: string; isInviting?: boolean }>
  >({})
  const [membersByWorkspaceId, setMembersByWorkspaceId] = useState<
    Record<string, Array<{ id: string; label: string; role: string; userId: string }>>
  >({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const validateWorkspaceLabel = (label: string, excludeId?: string | null) => {
    const trimmed = label.trim()
    if (trimmed.length < 2 || trimmed.length > 40) return "Workspace name must be 2-40 characters."
    const normalized = trimmed.toLowerCase()
    const conflicts = workspaces.some((w) => w.id !== excludeId && w.label.trim().toLowerCase() === normalized)
    if (conflicts) return "A workspace with that name already exists."
    return null
  }

  const handleLogout = async () => {
    await logoutUser()
    setShowLogoutModal(true)
  }

  const handleKeepLocal = async () => {
    await setSessionMode("local")
    setShowLogoutModal(false)
    await clearOfflineMode()
    goToAuth()
  }

  const handleWipeLocal = async () => {
    await clearLocalData()
    await clearCurrentUserId()
    await setSessionMode("local")
    setShowLogoutModal(false)
    await clearOfflineMode()
    goToAuth()
  }

  const handleCreateWorkspace = async () => {
    const error = validateWorkspaceLabel(newWorkspaceLabel)
    setCreateError(error)
    if (error) return
    await createWorkspace(newWorkspaceLabel.trim(), true)
    setNewWorkspaceLabel("")
    setCreateError(null)
    setCreateExpanded(false)
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
  }, [])

  const loadMembersForWorkspace = useCallback(async (workspaceId: string) => {
    const rows = await listMembers(workspaceId)
    const labeled = await Promise.all(
      rows.map(async (member) => {
        const resolved = await getUserLabelById(member.userId)
        const label = member.userId === currentUserId ? "You" : resolved ?? `User · ${member.userId.slice(-4)}`
        return {
          id: member.id,
          userId: member.userId,
          role: member.role,
          label,
        }
      }),
    )
    setMembersByWorkspaceId((prev) => ({ ...prev, [workspaceId]: labeled }))
  }, [currentUserId])

  const toggleWorkspaceExpanded = useCallback(
    (workspaceId: string) => {
      setExpandedWorkspaceIds((prev) => {
        const next = new Set(prev)
        if (next.has(workspaceId)) {
          next.delete(workspaceId)
        } else {
          next.add(workspaceId)
          void loadMembersForWorkspace(workspaceId)
        }
        return next
      })
    },
    [loadMembersForWorkspace],
  )

  useEffect(() => {
    workspaces.forEach((workspace) => {
      void loadMembersForWorkspace(workspace.id)
    })
  }, [loadMembersForWorkspace, workspaces])

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
        [workspaceId]: { ...prev[workspaceId], error: undefined, success: undefined, isInviting: true },
      }))
      try {
        const client = createHttpClient(BASE_URL)
        await inviteToWorkspace(client, workspaceId, trimmed, workspaceLabel)
        setInviteEmailByWorkspaceId((prev) => ({ ...prev, [workspaceId]: "" }))
        setInviteStatusByWorkspaceId((prev) => ({
          ...prev,
          [workspaceId]: { ...prev[workspaceId], success: "Invite sent.", isInviting: false },
        }))
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to send invite"
        setInviteStatusByWorkspaceId((prev) => ({
          ...prev,
          [workspaceId]: { ...prev[workspaceId], error: message, isInviting: false },
        }))
      }
    },
    [inviteEmailByWorkspaceId],
  )

  const workspaceSubtitle = useMemo(() => {
    const customCount = workspaces.filter((w) => w.kind !== "personal").length
    return customCount === 0 ? "Personal only" : `${customCount} custom`
  }, [workspaces])

  return (
    <Screen preset="scroll" safeAreaEdges={["top", "bottom"]} contentContainerStyle={themed($screen)}>
      <View style={themed($header)}>
        <Text preset="heading" text="Settings" />
        <Text preset="formHelper" text="Control sync and offline preferences" />
      </View>

      {/* Preferences */}
      <GlassCard>
        <View style={themed($cardHeaderRow)}>
          <Text preset="subheading" text="Preferences" />
          {/* <Text preset="formHelper" text={`${options.length} options`} style={themed($muted)} /> */}
        </View>

        <View style={themed($stack)}>
          {options.map((option: any) => (
            <View key={option.id} style={themed($toggleRow)}>
              <View style={themed($toggleLeft)}>
                <Text preset="formLabel" text={option.label} />
                {option.helperText ? <Text preset="formHelper" text={option.helperText} style={themed($muted)} /> : null}
              </View>

              <Switch value={!!option.value} onValueChange={(value) => setOption(option.id, value)} />
            </View>
          ))}
        </View>
      </GlassCard>

      <View>
        <Button tx="welcomeScreen:SwitchTheme" onPress={toggleTheme} preset="glass" />
      </View>

      {/* Workspaces */}
      <GlassCard>
        <View style={themed($cardHeaderRow)}>
          <View style={themed($titleBlock)}>
            <Text preset="subheading" text="Workspaces" />
            <Text preset="formHelper" text={workspaceSubtitle} style={themed($muted)} />
          </View>
          <View style={themed($headerActionsRow)}>
            <Button text="Invites" preset="glass" onPress={goToInvites} />
            <Pressable
              accessibilityRole="button"
              style={themed($pillButton)}
              onPress={() => setCreateExpanded((v) => !v)}
              hitSlop={10}
            >
              <Text preset="formHelper" text={createExpanded ? "Close" : "Create"} style={themed($pillText)} />
              <Text preset="formHelper" text={createExpanded ? "▴" : "▾"} style={themed($pillText)} />
            </Pressable>
          </View>
        </View>

        <View style={themed($stack)}>
          {workspaces.map((workspace) => {
            const isExpanded = expandedWorkspaceIds.has(workspace.id)
            const members = membersByWorkspaceId[workspace.id] ?? []
            const inviteStatus = inviteStatusByWorkspaceId[workspace.id]
            const inviteEmail = inviteEmailByWorkspaceId[workspace.id] ?? ""
            return (
              <View key={workspace.id} style={themed($accordionCard)}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => toggleWorkspaceExpanded(workspace.id)}
                  style={themed($accordionHeader)}
                >
                  <View style={themed($rowLeft)}>
                    <Text preset="formLabel" text={workspace.label} />
                    <Text
                      preset="formHelper"
                      text={workspace.kind === "personal" ? "Personal" : "Workspace"}
                      style={themed($muted)}
                    />
                  </View>

                  <View style={themed($accordionMeta)}>
                    <Text preset="formHelper" text={`${members.length} members`} style={themed($muted)} />
                    <Text preset="formHelper" text={isExpanded ? "▴" : "▾"} style={themed($muted)} />
                  </View>
                </Pressable>

                {isExpanded ? (
                  <View style={themed($accordionBody)}>
                    <View style={themed($accordionRow)}>
                      <Text preset="formLabel" text="Members" />
                      {workspace.kind === "personal" ? null : (
                        <Button
                          text="Rename"
                          preset="glass"
                          onPress={() => openRenameModal(workspace.id, workspace.label)}
                          style={themed($smallButton)}
                        />
                      )}
                    </View>

                    {members.length === 0 ? (
                      <Text preset="formHelper" text="No members synced yet." style={themed($muted)} />
                    ) : (
                      members.map((member) => (
                        <View key={member.id} style={themed($memberRow)}>
                          <View style={themed($rowLeft)}>
                            <Text preset="formLabel" text={member.label} />
                            <Text preset="formHelper" text={member.role} style={themed($muted)} />
                          </View>
                        </View>
                      ))
                    )}

                    <View style={themed($divider)} />
                    <Text preset="formLabel" text="Invite member" />
                    {workspace.kind === "personal" ? (
                      <Text preset="formHelper" text="Personal workspace cannot be shared." style={themed($muted)} />
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
                          <Text preset="formHelper" text={inviteStatus.error} style={themed($errorText)} />
                        ) : inviteStatus?.success ? (
                          <Text preset="formHelper" text={inviteStatus.success} style={themed($successText)} />
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
                  </View>
                ) : null}
              </View>
            )
          })}

          {/* Expandable create workspace */}
          {createExpanded ? (
            <View style={themed($expandArea)}>
              <View style={themed($divider)} />
              <Text preset="formLabel" text="New workspace" />
              <TextField
                value={newWorkspaceLabel}
                onChangeText={(value) => {
                  setNewWorkspaceLabel(value)
                  if (createError) setCreateError(null)
                }}
                placeholder="Workspace name"
              />
              {createError ? <Text preset="formHelper" text={createError} style={themed($errorText)} /> : null}

              <View style={themed($actionsRow)}>
                <Button
                  text="Cancel"
                  preset="glass"
                  onPress={() => {
                    setCreateExpanded(false)
                    setCreateError(null)
                    setNewWorkspaceLabel("")
                  }}
                />
                <Button text="Create" preset="glass" onPress={handleCreateWorkspace} />
              </View>
            </View>
          ) : null}
        </View>
      </GlassCard>

      {/* Account */}
      <GlassCard>
        <View style={themed($cardHeaderRow)}>
          <Text preset="subheading" text="Account" />
          <Text preset="formHelper" text="Sign out options" style={themed($muted)} />
        </View>
        <Button text="Logout" preset="glass" onPress={handleLogout} />
      </GlassCard>

      {/* Logout modal */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={themed($backdrop)}>
          <GlassCard style={themed($modalCard)}>
            <Text preset="heading" text="Sign out" />
            <Text preset="formHelper" text="Choose what to do with your local data on this device." />

            <View style={themed($modalButtons)}>
              <Button text="Keep local data" preset="glass" onPress={handleKeepLocal} />
              <Button text="Wipe local data" preset="glass" onPress={handleWipeLocal} />
              <Button text="Cancel" preset="glass" onPress={() => setShowLogoutModal(false)} />
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
            <Text preset="heading" text="Rename workspace" />
            <TextField
              value={renameLabel}
              onChangeText={(value) => {
                setRenameLabel(value)
                if (renameError) setRenameError(null)
              }}
              placeholder="Workspace name"
            />
            {renameError ? <Text preset="formHelper" text={renameError} style={themed($errorText)} /> : null}

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

const $cardHeaderRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: spacing.sm,
  marginBottom: spacing.sm,
})

const $titleBlock: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxs,
})

const $headerActionsRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
})

const $stack: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.md,
})

const $toggleRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  gap: spacing.md,
})

const $toggleLeft: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxs,
})

const $rowLeft: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxs,
})

const $accordionCard: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 16,
  padding: spacing.sm,
  gap: spacing.sm,
})

const $accordionHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  gap: spacing.sm,
})

const $accordionMeta: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
})

const $accordionBody: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $accordionRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
})

const $memberRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
})

const $divider: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  height: 1,
  backgroundColor: colors.border,
  marginVertical: spacing.sm,
})

const $expandArea: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $actionsRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
})

const $smallButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.sm,
})

const $pillButton: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
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

const $pillText: ThemedStyle<TextStyle> = () => ({
  opacity: 0.9,
})

const $muted: ThemedStyle<TextStyle> = () => ({
  opacity: 0.85,
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
  gap: spacing.md,
})

const $modalButtons: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $errorText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
})

const $successText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
})
