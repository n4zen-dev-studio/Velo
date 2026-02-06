import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  UIManager,
  View,
  ViewStyle,
  TextStyle,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { PriorityDot } from "@/components/PriorityDot"
import { Screen } from "@/components/Screen"
import { SyncBadge } from "@/components/SyncBadge"
import { Text } from "@/components/Text"
import { HeaderAvatar } from "@/components/HeaderAvatar"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import type { HomeStackScreenProps } from "@/navigators/navigationTypes"
import { goToInvites, goToProfile, goToSettingsTab } from "@/navigation/navigationActions"
import { createHttpClient } from "@/services/api/httpClient"
import { listMyInvites } from "@/services/api/invitesApi"
import { BASE_URL } from "@/config/api"

import { useHomeViewModel } from "./useHomeViewModel"

export function HomeScreen() {
  const { themed, toggleTheme } = useAppTheme()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<HomeStackScreenProps<"Home">["navigation"]>()

  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    uiTasksByStatus,
    refreshAll,
    isRefreshing,
    bumpTaskStatus,
  } = useHomeViewModel()

  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0)

  const activeWorkspace = useMemo(() => {
    return workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0]
  }, [workspaces, activeWorkspaceId])

  const fabBottom = Math.max(insets.bottom, 0) + 50

  const loadInvitesCount = useCallback(async () => {
    try {
      const client = createHttpClient(BASE_URL)
      const invites = await listMyInvites(client)
      setPendingInvitesCount(invites.length)
    } catch {
      setPendingInvitesCount(0)
    }
  }, [])

  useEffect(() => {
    if (!workspaceMenuOpen) return
    void loadInvitesCount()
  }, [loadInvitesCount, workspaceMenuOpen])

  useEffect(() => {
    if (Platform.OS !== "android") return
    if (!UIManager.setLayoutAnimationEnabledExperimental) return
    UIManager.setLayoutAnimationEnabledExperimental(true)
  }, [])

  return (
    <Screen preset="fixed" safeAreaEdges={["top", "bottom"]} contentContainerStyle={themed($screen)}>
      {/* Header */}
      <View style={themed($header)}>
         <View style={themed($headerActions)}>
          <HeaderAvatar onPress={goToProfile} size={50} />
        </View>
        <View style={themed($titleBlock)}>
          <Text preset="heading" text="Home" />
          {/* Single workspace indicator (button opens dropdown) */}
          <Pressable
            accessibilityRole="button"
            onPress={() => setWorkspaceMenuOpen(true)}
            style={themed($workspacePill)}
            hitSlop={10}
          >
            <Text
              preset="formHelper"
              text={activeWorkspace?.label ?? "Workspace"}
              style={themed($workspacePillText)}
              numberOfLines={1}
            />
            <Text preset="subheading" text="▾" style={themed($chev)} />
          </Pressable>
        </View>

        <View style={themed($headerActions)}>
          <SyncBadge />
        </View>
      </View>

      {/* Scroll content */}
      <ScrollView
        contentContainerStyle={themed($scrollContent)}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => refreshAll({ mode: "hard" })} />}
        showsVerticalScrollIndicator={false}
      >
        {uiTasksByStatus.map(({ status, tasks }, laneIndex) => (
          <View
            key={`${status.workspaceId}:${status.projectId ?? "personal"}:${status.id}`}
            style={themed($section)}
          >
            <View style={themed($sectionHeader)}>
              <Text preset="subheading" text={status.name} />
              <Text preset="formHelper" text={`${tasks.length} tasks`} />
            </View>

            {tasks.length === 0 ? (
              <GlassCard>
                <Text preset="formHelper" text="No tasks in this lane yet." />
              </GlassCard>
            ) : (
              <View style={themed($cardsCol)}>
                {tasks.map((task) => (
                  <Pressable
                    key={`${task.workspaceId}:${task.projectId ?? "personal"}:${task.id}`}
                    onPress={() => navigation.navigate("TaskDetail", { taskId: task.id })}
                    style={themed($pressableCard)}
                  >
                    <GlassCard>
                      <View style={themed($taskHeaderRow)}>
                        <View style={themed($taskRow)}>
                          <PriorityDot priority={task.priority} />
                          <Text preset="subheading" text={task.title} style={themed($taskTitle)} />
                        </View>
                        <View style={themed($statusControls)}>
                          {laneIndex > 0 ? (
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation?.()
                                console.log("[ArrowPress]", { taskId: task.id, laneIndex, dir: "up", task })
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                                void bumpTaskStatus(task.id, laneIndex, "up")
                              }}
                              style={({ pressed }) => [
                                themed($statusButton),
                                pressed ? themed($statusButtonPressed) : null,
                              ]}
                              hitSlop={6}
                            >
                              <Text preset="formHelper" text="↑" style={themed($statusArrow)} />
                            </Pressable>
                          ) : null}
                          {laneIndex < uiTasksByStatus.length - 1 ? (
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation?.()
                                console.log("[ArrowPress]", { taskId: task.id, laneIndex, dir: "down", task })
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                                void bumpTaskStatus(task.id, laneIndex, "down")
                              }}
                              style={({ pressed }) => [
                                themed($statusButton),
                                pressed ? themed($statusButtonPressed) : null,
                              ]}
                              hitSlop={6}
                            >
                              <Text preset="formHelper" text="↓" style={themed($statusArrow)} />
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                      {!!task.description && (
                        <Text preset="formHelper" text={task.description} style={themed($taskDesc)} />
                      )}
                    </GlassCard>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* spacer so last content doesn’t hide behind FAB */}
        <View style={{ height: 90 + fabBottom }} />
      </ScrollView>

      {/* Sticky FAB (outside ScrollView so it does NOT scroll) */}
      <Pressable
        accessibilityRole="button"
        style={[themed($fab), { bottom: fabBottom }]}
        onPress={() => navigation.navigate("TaskEditor")}
      >
        <Text preset="heading" text="+" />
      </Pressable>

      {/* Workspace dropdown */}
      <Modal visible={workspaceMenuOpen} transparent animationType="fade" onRequestClose={() => setWorkspaceMenuOpen(false)}>
        <Pressable style={themed($modalBackdrop)} onPress={() => setWorkspaceMenuOpen(false)}>
          <Pressable style={themed($menuCard)} onPress={() => {}}>
            <View style={themed($menuHeader)}>
              <Text preset="subheading" text="Workspaces" />
              <Pressable onPress={() => setWorkspaceMenuOpen(false)} hitSlop={10}>
                <Text preset="formHelper" text="Close" />
              </Pressable>
            </View>

            <View style={themed($menuList)}>
              {workspaces.map((w) => {
                const isActive = w.id === activeWorkspaceId
                return (
                  <Pressable
                    key={w.id}
                    onPress={() => {
                      setWorkspaceMenuOpen(false)
                      void (async () => {
                        try {
                          await setActiveWorkspaceId(w.id)
                        } catch (error) {
                          console.warn("[Workspace] Failed to switch workspace", error)
                        }
                      })()
                    }}
                    style={themed(isActive ? $menuItemActive : $menuItem)}
                  >
                    <View style={themed($menuItemLeft)}>
                      <Text preset="subheading" text={w.label} />
                      {/* <Text preset="formHelper" text={w.projectId ? "Project" : "Personal"} /> */}
                    </View>
                    {isActive ? <Text preset="formHelper" text="✓" /> : null}
                  </Pressable>
                )
              })}
            </View>

            <View style={themed($menuFooter)}>
              {/* “Create workspace” entry near the dropdown, as requested.
                  Re-using settings tab as the safest existing flow without breaking the app. */}
              <Button
                text="Create workspace"
                preset="reversed"
                onPress={() => {
                  setWorkspaceMenuOpen(false)
                  goToSettingsTab()
                }}
              />
                {pendingInvitesCount > 0 ? (
              <View style={themed($menuFooterRow)}>
                <Button
                  text="Workspace Invites"
                  preset="reversed"
                  onPress={() => {
                    setWorkspaceMenuOpen(false)
                    goToInvites()
                  }}
                  style={{ marginTop:  10, flex: 1 }}
                />
                  <View style={themed($inviteBadge)}>
                    <Text preset="formHelper" text={`${pendingInvitesCount}`} style={themed($inviteBadgeText)} />
                  </View>
              </View>
                ) : null}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  )
}

const $screen: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.lg,
  paddingTop: spacing.md,
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: spacing.md,
})

const $titleBlock: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xs,
})

