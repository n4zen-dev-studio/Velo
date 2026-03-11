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
  const { themed, theme } = useAppTheme()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<HomeStackScreenProps<"Home">["navigation"]>()

  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    uiTasksByStatus,
    activeWorkspace,
    assigneeFilter,
    setAssigneeFilter,
    assigneeLabels,
    refreshAll,
    isRefreshing,
    bumpTaskStatus,
  } = useHomeViewModel()

  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0)
  const totalTasks = useMemo(
    () => uiTasksByStatus.reduce((sum, lane) => sum + lane.tasks.length, 0),
    [uiTasksByStatus],
  )

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
    <Screen
      preset="fixed"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={themed($screen)}
    >
      <View style={themed($header)}>
        <View style={themed($headerActions)}>
          <HeaderAvatar onPress={goToProfile} size={50} />
        </View>
        <View style={themed($titleBlock)}>
          <Text preset="display" text="Velo" style={themed($homeTitle)} />
          <Text
            preset="formHelper"
            text="Momentum for the work that matters."
            style={themed($homeSubtitle)}
          />
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

      <GlassCard style={themed($heroCard)}>
        <View style={themed($heroGlow)} />
        <Text preset="overline" text="Workspace pulse" />
        <View style={themed($heroStats)}>
          <View style={themed($statCard)}>
            <Text preset="caption" text="Open lanes" />
            <Text preset="heading" text={`${uiTasksByStatus.length}`} />
          </View>
          <View style={themed($statCard)}>
            <Text preset="caption" text="Tasks in motion" />
            <Text preset="heading" text={`${totalTasks}`} />
          </View>
        </View>
      </GlassCard>

      <ScrollView
        contentContainerStyle={themed($scrollContent)}
        refreshControl={
          <RefreshControl
            tintColor={theme.colors.primary}
            refreshing={isRefreshing}
            onRefresh={() => refreshAll({ mode: "hard" })}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeWorkspace?.kind !== "personal" ? (
          <View style={themed($filterRow)}>
            <Pressable
              onPress={() => setAssigneeFilter("all")}
              style={[themed($filterPill), assigneeFilter === "all" && themed($filterPillActive)]}
            >
              <Text preset="caption" text="All tasks" />
            </Pressable>
            <Pressable
              onPress={() => setAssigneeFilter("mine")}
              style={[themed($filterPill), assigneeFilter === "mine" && themed($filterPillActive)]}
            >
              <Text preset="caption" text="Assigned to me" />
            </Pressable>
          </View>
        ) : null}

        {uiTasksByStatus.map(({ status, tasks }, laneIndex) => (
          <View
            key={`${status.workspaceId}:${status.projectId ?? "personal"}:${status.id}`}
            style={themed($section)}
          >
            <View style={themed($sectionHeader)}>
              <Text preset="sectionTitle" text={status.name} />
              <Text preset="caption" text={`${tasks.length} tasks`} />
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
                                console.log("[ArrowPress]", {
                                  taskId: task.id,
                                  laneIndex,
                                  dir: "up",
                                  task,
                                })
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                                void bumpTaskStatus(task.id, laneIndex, "up")
                              }}
                              style={({ pressed }) => [
                                themed($statusButton),
                                pressed ? themed($statusButtonPressed) : null,
                              ]}
                              hitSlop={6}
                            >
                              <Text preset="caption" text="↑" style={themed($statusArrow)} />
                            </Pressable>
                          ) : null}
                          {laneIndex < uiTasksByStatus.length - 1 ? (
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation?.()
                                console.log("[ArrowPress]", {
                                  taskId: task.id,
                                  laneIndex,
                                  dir: "down",
                                  task,
                                })
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                                void bumpTaskStatus(task.id, laneIndex, "down")
                              }}
                              style={({ pressed }) => [
                                themed($statusButton),
                                pressed ? themed($statusButtonPressed) : null,
                              ]}
                              hitSlop={6}
                            >
                              <Text preset="caption" text="↓" style={themed($statusArrow)} />
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                      {!!task.description && (
                        <Text
                          preset="formHelper"
                          text={task.description}
                          style={themed($taskDesc)}
                        />
                      )}
                      <Text
                        preset="caption"
                        text={`Assignee: ${
                          task.assigneeUserId
                            ? (assigneeLabels[task.assigneeUserId] ?? "Member")
                            : "Unassigned"
                        }`}
                        style={themed($taskMeta)}
                      />
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
        <Text preset="heading" text="+" style={themed($fabText)} />
      </Pressable>

      {/* Workspace dropdown */}
      <Modal
        visible={workspaceMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setWorkspaceMenuOpen(false)}
      >
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
                    style={{ marginTop: 10, flex: 1 }}
                  />
                  <View style={themed($inviteBadge)}>
                    <Text
                      preset="formHelper"
                      text={`${pendingInvitesCount}`}
                      style={themed($inviteBadgeText)}
                    />
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
  backgroundColor: "transparent",
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.screenHorizontal,
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

