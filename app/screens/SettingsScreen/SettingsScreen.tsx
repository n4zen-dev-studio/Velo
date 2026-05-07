import { useState } from "react"
import { Modal, View, ViewStyle, TextStyle } from "react-native"
import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { Switch } from "@/components/Toggle/Switch"
import { clearLocalData } from "@/services/db"
import { clearCurrentUserId, setSessionMode } from "@/services/sync/identity"
import { clearOfflineMode } from "@/services/storage/session"
import { goToAuth } from "@/navigation/navigationActions"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { useAuthViewModel } from "@/screens/AuthScreen/useAuthViewModel"
import { useWorkspaceStore } from "@/stores/workspaceStore"

import { useSettingsViewModel } from "./useSettingsViewModel"

export function SettingsScreen() {
  const { themed, toggleTheme } = useAppTheme()
  const { options } = useSettingsViewModel()
  const { logoutUser } = useAuthViewModel()
  const { workspaces, createWorkspace, renameWorkspace } = useWorkspaceStore()
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [newWorkspaceLabel, setNewWorkspaceLabel] = useState("")
  const [createError, setCreateError] = useState<string | null>(null)
  const [renameWorkspaceId, setRenameWorkspaceId] = useState<string | null>(null)
  const [renameLabel, setRenameLabel] = useState("")
  const [renameError, setRenameError] = useState<string | null>(null)
  const [showRenameModal, setShowRenameModal] = useState(false)

  const validateWorkspaceLabel = (label: string, excludeId?: string | null) => {
    const trimmed = label.trim()
    if (trimmed.length < 2 || trimmed.length > 40) {
      return "Workspace name must be 2-40 characters."
    }
    const normalized = trimmed.toLowerCase()
    const conflicts = workspaces.some(
      (w) => w.id !== excludeId && w.label.trim().toLowerCase() === normalized,
    )
    if (conflicts) {
      return "A workspace with that name already exists."
    }
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

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screen)}>
      <View style={themed($header)}>
        <Text preset="heading" text="Settings" />
        <Text preset="formHelper" text="Control sync and offline preferences" />
      </View>

      <GlassCard>
        <View style={themed($stack)}>
          {options.map((option) => (
            <View key={option.id} style={themed($row)}>
              <Text preset="formLabel" text={option.label} />
              <Switch value={option.value} onValueChange={() => undefined} />
            </View>
          ))}
        </View>
      </GlassCard>

            {/* Temporary test button (keep as requested) */}
            <View>
              <Button tx="welcomeScreen:SwitchTheme" onPress={toggleTheme} />
            </View>

      <GlassCard>
        <View style={themed($stack)}>
          <Text preset="subheading" text="Workspaces" />
          {workspaces.map((workspace) => (
            <View key={workspace.id} style={themed($row)}>
              <View style={themed($rowLeft)}>
                <Text preset="formLabel" text={workspace.label} />
                <Text
                  preset="formHelper"
                  text={workspace.kind === "personal" ? "Personal" : "Custom workspace"}
                />
              </View>
              {workspace.kind === "personal" ? null : (
                <Button
                  text="Rename"
                  preset="default"
                  onPress={() => openRenameModal(workspace.id, workspace.label)}
                />
              )}
            </View>
          ))}

          <View style={themed($divider)} />
          <Text preset="formLabel" text="Create workspace" />
          <TextField
            value={newWorkspaceLabel}
            onChangeText={(value) => {
              setNewWorkspaceLabel(value)
              if (createError) setCreateError(null)
            }}
            placeholder="Workspace name"
          />
          {createError ? <Text preset="formHelper" text={createError} style={themed($errorText)} /> : null}
          <Button text="Create workspace" preset="reversed" onPress={handleCreateWorkspace} />
        </View>
      </GlassCard>

      <GlassCard>
        <Button text="Logout" preset="reversed" onPress={handleLogout} />
      </GlassCard>

      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={themed($backdrop)}>
          <GlassCard style={themed($modalCard)}>
            <Text preset="heading" text="Sign out" />
            <Text
              preset="formHelper"
              text="Choose what to do with your local data on this device."
            />
            <View style={themed($modalButtons)}>
              <Button text="Keep local data" preset="default" onPress={handleKeepLocal} />
              <Button text="Wipe local data" preset="reversed" onPress={handleWipeLocal} />
            </View>
          </GlassCard>
        </View>
      </Modal>


      <Modal visible={showRenameModal} transparent animationType="fade" onRequestClose={() => setShowRenameModal(false)}>
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
            <View style={themed($modalButtons)}>
              <Button
                text="Cancel"
                preset="reversed"
                onPress={() => {
                  setShowRenameModal(false)
                  setRenameWorkspaceId(null)
                  setRenameLabel("")
                  setRenameError(null)
                }}
              />
              <Button text="Save" preset="default" onPress={handleRenameWorkspace} />
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

const $stack: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.md,
})

const $row: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  gap: spacing.sm,
})

const $rowLeft: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxs,
})

const $divider: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  height: 1,
  backgroundColor: colors.border,
  marginVertical: spacing.sm,
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