const $headerActions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
})

const $tempRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.lg,
  paddingTop: spacing.sm,
})

const $scrollContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingTop: spacing.lg,
  paddingBottom: spacing.xl,
  gap: spacing.lg,
})

const $workspacePill: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignSelf: "flex-start",
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.background, // works well with your glass theme (and stays readable)
})

const $workspacePillText: ThemedStyle<TextStyle> = () => ({
  maxWidth: 220,
})

const $chev: ThemedStyle<TextStyle> = () => ({
  opacity: 0.8,
})

const $section: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.lg,
  gap: spacing.sm,
})

const $sectionHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "baseline",
  marginBottom: spacing.xs,
})

const $cardsCol: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $pressableCard: ThemedStyle<ViewStyle> = () => ({
  // keeps press area clean without changing your GlassCard component
})

const $taskRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
  marginBottom: spacing.xs,
})

const $taskHeaderRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: spacing.sm,
})

const $taskTitle: ThemedStyle<TextStyle> = () => ({
  flex: 1,
})

const $taskDesc: ThemedStyle<TextStyle> = () => ({
  opacity: 0.9,
})

const $statusControls: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  gap: spacing.xs,
})

const $statusButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 28,
  height: 28,
  borderRadius: 10,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.background,
})

const $statusButtonPressed: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.palette.primary300,
  backgroundColor: colors.palette.primary100,
})

const $statusArrow: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  lineHeight: 18,
})

const $fab: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  position: "absolute",
  right: spacing.lg,
  width: 56,
  height: 56,
  borderRadius: 28,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.palette.primary,
  shadowColor: colors.palette.neutral900,
  shadowOpacity: 0.2,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
})

const $modalBackdrop: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.35)",
  justifyContent: "center",
  padding: 16,
})

const $menuCard: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  borderRadius: 20,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.background,
  padding: spacing.md,
  gap: spacing.md,
})

const $menuHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
})

const $menuList: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $menuItem: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.sm,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: colors.border,
})

const $menuItemActive: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.sm,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: colors.palette.primary500,
})

const $menuItemLeft: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxs,
})

const $menuFooter: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingTop: spacing.xs,
})

const $menuFooterRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
})

const $inviteBadge: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  minWidth: 22,
  paddingHorizontal: spacing.xs,
  paddingVertical: 2,
  borderRadius: 999,
  backgroundColor: colors.tint,
  alignItems: "center",
  justifyContent: "center",
  marginTop: 10,
})

const $inviteBadgeText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.background,
  padding: 3,
})