const $homeTitle: ThemedStyle<TextStyle> = () => ({
  lineHeight: 40,
})

const $homeSubtitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
})

const $headerActions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
})

const $heroCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginHorizontal: spacing.screenHorizontal,
  marginTop: spacing.md,
})

const $heroGlow: ThemedStyle<ViewStyle> = ({ colors }) => ({
  position: "absolute",
  right: -30,
  top: -50,
  width: 180,
  height: 180,
  borderRadius: 999,
  backgroundColor: colors.glowStrong,
})

const $heroStats: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.md,
  marginTop: spacing.sm,
})

const $statCard: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  flex: 1,
  borderRadius: radius.medium,
  padding: spacing.md,
  backgroundColor: colors.surfaceGlass,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  gap: spacing.xxs,
})

const $scrollContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingTop: spacing.sectionGap,
  paddingBottom: spacing.xxl,
  gap: spacing.sectionGap,
})

const $workspacePill: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  alignSelf: "flex-start",
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderStrong,
  backgroundColor: colors.surfaceGlass,
})

const $workspacePillText: ThemedStyle<TextStyle> = () => ({
  maxWidth: 220,
})

const $chev: ThemedStyle<TextStyle> = () => ({
  opacity: 0.8,
})

const $section: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.screenHorizontal,
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

const $taskDesc: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
})

const $statusControls: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  gap: spacing.xs,
})

const $statusButton: ThemedStyle<ViewStyle> = ({ colors, radius }) => ({
  width: 28,
  height: 28,
  borderRadius: radius.small,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surfaceGlass,
})

const $statusButtonPressed: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.primary,
  backgroundColor: colors.glowSoft,
})

const $statusArrow: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  lineHeight: 18,
})

const $filterRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
  paddingHorizontal: spacing.screenHorizontal,
})

const $filterPill: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  borderRadius: radius.pill,
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
})

const $filterPillActive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.glowSoft,
  borderColor: colors.primary,
})

const $taskMeta: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  marginTop: spacing.xs,
})

const $fab: ThemedStyle<ViewStyle> = ({ colors, spacing, elevation }) => ({
  position: "absolute",
  right: spacing.screenHorizontal,
  width: 62,
  height: 62,
  borderRadius: 31,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.primary,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.2)",
  ...elevation.glow,
})

const $fabText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textInverse,
})

const $modalBackdrop: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.35)",
  justifyContent: "center",
  padding: 16,
})

const $menuCard: ThemedStyle<ViewStyle> = ({ colors, spacing, radius, elevation }) => ({
  borderRadius: radius.large,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surfaceElevated,
  padding: spacing.md,
  gap: spacing.md,
  ...elevation.floating,
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

const $menuItem: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.sm,
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
})

const $menuItemActive: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.sm,
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.primary,
  backgroundColor: colors.glowSoft,
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
  backgroundColor: colors.primary,
  alignItems: "center",
  justifyContent: "center",
  marginTop: 10,
})

const $inviteBadgeText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textInverse,
  padding: 3,
})
